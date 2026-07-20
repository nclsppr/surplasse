package com.surplasse.order.service;

import com.surplasse.common.event.OrderPaid;
import com.surplasse.order.service.OrderStatusService.PublishedOrderEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.TransactionPhase;

/**
 * Reaction of the order domain to a confirmed payment. The persisted status
 * change joins the payment transaction; only the in-memory SSE fan-out waits
 * for a successful commit.
 */
@ApplicationScoped
public class OrderPaidObserver {

    private final OrderStatusService statusService;
    private final OrderEventBroadcaster broadcaster;
    private final Event<PublishedOrderEvent> persistedEvents;

    OrderPaidObserver(
            OrderStatusService statusService,
            OrderEventBroadcaster broadcaster,
            Event<PublishedOrderEvent> persistedEvents) {
        this.statusService = statusService;
        this.broadcaster = broadcaster;
        this.persistedEvents = persistedEvents;
    }

    void onOrderPaid(@Observes OrderPaid event) {
        statusService.markPaid(event.orderId()).ifPresent(persistedEvents::fire);
    }

    void broadcastAfterCommit(@Observes(during = TransactionPhase.AFTER_SUCCESS) PublishedOrderEvent event) {
        broadcaster.publish(event);
    }
}
