package com.surplasse.order.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.catalog.CatalogGateway;
import com.surplasse.common.error.InvalidRequestException;
import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.order.entity.Order;
import com.surplasse.order.entity.OrderStatus;
import com.surplasse.order.entity.OrderType;
import com.surplasse.order.repository.OrderLineRepository;
import com.surplasse.order.repository.OrderRepository;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class OperationalOrderServiceTest {

    private static final UUID ESTABLISHMENT = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");
    private static final UUID TABLE = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final OffsetDateTime BASE_TIME = OffsetDateTime.parse("2026-07-18T12:34:56Z");

    private OrderRepository orderRepository;
    private OrderLineRepository orderLineRepository;
    private CatalogGateway catalogGateway;
    private RestaurateurIdentityGateway identityGateway;
    private OperationalOrderService service;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        orderLineRepository = mock(OrderLineRepository.class);
        catalogGateway = mock(CatalogGateway.class);
        identityGateway = mock(RestaurateurIdentityGateway.class);
        service = new OperationalOrderService(orderRepository, orderLineRepository, catalogGateway, identityGateway);
        when(orderLineRepository.listByOrdersOrdered(any())).thenReturn(List.of());
        when(catalogGateway.findTableLabels(anyCollection())).thenReturn(Map.of(TABLE, "Table 4"));
    }

    @Test
    void list_firstPage_readsLimitPlusOneAndBuildsCursorFromLastVisibleOrder() {
        Order newest = operationalOrder("ffffffff-ffff-4fff-8fff-ffffffffffff", BASE_TIME, OrderStatus.PAID);
        Order anchor = operationalOrder("80000000-0000-4000-8000-000000000000", BASE_TIME, OrderStatus.ACCEPTED);
        Order extra = operationalOrder(
                "11111111-1111-4111-8111-111111111111", BASE_TIME.minusSeconds(1), OrderStatus.PREPARING);
        when(orderRepository.listOperational(ESTABLISHMENT, 3)).thenReturn(List.of(newest, anchor, extra));

        OperationalOrderService.OrderPage page = service.list("jwt", ESTABLISHMENT, null, 2);

        assertEquals(
                List.of(newest, anchor),
                page.items().stream().map(OrderService.OrderView::order).toList());
        assertTrue(page.hasMore());
        OperationalOrderCursor.Position position = OperationalOrderCursor.decode(page.nextCursor(), ESTABLISHMENT);
        assertEquals(anchor.getCreatedAt().toInstant(), position.createdAt().toInstant());
        assertEquals(anchor.getId(), position.orderId());
        verify(identityGateway).authorize("jwt", ESTABLISHMENT);
        verify(orderLineRepository).listByOrdersOrdered(List.of(newest.getId(), anchor.getId()));
        verify(catalogGateway).findTableLabels(java.util.Set.of(TABLE));
    }

    @Test
    void list_followingPage_usesCompositeAnchorSoNewHeadOrdersCannotShiftIt() {
        Order anchor = operationalOrder("80000000-0000-4000-8000-000000000000", BASE_TIME, OrderStatus.ACCEPTED);
        Order older =
                operationalOrder("11111111-1111-4111-8111-111111111111", BASE_TIME.minusSeconds(1), OrderStatus.READY);
        String cursor = OperationalOrderCursor.encode(ESTABLISHMENT, anchor.getCreatedAt(), anchor.getId());
        when(orderRepository.listOperationalAfter(ESTABLISHMENT, anchor.getCreatedAt(), anchor.getId(), 3))
                .thenReturn(List.of(older));

        OperationalOrderService.OrderPage page = service.list("jwt", ESTABLISHMENT, cursor, 2);

        assertEquals(
                List.of(older),
                page.items().stream().map(OrderService.OrderView::order).toList());
        assertFalse(page.hasMore());
        assertNull(page.nextCursor());
        verify(orderRepository, never()).listOperational(any(), any(Integer.class));
    }

    @Test
    void list_takeawayOrder_hasNoTableLabelAndDoesNotLookUpANullKey() {
        Order takeaway = operationalOrder(
                "11111111-1111-4111-8111-111111111111", BASE_TIME, OrderStatus.PAID, OrderType.TAKEAWAY, null);
        when(orderRepository.listOperational(ESTABLISHMENT, 2)).thenReturn(List.of(takeaway));
        when(catalogGateway.findTableLabels(java.util.Set.of())).thenReturn(Map.of());

        OperationalOrderService.OrderPage page = service.list("jwt", ESTABLISHMENT, null, 1);

        assertNull(page.items().getFirst().tableLabel());
        verify(catalogGateway).findTableLabels(java.util.Set.of());
    }

    @Test
    void list_noLimit_usesDefaultAndReadsOneExtraRow() {
        when(orderRepository.listOperational(ESTABLISHMENT, OperationalOrderService.DEFAULT_LIMIT + 1))
                .thenReturn(List.of());

        OperationalOrderService.OrderPage page = service.list("jwt", ESTABLISHMENT, null, null);

        assertTrue(page.items().isEmpty());
        assertFalse(page.hasMore());
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 100})
    void list_contractLimitBounds_areAcceptedAndReadOneExtraRow(int limit) {
        when(orderRepository.listOperational(ESTABLISHMENT, limit + 1)).thenReturn(List.of());

        service.list("jwt", ESTABLISHMENT, null, limit);

        verify(orderRepository).listOperational(ESTABLISHMENT, limit + 1);
    }

    @Test
    void list_limitOutsideContractRange_isRejectedBeforeQuery() {
        assertThrows(InvalidRequestException.class, () -> service.list("jwt", ESTABLISHMENT, null, 0));
        assertThrows(InvalidRequestException.class, () -> service.list("jwt", ESTABLISHMENT, null, 101));

        verify(orderRepository, never()).listOperational(any(), any(Integer.class));
        verify(identityGateway, never()).authorize(any(), any());
    }

    private static Order operationalOrder(String id, OffsetDateTime createdAt, OrderStatus target) {
        return operationalOrder(id, createdAt, target, OrderType.ON_SITE, TABLE);
    }

    private static Order operationalOrder(
            String id, OffsetDateTime createdAt, OrderStatus target, OrderType type, UUID tableQrId) {
        Order order = new Order(
                UUID.fromString(id),
                ESTABLISHMENT,
                tableQrId,
                tableQrId == null ? null : UUID.randomUUID(),
                type,
                "17",
                LocalDate.ofInstant(createdAt.toInstant(), ZoneOffset.UTC),
                1600,
                "ot_1234567890abcdef1234567890abcdef",
                UUID.randomUUID(),
                "request-hash",
                createdAt);
        order.moveTo(OrderStatus.PAID);
        if (target == OrderStatus.ACCEPTED || target == OrderStatus.PREPARING || target == OrderStatus.READY) {
            order.moveTo(OrderStatus.ACCEPTED);
        }
        if (target == OrderStatus.PREPARING || target == OrderStatus.READY) {
            order.moveTo(OrderStatus.PREPARING);
        }
        if (target == OrderStatus.READY) {
            order.moveTo(OrderStatus.READY);
        }
        return order;
    }
}
