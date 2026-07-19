package com.surplasse.order.service;

import com.surplasse.order.service.OrderStatusService.PublishedOrderEvent;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Live fan-out of order events to connected SSE clients, one channel per
 * order and one per establishment. The SSE stream is an accelerator, never
 * the source of truth: events are persisted first (order_event), and
 * reconnections replay from the database via Last-Event-ID.
 */
@ApplicationScoped
public class OrderEventBroadcaster {

    // Channels live for the process lifetime; bounded by the orders and
    // establishments seen by one backend process at pilot scale.
    private final ConcurrentMap<UUID, BroadcastProcessor<PublishedOrderEvent>> orderChannels =
            new ConcurrentHashMap<>();
    private final ConcurrentMap<UUID, BroadcastProcessor<PublishedOrderEvent>> establishmentChannels =
            new ConcurrentHashMap<>();

    public void publish(PublishedOrderEvent event) {
        publishTo(orderChannels.get(event.orderId()), event);
        publishTo(establishmentChannels.get(event.establishmentId()), event);
    }

    public Multi<PublishedOrderEvent> orderStream(UUID orderId) {
        return orderChannels.computeIfAbsent(orderId, id -> BroadcastProcessor.create());
    }

    public Multi<PublishedOrderEvent> establishmentStream(UUID establishmentId) {
        return establishmentChannels.computeIfAbsent(establishmentId, id -> BroadcastProcessor.create());
    }

    private static void publishTo(BroadcastProcessor<PublishedOrderEvent> channel, PublishedOrderEvent event) {
        if (channel != null) {
            channel.onNext(event);
        }
    }
}
