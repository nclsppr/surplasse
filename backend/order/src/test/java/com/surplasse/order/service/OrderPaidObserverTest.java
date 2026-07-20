package com.surplasse.order.service;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.event.OrderPaid;
import com.surplasse.order.service.OrderStatusService.PublishedOrderEvent;
import jakarta.enterprise.event.Event;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OrderPaidObserverTest {

    @Test
    @SuppressWarnings("unchecked")
    void onOrderPaid_persistsInTheCurrentTransactionAndDefersBroadcast() {
        OrderStatusService statusService = mock(OrderStatusService.class);
        OrderEventBroadcaster broadcaster = mock(OrderEventBroadcaster.class);
        Event<PublishedOrderEvent> persistedEvents = mock(Event.class);
        OrderPaidObserver observer = new OrderPaidObserver(statusService, broadcaster, persistedEvents);
        UUID orderId = UUID.randomUUID();
        PublishedOrderEvent published =
                new PublishedOrderEvent(42L, orderId, UUID.randomUUID(), "order-status", "{\"status\":\"paid\"}");
        when(statusService.markPaid(orderId)).thenReturn(Optional.of(published));

        observer.onOrderPaid(new OrderPaid(orderId, published.establishmentId()));

        verify(persistedEvents).fire(published);
        verify(broadcaster, never()).publish(published);

        observer.broadcastAfterCommit(published);

        verify(broadcaster).publish(published);
    }
}
