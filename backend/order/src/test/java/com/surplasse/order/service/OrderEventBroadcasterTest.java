package com.surplasse.order.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;

import com.surplasse.order.service.OrderStatusService.PublishedOrderEvent;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class OrderEventBroadcasterTest {

    @Test
    void publish_orderEvent_reachesOrderAndEstablishmentChannels() throws Exception {
        OrderEventBroadcaster broadcaster = new OrderEventBroadcaster();
        UUID orderId = UUID.randomUUID();
        UUID establishmentId = UUID.randomUUID();
        PublishedOrderEvent event =
                new PublishedOrderEvent(42L, orderId, establishmentId, "order-status", "{\"status\":\"paid\"}");

        var orderEvent = broadcaster
                .orderStream(orderId)
                .select()
                .first()
                .toUni()
                .subscribeAsCompletionStage()
                .toCompletableFuture();
        var establishmentEvent = broadcaster
                .establishmentStream(establishmentId)
                .select()
                .first()
                .toUni()
                .subscribeAsCompletionStage()
                .toCompletableFuture();
        var unrelatedEstablishmentEvent = broadcaster
                .establishmentStream(UUID.randomUUID())
                .select()
                .first()
                .toUni()
                .subscribeAsCompletionStage()
                .toCompletableFuture();

        broadcaster.publish(event);

        assertSame(event, orderEvent.get(1, TimeUnit.SECONDS));
        assertSame(event, establishmentEvent.get(1, TimeUnit.SECONDS));
        assertFalse(unrelatedEstablishmentEvent.isDone());
        unrelatedEstablishmentEvent.cancel(true);
    }
}
