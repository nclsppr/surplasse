package com.surplasse.order.service;

import com.surplasse.common.event.OrderPaid;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.TransactionPhase;

/**
 * Reaction of the order domain to a confirmed payment: observed after the
 * payment transaction commits (no effect for a rolled back payment), the
 * status change commits in its own transaction, then the live broadcast
 * fires.
 */
@ApplicationScoped
public class OrderPaidObserver {

    private final OrderStatusService statusService;
    private final OrderEventBroadcaster broadcaster;

    OrderPaidObserver(OrderStatusService statusService, OrderEventBroadcaster broadcaster) {
        this.statusService = statusService;
        this.broadcaster = broadcaster;
    }

    void onOrderPaid(@Observes(during = TransactionPhase.AFTER_SUCCESS) OrderPaid event) {
        statusService.markPaid(event.orderId()).ifPresent(broadcaster::publish);
    }
}
