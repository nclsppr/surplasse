package com.surplasse.application.observability;

import com.surplasse.common.event.MagicLinkDeliveryCompleted;
import com.surplasse.common.event.OrderCreated;
import com.surplasse.common.event.OrderPaid;
import com.surplasse.common.event.PaymentFailed;
import com.surplasse.common.event.PaymentRefundFailed;
import com.surplasse.common.event.PaymentRefunded;
import com.surplasse.common.event.PaymentSessionOpened;
import com.surplasse.common.event.SseConnectionChanged;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.runtime.Startup;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.TransactionPhase;
import java.util.concurrent.atomic.AtomicInteger;
import org.jboss.logging.Logger;

/**
 * Converts committed domain signals into low-cardinality operational metrics.
 * Prometheus scrapes the in-process registry; this bean performs no network IO.
 */
@ApplicationScoped
@Startup
public class OperationalMetrics {

    private static final Logger LOG = Logger.getLogger(OperationalMetrics.class);

    private final Counter ordersCreated;
    private final Counter paymentSessionsOpened;
    private final Counter paymentsSucceeded;
    private final Counter paymentsFailed;
    private final Counter refundsSucceeded;
    private final Counter refundsFailed;
    private final Counter magicLinksAccepted;
    private final Counter magicLinksFailed;
    private final AtomicInteger orderSseConnections = new AtomicInteger();
    private final AtomicInteger establishmentSseConnections = new AtomicInteger();

    OperationalMetrics(MeterRegistry registry) {
        ordersCreated = counter(registry, "surplasse.orders.created", "New orders persisted by the Backend");
        paymentSessionsOpened =
                counter(registry, "surplasse.payment.sessions.opened", "Payment sessions activated with the provider");
        paymentsSucceeded = outcomeCounter(
                registry, "surplasse.payment.intent.events", "succeeded", "Reconciled payment intent events");
        paymentsFailed = outcomeCounter(
                registry, "surplasse.payment.intent.events", "failed", "Reconciled payment intent events");
        refundsSucceeded = outcomeCounter(registry, "surplasse.refunds", "succeeded", "Reconciled refund transitions");
        refundsFailed = outcomeCounter(registry, "surplasse.refunds", "failed", "Reconciled refund transitions");
        magicLinksAccepted = outcomeCounter(
                registry, "surplasse.magic.link.deliveries", "accepted", "Magic link SMTP delivery results");
        magicLinksFailed = outcomeCounter(
                registry, "surplasse.magic.link.deliveries", "failed", "Magic link SMTP delivery results");
        gauge(registry, "order", orderSseConnections);
        gauge(registry, "establishment", establishmentSseConnections);
    }

    void onOrderCreated(@Observes(during = TransactionPhase.AFTER_SUCCESS) OrderCreated ignored) {
        increment(ordersCreated);
    }

    void onPaymentSessionOpened(@Observes(during = TransactionPhase.AFTER_SUCCESS) PaymentSessionOpened ignored) {
        increment(paymentSessionsOpened);
    }

    void onPaymentSucceeded(@Observes(during = TransactionPhase.AFTER_SUCCESS) OrderPaid ignored) {
        increment(paymentsSucceeded);
    }

    void onPaymentFailed(@Observes(during = TransactionPhase.AFTER_SUCCESS) PaymentFailed ignored) {
        increment(paymentsFailed);
    }

    void onRefundSucceeded(@Observes(during = TransactionPhase.AFTER_SUCCESS) PaymentRefunded ignored) {
        increment(refundsSucceeded);
    }

    void onRefundFailed(@Observes(during = TransactionPhase.AFTER_SUCCESS) PaymentRefundFailed ignored) {
        increment(refundsFailed);
    }

    void onMagicLinkDelivery(@Observes MagicLinkDeliveryCompleted result) {
        increment(result.accepted() ? magicLinksAccepted : magicLinksFailed);
    }

    void onSseConnectionChanged(@Observes SseConnectionChanged change) {
        AtomicInteger gauge =
                switch (change.channel()) {
                    case ORDER -> orderSseConnections;
                    case ESTABLISHMENT -> establishmentSseConnections;
                };
        gauge.updateAndGet(current -> change.connected() ? current + 1 : Math.max(0, current - 1));
    }

    private static Counter counter(MeterRegistry registry, String name, String description) {
        return Counter.builder(name).description(description).register(registry);
    }

    private static Counter outcomeCounter(MeterRegistry registry, String name, String outcome, String description) {
        return Counter.builder(name)
                .description(description)
                .tag("outcome", outcome)
                .register(registry);
    }

    private static void gauge(MeterRegistry registry, String channel, AtomicInteger value) {
        Gauge.builder("surplasse.sse.connections.active", value, AtomicInteger::get)
                .description("Currently active authorized SSE subscriptions")
                .tag("channel", channel)
                .register(registry);
    }

    private static void increment(Counter counter) {
        try {
            counter.increment();
        } catch (RuntimeException failure) {
            LOG.warn("An operational metric could not be updated.", failure);
        }
    }
}
