package com.surplasse.order.service;

import com.surplasse.order.entity.OrderEvent;
import com.surplasse.order.repository.OrderEventRepository;
import com.surplasse.order.service.OrderStatusService.PublishedOrderEvent;
import io.smallrye.mutiny.Multi;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import java.time.Duration;
import java.util.UUID;

/**
 * Assembles the SSE stream of one order: replay of the persisted events
 * after Last-Event-ID, then the live channel, with a periodic comment as
 * heartbeat so that intermediate proxies keep the connection open
 * (docs/architecture/backend.md).
 */
@ApplicationScoped
public class OrderEventStreamer {

    private static final Duration HEARTBEAT_INTERVAL = Duration.ofSeconds(25);

    private final OrderService orderService;
    private final OrderEventRepository orderEventRepository;
    private final OrderEventBroadcaster broadcaster;

    OrderEventStreamer(
            OrderService orderService, OrderEventRepository orderEventRepository, OrderEventBroadcaster broadcaster) {
        this.orderService = orderService;
        this.orderEventRepository = orderEventRepository;
        this.broadcaster = broadcaster;
    }

    public Multi<OutboundSseEvent> stream(UUID orderId, String trackingToken, String lastEventId, Sse sse) {
        orderService.requireTrackingAccess(orderId, trackingToken);

        long after = parseLastEventId(lastEventId);
        Multi<OutboundSseEvent> replay = Multi.createFrom()
                .iterable(orderEventRepository.listForOrderAfter(orderId, after))
                .map(event -> toSseEvent(event, sse));
        Multi<OutboundSseEvent> live = broadcaster.orderStream(orderId).map(event -> toSseEvent(event, sse));
        Multi<OutboundSseEvent> heartbeat = Multi.createFrom()
                .ticks()
                .every(HEARTBEAT_INTERVAL)
                .map(tick -> sse.newEventBuilder().comment("keep-alive").build());

        return Multi.createBy()
                .merging()
                .streams(Multi.createBy().concatenating().streams(replay, live), heartbeat);
    }

    private static long parseLastEventId(String lastEventId) {
        if (lastEventId == null || lastEventId.isBlank()) {
            return 0L;
        }
        try {
            return Long.parseLong(lastEventId.strip());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private static OutboundSseEvent toSseEvent(OrderEvent event, Sse sse) {
        return sse.newEventBuilder()
                .id(String.valueOf(event.getId()))
                .name(event.getEventType())
                .data(event.getPayload())
                .build();
    }

    private static OutboundSseEvent toSseEvent(PublishedOrderEvent event, Sse sse) {
        return sse.newEventBuilder()
                .id(String.valueOf(event.id()))
                .name(event.name())
                .data(event.payload())
                .build();
    }
}
