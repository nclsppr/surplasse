package com.surplasse.order.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.catalog.CatalogGateway;
import com.surplasse.common.error.BusinessRuleException;
import com.surplasse.common.error.ConflictException;
import com.surplasse.common.error.NotFoundException;
import com.surplasse.order.entity.Order;
import com.surplasse.order.entity.OrderLine;
import com.surplasse.order.entity.OrderType;
import com.surplasse.order.repository.OrderLineRepository;
import com.surplasse.order.repository.OrderRepository;
import com.surplasse.order.service.OrderService.LineDraft;
import com.surplasse.order.service.OrderService.OrderDraft;
import com.surplasse.order.service.TableSessionService.ActiveSession;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class OrderServiceTest {

    private static final UUID ESTABLISHMENT = UUID.randomUUID();
    private static final UUID TABLE = UUID.randomUUID();
    private static final UUID BURGER = UUID.randomUUID();
    private static final UUID PANISSES = UUID.randomUUID();
    private static final UUID SOUP = UUID.randomUUID();
    private static final UUID RARE = UUID.randomUUID();
    private static final UUID WELL_DONE = UUID.randomUUID();
    private static final UUID GOAT_CHEESE = UUID.randomUUID();
    private static final UUID SOLD_OUT_OPTION = UUID.randomUUID();

    private OrderRepository orderRepository;
    private OrderLineRepository orderLineRepository;
    private CatalogGateway catalogGateway;
    private OrderService service;
    private final ActiveSession session = new ActiveSession(UUID.randomUUID(), ESTABLISHMENT, TABLE);

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class, RETURNS_DEEP_STUBS);
        orderLineRepository = mock(OrderLineRepository.class);
        catalogGateway = mock(CatalogGateway.class);
        service = new OrderService(orderRepository, orderLineRepository, catalogGateway);
        when(orderRepository.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(catalogGateway.findTableLabel(TABLE)).thenReturn(Optional.of("Table 4"));
        when(catalogGateway.priceProducts(any(), anyCollection())).thenReturn(demoPricing());
    }

    private static Map<UUID, CatalogGateway.ProductPricing> demoPricing() {
        var doneness = new CatalogGateway.OptionGroupPricing(
                UUID.randomUUID(),
                "Cuisson",
                1,
                1,
                List.of(
                        new CatalogGateway.OptionPricing(RARE, "Saignant", 0, true),
                        new CatalogGateway.OptionPricing(WELL_DONE, "Bien cuit", 0, true)));
        var extras = new CatalogGateway.OptionGroupPricing(
                UUID.randomUUID(),
                "Suppléments",
                0,
                3,
                List.of(
                        new CatalogGateway.OptionPricing(GOAT_CHEESE, "Fromage de chèvre", 150, true),
                        new CatalogGateway.OptionPricing(SOLD_OUT_OPTION, "Anchois marinés", 100, false)));
        return Map.of(
                BURGER,
                new CatalogGateway.ProductPricing(
                        BURGER, "Burger du Vieux-Port", 1600, true, List.of(doneness, extras)),
                PANISSES,
                new CatalogGateway.ProductPricing(PANISSES, "Panisses croustillantes", 650, true, List.of()),
                SOUP,
                new CatalogGateway.ProductPricing(SOUP, "Soupe de poisson", 850, false, List.of()));
    }

    @Test
    void create_burgerWithOptionsAndQuantities_computesEveryAmountFromTheCatalog() {
        OrderDraft draft = new OrderDraft(
                "on_site",
                List.of(
                        new LineDraft(BURGER, 2, List.of(RARE, GOAT_CHEESE), "Sauce à part."),
                        new LineDraft(PANISSES, 1, List.of(), null)));

        var view = service.create(session, UUID.randomUUID(), draft);

        ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).persist(orderCaptor.capture());
        Order order = orderCaptor.getValue();
        assertEquals((1600 + 150) * 2 + 650, order.getTotalCents());
        assertEquals("1", order.getDisplayNumber());
        assertEquals(OrderType.ON_SITE, order.getType());
        assertTrue(order.getTrackingToken().startsWith("ot_"));

        ArgumentCaptor<OrderLine> lineCaptor = ArgumentCaptor.forClass(OrderLine.class);
        verify(orderLineRepository, org.mockito.Mockito.times(2)).persist(lineCaptor.capture());
        OrderLine burgerLine = lineCaptor.getAllValues().get(0);
        assertEquals(3500, burgerLine.getLineTotalCents());
        assertEquals(0, burgerLine.getPosition());
        assertEquals("Sauce à part.", burgerLine.getNote());
        List<OptionsJson.OptionSnapshot> options = OptionsJson.read(burgerLine.getOptionsJson());
        assertEquals(2, options.size());
        assertEquals("Cuisson", options.get(0).group());
        OrderLine panissesLine = lineCaptor.getAllValues().get(1);
        assertEquals(650, panissesLine.getLineTotalCents());
        assertNull(panissesLine.getNote());
        assertEquals("Table 4", view.tableLabel());
    }

    @Test
    void create_missingMandatoryGroup_isRejected() {
        OrderDraft draft = new OrderDraft("on_site", List.of(new LineDraft(BURGER, 1, List.of(), null)));

        assertThrows(BusinessRuleException.class, () -> service.create(session, UUID.randomUUID(), draft));
    }

    @Test
    void create_tooManyChoicesInGroup_isRejected() {
        OrderDraft draft = new OrderDraft("on_site", List.of(new LineDraft(BURGER, 1, List.of(RARE, WELL_DONE), null)));

        assertThrows(BusinessRuleException.class, () -> service.create(session, UUID.randomUUID(), draft));
    }

    @Test
    void create_duplicatedOption_isRejected() {
        OrderDraft draft = new OrderDraft("on_site", List.of(new LineDraft(BURGER, 1, List.of(RARE, RARE), null)));

        assertThrows(BusinessRuleException.class, () -> service.create(session, UUID.randomUUID(), draft));
    }

    @Test
    void create_unknownProduct_yields404() {
        OrderDraft draft = new OrderDraft("on_site", List.of(new LineDraft(UUID.randomUUID(), 1, List.of(), null)));

        assertThrows(NotFoundException.class, () -> service.create(session, UUID.randomUUID(), draft));
    }

    @Test
    void create_unavailableProduct_yieldsProductUnavailable() {
        OrderDraft draft = new OrderDraft("on_site", List.of(new LineDraft(SOUP, 1, List.of(), null)));

        ConflictException conflict =
                assertThrows(ConflictException.class, () -> service.create(session, UUID.randomUUID(), draft));
        assertEquals("product-unavailable", conflict.problemType());
    }

    @Test
    void create_unavailableOption_yieldsProductUnavailable() {
        OrderDraft draft =
                new OrderDraft("on_site", List.of(new LineDraft(BURGER, 1, List.of(RARE, SOLD_OUT_OPTION), null)));

        ConflictException conflict =
                assertThrows(ConflictException.class, () -> service.create(session, UUID.randomUUID(), draft));
        assertEquals("product-unavailable", conflict.problemType());
    }

    @Test
    void create_optionOfAnotherProduct_yields404() {
        OrderDraft draft = new OrderDraft("on_site", List.of(new LineDraft(PANISSES, 1, List.of(RARE), null)));

        assertThrows(NotFoundException.class, () -> service.create(session, UUID.randomUUID(), draft));
    }

    @Test
    void create_takeaway_isRejectedUntilItOpens() {
        OrderDraft draft = new OrderDraft("takeaway", List.of(new LineDraft(PANISSES, 1, List.of(), null)));

        assertThrows(BusinessRuleException.class, () -> service.create(session, UUID.randomUUID(), draft));
    }

    @Test
    void create_replaySameKeyAndPayload_returnsTheOriginalOrder() {
        OrderDraft draft = new OrderDraft("on_site", List.of(new LineDraft(PANISSES, 1, List.of(), null)));
        UUID key = UUID.randomUUID();
        Order existing = new Order(
                UUID.randomUUID(),
                ESTABLISHMENT,
                TABLE,
                session.sessionId(),
                OrderType.ON_SITE,
                "7",
                LocalDate.now(ZoneOffset.UTC),
                650,
                "ot_1234567890abcdef1234567890abcdef",
                key,
                Tokens.sha256Hex(draft.canonicalForm()),
                OffsetDateTime.now(ZoneOffset.UTC));
        when(orderRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existing));
        when(orderLineRepository.listByOrderOrdered(existing.getId())).thenReturn(List.of());

        var view = service.create(session, key, draft);

        assertSame(existing, view.order());
        verify(orderRepository, never()).persist(any(Order.class));
    }

    @Test
    void create_replaySameKeyDifferentPayload_yieldsIdempotencyConflict() {
        OrderDraft original = new OrderDraft("on_site", List.of(new LineDraft(PANISSES, 1, List.of(), null)));
        OrderDraft altered = new OrderDraft("on_site", List.of(new LineDraft(PANISSES, 2, List.of(), null)));
        UUID key = UUID.randomUUID();
        Order existing = new Order(
                UUID.randomUUID(),
                ESTABLISHMENT,
                TABLE,
                session.sessionId(),
                OrderType.ON_SITE,
                "7",
                LocalDate.now(ZoneOffset.UTC),
                650,
                "ot_1234567890abcdef1234567890abcdef",
                key,
                Tokens.sha256Hex(original.canonicalForm()),
                OffsetDateTime.now(ZoneOffset.UTC));
        when(orderRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existing));

        ConflictException conflict = assertThrows(ConflictException.class, () -> service.create(session, key, altered));
        assertEquals("idempotency-key-conflict", conflict.problemType());
    }

    @Test
    void create_replaySameKeyFromAnotherTableSession_yieldsIdempotencyConflict() {
        OrderDraft draft = new OrderDraft("on_site", List.of(new LineDraft(PANISSES, 1, List.of(), null)));
        UUID key = UUID.randomUUID();
        Order existing = new Order(
                UUID.randomUUID(),
                ESTABLISHMENT,
                TABLE,
                session.sessionId(),
                OrderType.ON_SITE,
                "7",
                LocalDate.now(ZoneOffset.UTC),
                650,
                "ot_1234567890abcdef1234567890abcdef",
                key,
                Tokens.sha256Hex(draft.canonicalForm()),
                OffsetDateTime.now(ZoneOffset.UTC));
        when(orderRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existing));
        ActiveSession otherSession = new ActiveSession(UUID.randomUUID(), ESTABLISHMENT, TABLE);

        ConflictException conflict =
                assertThrows(ConflictException.class, () -> service.create(otherSession, key, draft));

        assertEquals("idempotency-key-conflict", conflict.problemType());
    }

    @Test
    void getForTracking_wrongToken_yields404() {
        Order order = new Order(
                UUID.randomUUID(),
                ESTABLISHMENT,
                TABLE,
                session.sessionId(),
                OrderType.ON_SITE,
                "7",
                LocalDate.now(ZoneOffset.UTC),
                650,
                "ot_1234567890abcdef1234567890abcdef",
                UUID.randomUUID(),
                "hash",
                OffsetDateTime.now(ZoneOffset.UTC));
        when(orderRepository.findByIdOptional(order.getId())).thenReturn(Optional.of(order));

        assertThrows(
                NotFoundException.class,
                () -> service.getForTracking(order.getId(), "ot_ffffffffffffffffffffffffffffffff"));
    }
}
