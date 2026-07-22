package com.surplasse.order.service;

import com.surplasse.common.catalog.CatalogGateway;
import com.surplasse.common.error.BusinessRuleException;
import com.surplasse.common.error.ConflictException;
import com.surplasse.common.error.NotFoundException;
import com.surplasse.common.event.OrderCreated;
import com.surplasse.order.entity.Order;
import com.surplasse.order.entity.OrderLine;
import com.surplasse.order.entity.OrderType;
import com.surplasse.order.repository.OrderLineRepository;
import com.surplasse.order.repository.OrderRepository;
import com.surplasse.order.service.TableSessionService.ActiveSession;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.transaction.Transactional;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class OrderService {

    /** Single currency of the MVP, aligned with the catalog. */
    private static final String ORDER_CURRENCY = "EUR";

    private final OrderRepository orderRepository;
    private final OrderLineRepository orderLineRepository;
    private final CatalogGateway catalogGateway;
    private final Event<OrderCreated> orderCreated;

    OrderService(
            OrderRepository orderRepository,
            OrderLineRepository orderLineRepository,
            CatalogGateway catalogGateway,
            Event<OrderCreated> orderCreated) {
        this.orderRepository = orderRepository;
        this.orderLineRepository = orderLineRepository;
        this.catalogGateway = catalogGateway;
        this.orderCreated = orderCreated;
    }

    @Transactional
    public OrderView create(ActiveSession session, UUID idempotencyKey, OrderDraft draft) {
        String requestHash = Tokens.sha256Hex(draft.canonicalForm());

        var replayed = orderRepository.findByIdempotencyKey(idempotencyKey);
        if (replayed.isPresent()) {
            Order existing = replayed.get();
            if (!existing.getRequestHash().equals(requestHash)
                    || !existing.getEstablishmentId().equals(session.establishmentId())
                    || !session.sessionId().equals(existing.getTableSessionId())) {
                throw ConflictException.idempotencyKeyConflict();
            }
            return view(existing);
        }

        CatalogGateway.OrderIntakeAdmission admission = catalogGateway
                .lockOrderIntake(session.establishmentId())
                .orElseThrow(ConflictException::orderIntakePaused);
        if (!admission.acceptingOrders()) {
            throw ConflictException.orderIntakePaused();
        }

        if (!"on_site".equals(draft.type())) {
            throw new BusinessRuleException("Takeaway orders are not open yet.");
        }

        List<PricedLine> pricedLines = priceLines(session.establishmentId(), draft.lines());
        int totalCents =
                pricedLines.stream().mapToInt(PricedLine::lineTotalCents).sum();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        LocalDate serviceDay = now.toLocalDate();

        Order order = persistWithDisplayNumber(session, idempotencyKey, requestHash, totalCents, now, serviceDay);
        List<OrderLine> lines = new ArrayList<>();
        for (int index = 0; index < pricedLines.size(); index++) {
            PricedLine priced = pricedLines.get(index);
            OrderLine line = new OrderLine(
                    UUID.randomUUID(),
                    order.getId(),
                    priced.productId(),
                    priced.productName(),
                    priced.unitPriceCents(),
                    priced.quantity(),
                    OptionsJson.write(priced.options()),
                    priced.note(),
                    priced.lineTotalCents(),
                    index);
            orderLineRepository.persist(line);
            lines.add(line);
        }
        orderCreated.fire(new OrderCreated(order.getId(), order.getEstablishmentId()));
        return new OrderView(order, lines, tableLabel(order));
    }

    public OrderView getForTracking(UUID orderId, String trackingToken) {
        Order order = orderRepository
                .findByIdOptional(orderId)
                .filter(candidate -> Tokens.matches(candidate.getTrackingToken(), trackingToken))
                .orElseThrow(() -> new NotFoundException("No order matches this tracking token."));
        return view(order);
    }

    /** Same capability check as the tracking page, for the SSE stream. */
    public void requireTrackingAccess(UUID orderId, String trackingToken) {
        getForTracking(orderId, trackingToken);
    }

    private OrderView view(Order order) {
        return new OrderView(order, orderLineRepository.listByOrderOrdered(order.getId()), tableLabel(order));
    }

    private String tableLabel(Order order) {
        if (order.getTableQrId() == null) {
            return null;
        }
        return catalogGateway.findTableLabel(order.getTableQrId()).orElse(null);
    }

    private List<PricedLine> priceLines(UUID establishmentId, List<LineDraft> lines) {
        if (lines.isEmpty()) {
            throw new BusinessRuleException("An order requires at least one line.");
        }
        Set<UUID> productIds = lines.stream().map(LineDraft::productId).collect(Collectors.toSet());
        Map<UUID, CatalogGateway.ProductPricing> pricing = catalogGateway.priceProducts(establishmentId, productIds);

        List<PricedLine> priced = new ArrayList<>();
        for (LineDraft line : lines) {
            CatalogGateway.ProductPricing product = pricing.get(line.productId());
            if (product == null) {
                throw new NotFoundException("Product %s is not on the menu.".formatted(line.productId()));
            }
            if (!product.available()) {
                throw ConflictException.productUnavailable(
                        "Product '%s' is marked unavailable on this menu.".formatted(product.name()));
            }
            if (line.quantity() < 1 || line.quantity() > 50) {
                throw new BusinessRuleException("Quantity must be between 1 and 50.");
            }
            priced.add(priceLine(product, line));
        }
        return priced;
    }

    private PricedLine priceLine(CatalogGateway.ProductPricing product, LineDraft line) {
        List<UUID> optionIds = line.optionIds();
        if (new HashSet<>(optionIds).size() != optionIds.size()) {
            throw new BusinessRuleException("The same option cannot be picked twice on one line.");
        }
        List<OptionsJson.OptionSnapshot> snapshots = new ArrayList<>();
        int extraCents = 0;
        for (CatalogGateway.OptionGroupPricing group : product.optionGroups()) {
            int picked = 0;
            for (CatalogGateway.OptionPricing option : group.options()) {
                if (optionIds.contains(option.optionId())) {
                    if (!option.available()) {
                        throw ConflictException.productUnavailable(
                                "Option '%s' is marked unavailable.".formatted(option.name()));
                    }
                    picked++;
                    extraCents += option.extraCostCents();
                    snapshots.add(new OptionsJson.OptionSnapshot(group.name(), option.name(), option.extraCostCents()));
                }
            }
            if (picked < group.minChoices() || picked > group.maxChoices()) {
                throw new BusinessRuleException("Option group '%s' requires between %d and %d choices."
                        .formatted(group.name(), group.minChoices(), group.maxChoices()));
            }
        }
        Set<UUID> knownOptionIds = product.optionGroups().stream()
                .flatMap(group -> group.options().stream())
                .map(CatalogGateway.OptionPricing::optionId)
                .collect(Collectors.toSet());
        for (UUID optionId : optionIds) {
            if (!knownOptionIds.contains(optionId)) {
                throw new NotFoundException(
                        "Option %s does not belong to product '%s'.".formatted(optionId, product.name()));
            }
        }
        int lineTotal = (product.priceCents() + extraCents) * line.quantity();
        return new PricedLine(
                product.productId(),
                product.name(),
                product.priceCents(),
                line.quantity(),
                snapshots,
                normalizedNote(line.note()),
                lineTotal);
    }

    private static String normalizedNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }
        return note.strip();
    }

    /**
     * The display number is unique per establishment and day. A PostgreSQL
     * transactional advisory lock serializes its allocation (native query,
     * justified: advisory locks have no JPA equivalent); a retry inside the
     * transaction would not work, a constraint violation marks it
     * rollback-only.
     */
    private Order persistWithDisplayNumber(
            ActiveSession session,
            UUID idempotencyKey,
            String requestHash,
            int totalCents,
            OffsetDateTime now,
            LocalDate serviceDay) {
        orderRepository
                .getEntityManager()
                .createNativeQuery("select pg_advisory_xact_lock(hashtext(:key))")
                .setParameter("key", session.establishmentId() + ":" + serviceDay)
                .getSingleResult();
        long base = orderRepository.countByEstablishmentAndServiceDay(session.establishmentId(), serviceDay);
        Order order = new Order(
                UUID.randomUUID(),
                session.establishmentId(),
                session.tableQrId(),
                session.sessionId(),
                OrderType.ON_SITE,
                String.valueOf(base + 1),
                serviceDay,
                totalCents,
                Tokens.newToken("ot_"),
                idempotencyKey,
                requestHash,
                now);
        orderRepository.persist(order);
        return order;
    }

    public record OrderDraft(String type, List<LineDraft> lines) {

        /** Deterministic form of the request, hashed to detect idempotency key reuse with a different payload. */
        String canonicalForm() {
            return type
                    + "|"
                    + lines.stream()
                            .map(line -> line.productId()
                                    + ":"
                                    + line.quantity()
                                    + ":"
                                    + line.optionIds().stream()
                                            .map(UUID::toString)
                                            .sorted()
                                            .collect(Collectors.joining(","))
                                    + ":"
                                    + (line.note() == null ? "" : line.note()))
                            .collect(Collectors.joining(";"));
        }
    }

    public record LineDraft(UUID productId, int quantity, List<UUID> optionIds, String note) {}

    public record OrderView(Order order, List<OrderLine> lines, String tableLabel) {}

    record PricedLine(
            UUID productId,
            String productName,
            int unitPriceCents,
            int quantity,
            List<OptionsJson.OptionSnapshot> options,
            String note,
            int lineTotalCents) {}
}
