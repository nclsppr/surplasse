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
 * order. The SSE stream is an accelerator, never the source of truth: the
 * events are persisted first (order_event), and reconnections replay from
 * the database via Last-Event-ID.
 */
@ApplicationScoped
public class OrderEventBroadcaster {

    // Channels live for the process lifetime; bounded by the number of orders
    // of the day at pilot scale, revisited with the establishment channel.
    private final ConcurrentMap<UUID, BroadcastProcessor<PublishedOrderEvent>> orderChannels =
            new ConcurrentHashMap<>();

    public void publish(PublishedOrderEvent event) {
        BroadcastProcessor<PublishedOrderEvent> channel = orderChannels.get(event.orderId());
        if (channel != null) {
            channel.onNext(event);
        }
    }

    public Multi<PublishedOrderEvent> orderStream(UUID orderId) {
        return orderChannels.computeIfAbsent(orderId, id -> BroadcastProcessor.create());
    }
}
