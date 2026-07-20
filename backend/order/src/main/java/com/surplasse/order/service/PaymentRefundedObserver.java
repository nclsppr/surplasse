package com.surplasse.order.service;

import com.surplasse.common.event.PaymentRefunded;
import com.surplasse.order.service.OrderStatusService.PublishedOrderEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.event.Observes;

/** Applies a successful full refund to the order inside the payment reconciliation transaction. */
@ApplicationScoped
public class PaymentRefundedObserver {

    private final OrderStatusService statusService;
    private final Event<PublishedOrderEvent> persistedEvents;

    PaymentRefundedObserver(OrderStatusService statusService, Event<PublishedOrderEvent> persistedEvents) {
        this.statusService = statusService;
        this.persistedEvents = persistedEvents;
    }

    void onPaymentRefunded(@Observes PaymentRefunded event) {
        statusService.markRefunded(event.orderId()).ifPresent(persistedEvents::fire);
    }
}
