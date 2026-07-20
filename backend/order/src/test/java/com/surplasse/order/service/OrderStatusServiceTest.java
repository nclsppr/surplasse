package com.surplasse.order.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class OrderStatusServiceTest {

    private static final String ACCESS_TOKEN = "access-token";
    private static final UUID RESTAURATEUR = UUID.randomUUID();
    private static final UUID ESTABLISHMENT = UUID.randomUUID();

    private OrderRepository orderRepository;
    private OrderEventRepository eventRepository;
    private RestaurateurIdentityGateway identityGateway;
    private RefundGateway refundGateway;
    private OrderStatusService service;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        eventRepository = mock(OrderEventRepository.class);
        identityGateway = mock(RestaurateurIdentityGateway.class);
        refundGateway = mock(RefundGateway.class);
        service = new OrderStatusService(orderRepository, eventRepository, identityGateway, refundGateway);
        when(identityGateway.authenticate(ACCESS_TOKEN)).thenReturn(RESTAURATEUR);
        when(identityGateway.authorize(ACCESS_TOKEN, ESTABLISHMENT)).thenReturn(RESTAURATEUR);
        doAnswer(invocation -> {
                    OrderEvent event = invocation.getArgument(0);
                    var id = OrderEvent.class.getDeclaredField("id");
                    id.setAccessible(true);
                    id.set(event, 42L);
                    return null;
                })
                .when(eventRepository)
                .persist(any(OrderEvent.class));
    }

    @Test
    void update_paidToAccepted_persistsOneStatusEvent() {
        Order order = orderAt(OrderStatus.PAID, OrderType.ON_SITE);
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));

        OrderStatusService.StatusUpdate result = service.update(ACCESS_TOKEN, order.getId(), OrderStatus.ACCEPTED);

        assertEquals(OrderStatus.ACCEPTED, result.status());
        assertTrue(result.event().isPresent());
        verify(identityGateway).authenticate(ACCESS_TOKEN);
        verify(identityGateway).authorize(ACCESS_TOKEN, ESTABLISHMENT);
        ArgumentCaptor<OrderEvent> event = ArgumentCaptor.forClass(OrderEvent.class);
        verify(eventRepository).persist(event.capture());
        verify(eventRepository).flush();
        assertEquals("order-status", event.getValue().getEventType());
        assertEquals(
                "{\"orderId\":\"%s\",\"status\":\"accepted\"}".formatted(order.getId()),
                event.getValue().getPayload());
    }

    @Test
    void update_repeatedReachedStatus_isIdempotent() {
        Order order = orderAt(OrderStatus.ACCEPTED, OrderType.ON_SITE);
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));

        OrderStatusService.StatusUpdate result = service.update(ACCESS_TOKEN, order.getId(), OrderStatus.ACCEPTED);

        assertEquals(OrderStatus.ACCEPTED, result.status());
        assertFalse(result.event().isPresent());
        verify(eventRepository, never()).persist(org.mockito.ArgumentMatchers.any(OrderEvent.class));
    }

    @Test
    void update_skippedState_yieldsConflict() {
        Order order = orderAt(OrderStatus.PAID, OrderType.ON_SITE);
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));

        ConflictException conflict = assertThrows(
                ConflictException.class, () -> service.update(ACCESS_TOKEN, order.getId(), OrderStatus.READY));

        assertEquals("order-not-modifiable", conflict.problemType());
        assertEquals(OrderStatus.PAID, order.getStatus());
        verify(eventRepository, never()).persist(org.mockito.ArgumentMatchers.any(OrderEvent.class));
    }

    @Test
    void update_refundInProgress_blocksKitchenProgress() {
        Order order = orderAt(OrderStatus.PAID, OrderType.ON_SITE);
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));
        when(refundGateway.hasInProgressRefund(order.getId(), ESTABLISHMENT)).thenReturn(true);

        ConflictException conflict = assertThrows(
                ConflictException.class, () -> service.update(ACCESS_TOKEN, order.getId(), OrderStatus.ACCEPTED));

        assertEquals("order-not-modifiable", conflict.problemType());
        assertEquals(OrderStatus.PAID, order.getStatus());
    }

    @Test
    void markRefunded_refundableOrder_persistsTheTerminalEvent() {
        Order order = orderAt(OrderStatus.PREPARING, OrderType.ON_SITE);
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));

        Optional<OrderStatusService.PublishedOrderEvent> event = service.markRefunded(order.getId());

        assertEquals(OrderStatus.REFUNDED, order.getStatus());
        assertTrue(event.isPresent());
        assertTrue(event.orElseThrow().payload().contains("\"status\":\"refunded\""));
    }

    @Test
    void markRefunded_completedOrder_rejectsAnInconsistentPaymentFact() {
        Order order = orderAt(OrderStatus.SERVED, OrderType.ON_SITE);
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));

        assertThrows(IllegalStateException.class, () -> service.markRefunded(order.getId()));

        assertEquals(OrderStatus.SERVED, order.getStatus());
        verify(eventRepository, never()).persist(org.mockito.ArgumentMatchers.any(OrderEvent.class));
    }

    @Test
    void markRefunded_unknownOrder_rejectsAnInconsistentPaymentFact() {
        UUID orderId = UUID.randomUUID();
        when(orderRepository.findByIdForUpdate(orderId)).thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class, () -> service.markRefunded(orderId));

        verify(eventRepository, never()).persist(org.mockito.ArgumentMatchers.any(OrderEvent.class));
    }

    @Test
    void update_onSiteOrderToPickedUp_yieldsBusinessRuleError() {
        Order order = orderAt(OrderStatus.READY, OrderType.ON_SITE);
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));

        assertThrows(
                BusinessRuleException.class, () -> service.update(ACCESS_TOKEN, order.getId(), OrderStatus.PICKED_UP));

        assertEquals(OrderStatus.READY, order.getStatus());
        verify(eventRepository, never()).persist(org.mockito.ArgumentMatchers.any(OrderEvent.class));
    }

    @Test
    void update_unknownOrder_authenticatesBeforeYielding404() {
        UUID orderId = UUID.randomUUID();
        when(orderRepository.findByIdForUpdate(orderId)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.update(ACCESS_TOKEN, orderId, OrderStatus.ACCEPTED));

        verify(identityGateway).authenticate(ACCESS_TOKEN);
        verify(identityGateway, never()).authorize(ACCESS_TOKEN, ESTABLISHMENT);
    }

    private static Order orderAt(OrderStatus target, OrderType type) {
        Order order = new Order(
                UUID.randomUUID(),
                ESTABLISHMENT,
                type == OrderType.ON_SITE ? UUID.randomUUID() : null,
                type == OrderType.ON_SITE ? UUID.randomUUID() : null,
                type,
                "17",
                LocalDate.now(ZoneOffset.UTC),
                1600,
                "ot_1234567890abcdef1234567890abcdef",
                UUID.randomUUID(),
                "hash",
                OffsetDateTime.now(ZoneOffset.UTC));
        if (target != OrderStatus.PENDING_PAYMENT) {
            order.moveTo(OrderStatus.PAID);
        }
        if (target == OrderStatus.ACCEPTED
                || target == OrderStatus.PREPARING
                || target == OrderStatus.READY
                || target == OrderStatus.SERVED
                || target == OrderStatus.PICKED_UP) {
            order.moveTo(OrderStatus.ACCEPTED);
        }
        if (target == OrderStatus.PREPARING
                || target == OrderStatus.READY
                || target == OrderStatus.SERVED
                || target == OrderStatus.PICKED_UP) {
            order.moveTo(OrderStatus.PREPARING);
        }
        if (target == OrderStatus.READY || target == OrderStatus.SERVED || target == OrderStatus.PICKED_UP) {
            order.moveTo(OrderStatus.READY);
        }
        if (target == OrderStatus.SERVED || target == OrderStatus.PICKED_UP) {
            order.moveTo(target);
        }
        return order;
    }
}
