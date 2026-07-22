package com.surplasse.application.observability;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.surplasse.common.event.MagicLinkDeliveryCompleted;
import com.surplasse.common.event.OrderCreated;
import com.surplasse.common.event.OrderPaid;
import com.surplasse.common.event.PaymentFailed;
import com.surplasse.common.event.PaymentRefundFailed;
import com.surplasse.common.event.PaymentRefunded;
import com.surplasse.common.event.PaymentSessionOpened;
import com.surplasse.common.event.SseConnectionChanged;
import com.surplasse.common.event.SseConnectionChanged.Channel;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OperationalMetricsTest {

    private static final UUID ORDER = UUID.randomUUID();
    private static final UUID ESTABLISHMENT = UUID.randomUUID();

    @Test
    void domainSignalsUpdateOnlyBoundedOperationalSeries() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        OperationalMetrics metrics = new OperationalMetrics(registry);

        metrics.onOrderCreated(new OrderCreated(ORDER, ESTABLISHMENT));
        metrics.onPaymentSessionOpened(new PaymentSessionOpened(ORDER, ESTABLISHMENT));
        metrics.onPaymentSucceeded(new OrderPaid(ORDER, ESTABLISHMENT));
        metrics.onPaymentFailed(new PaymentFailed(ORDER, ESTABLISHMENT));
        metrics.onRefundSucceeded(new PaymentRefunded(ORDER, ESTABLISHMENT));
        metrics.onRefundFailed(new PaymentRefundFailed(ORDER, ESTABLISHMENT));
        metrics.onMagicLinkDelivery(new MagicLinkDeliveryCompleted(UUID.randomUUID(), true));
        metrics.onMagicLinkDelivery(new MagicLinkDeliveryCompleted(UUID.randomUUID(), false));

        assertEquals(1.0, registry.get("surplasse.orders.created").counter().count());
        assertEquals(
                1.0, registry.get("surplasse.payment.sessions.opened").counter().count());
        assertEquals(
                1.0,
                registry.get("surplasse.payment.intent.events")
                        .tag("outcome", "succeeded")
                        .counter()
                        .count());
        assertEquals(
                1.0,
                registry.get("surplasse.payment.intent.events")
                        .tag("outcome", "failed")
                        .counter()
                        .count());
        assertEquals(
                1.0,
                registry.get("surplasse.refunds")
                        .tag("outcome", "succeeded")
                        .counter()
                        .count());
        assertEquals(
                1.0,
                registry.get("surplasse.refunds")
                        .tag("outcome", "failed")
                        .counter()
                        .count());
        assertEquals(
                1.0,
                registry.get("surplasse.magic.link.deliveries")
                        .tag("outcome", "accepted")
                        .counter()
                        .count());
        assertEquals(
                1.0,
                registry.get("surplasse.magic.link.deliveries")
                        .tag("outcome", "failed")
                        .counter()
                        .count());
    }

    @Test
    void sseGaugeTracksCurrentConnectionsAndNeverBecomesNegative() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        OperationalMetrics metrics = new OperationalMetrics(registry);

        metrics.onSseConnectionChanged(new SseConnectionChanged(Channel.ORDER, true));
        metrics.onSseConnectionChanged(new SseConnectionChanged(Channel.ORDER, true));
        metrics.onSseConnectionChanged(new SseConnectionChanged(Channel.ORDER, false));
        metrics.onSseConnectionChanged(new SseConnectionChanged(Channel.ESTABLISHMENT, false));

        assertEquals(
                1.0,
                registry.get("surplasse.sse.connections.active")
                        .tag("channel", "order")
                        .gauge()
                        .value());
        assertEquals(
                0.0,
                registry.get("surplasse.sse.connections.active")
                        .tag("channel", "establishment")
                        .gauge()
                        .value());
    }
}
