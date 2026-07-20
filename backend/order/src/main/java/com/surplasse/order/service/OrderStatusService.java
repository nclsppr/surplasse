package com.surplasse.order.service;

import com.surplasse.common.error.BusinessRuleException;
import com.surplasse.common.error.ConflictException;
import com.surplasse.common.error.NotFoundException;
import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.common.payment.RefundGateway;
import com.surplasse.order.entity.Order;
import com.surplasse.order.entity.OrderEvent;
import com.surplasse.order.entity.OrderStatus;
import com.surplasse.order.entity.OrderType;
import com.surplasse.order.repository.OrderEventRepository;
import com.surplasse.order.repository.OrderRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jboss.logging.Logger;

@ApplicationScoped
public class OrderStatusService {

    private static final Logger LOG = Logger.getLogger(OrderStatusService.class);
    private static final Set<OrderStatus> RESTAURATEUR_TARGETS = Set.of(
            OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED, OrderStatus.PICKED_UP);

    private final OrderRepository orderRepository;
    private final OrderEventRepository orderEventRepository;
    private final RestaurateurIdentityGateway identityGateway;
    private final RefundGateway refundGateway;

    OrderStatusService(
            OrderRepository orderRepository,
            OrderEventRepository orderEventRepository,
            RestaurateurIdentityGateway identityGateway,
            RefundGateway refundGateway) {
        this.orderRepository = orderRepository;
        this.orderEventRepository = orderEventRepository;
        this.identityGateway = identityGateway;
        this.refundGateway = refundGateway;
    }

    /**
     * Moves an order to paid after webhook confirmation. Idempotent: an order
     * already past pending_payment is left untouched. Returns the persisted
     * event to broadcast, empty when nothing changed. The caller joins the
     * payment webhook transaction so the Stripe event, payment state, order
     * state and persisted SSE event either commit together or all roll back.
     */
    @Transactional
    public Optional<PublishedOrderEvent> markPaid(UUID orderId) {
        Optional<Order> found = orderRepository.findByIdForUpdate(orderId);
        if (found.isEmpty()) {
            LOG.warnf("markPaid ignored: unknown order %s", orderId);
            return Optional.empty();
        }
        Order order = found.get();
        if (!order.getStatus().canTransitionTo(OrderStatus.PAID)) {
            LOG.infof("markPaid ignored: order %s is %s", orderId, order.getStatus());
            return Optional.empty();
        }
        order.moveTo(OrderStatus.PAID);
        return Optional.of(persistEvent(order));
    }

    /** Moves an order to refunded only after the payment domain confirms that Stripe succeeded. */
    @Transactional
    public Optional<PublishedOrderEvent> markRefunded(UUID orderId) {
        Optional<Order> found = orderRepository.findByIdForUpdate(orderId);
        if (found.isEmpty()) {
            throw new IllegalStateException("A successful refund references an unknown order " + orderId + ".");
        }
        Order order = found.get();
        if (order.getStatus() == OrderStatus.REFUNDED) {
            return Optional.empty();
        }
        if (!order.getStatus().canTransitionTo(OrderStatus.REFUNDED)) {
            throw new IllegalStateException(
                    "A successful refund cannot move order %s from %s to refunded."
                            .formatted(orderId, order.getStatus()));
        }
        order.moveTo(OrderStatus.REFUNDED);
        return Optional.of(persistEvent(order));
    }

    /** Advances one order for authorized establishment staff and persists the customer-facing event. */
    @Transactional
    public StatusUpdate update(String accessToken, UUID orderId, OrderStatus target) {
        // Authenticate before looking up the order so an anonymous caller cannot probe identifiers.
        identityGateway.authenticate(accessToken);
        Order order = orderRepository
                .findByIdForUpdate(orderId)
                .orElseThrow(() -> new NotFoundException("No order matches this identifier."));
        identityGateway.authorize(accessToken, order.getEstablishmentId());

        if (refundGateway.hasInProgressRefund(order.getId(), order.getEstablishmentId())) {
            throw ConflictException.orderNotModifiable("A full refund is already in progress for this order.");
        }

        if (order.getStatus() == target) {
            return new StatusUpdate(order.getId(), order.getStatus(), Optional.empty());
        }
        if (target == null
                || !RESTAURATEUR_TARGETS.contains(target)
                || !order.getStatus().canTransitionTo(target)) {
            String targetValue = target == null ? "null" : target.dbValue();
            throw ConflictException.orderNotModifiable("Order status cannot move from %s to %s."
                    .formatted(order.getStatus().dbValue(), targetValue));
        }
        requireCompatibleCompletion(order, target);

        order.moveTo(target);
        return new StatusUpdate(order.getId(), order.getStatus(), Optional.of(persistEvent(order)));
    }

    private static void requireCompatibleCompletion(Order order, OrderStatus target) {
        if (target == OrderStatus.SERVED && order.getType() != OrderType.ON_SITE) {
            throw new BusinessRuleException("A takeaway order must finish as picked_up.");
        }
        if (target == OrderStatus.PICKED_UP && order.getType() != OrderType.TAKEAWAY) {
            throw new BusinessRuleException("An on-site order must finish as served.");
        }
    }

    private PublishedOrderEvent persistEvent(Order order) {
        OrderEvent event = new OrderEvent(
                order.getEstablishmentId(),
                order.getId(),
                "order-status",
                "{\"orderId\":\"%s\",\"status\":\"%s\"}"
                        .formatted(order.getId(), order.getStatus().dbValue()),
                OffsetDateTime.now(ZoneOffset.UTC));
        orderEventRepository.persist(event);
        orderEventRepository.flush();
        return new PublishedOrderEvent(
                event.getId(), order.getId(), order.getEstablishmentId(), event.getEventType(), event.getPayload());
    }

    public record StatusUpdate(UUID orderId, OrderStatus status, Optional<PublishedOrderEvent> event) {
        public StatusUpdate {
            event = event == null ? Optional.empty() : event;
        }
    }

    public record PublishedOrderEvent(long id, UUID orderId, UUID establishmentId, String name, String payload) {}
}
