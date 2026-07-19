package com.surplasse.order.service;

import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.order.entity.OrderEvent;
import com.surplasse.order.repository.OrderEventRepository;
import com.surplasse.order.service.OrderStatusService.PublishedOrderEvent;
import io.smallrye.mutiny.Multi;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import java.time.Duration;
import java.util.UUID;

/**
 * Assembles the order SSE streams: replay of persisted events after
 * Last-Event-ID, then the matching live channel, with a periodic comment as
 * heartbeat so that intermediate proxies keep the connection open
 * (docs/architecture/backend.md).
 */
@ApplicationScoped
public class OrderEventStreamer {

    private static final Duration HEARTBEAT_INTERVAL = Duration.ofSeconds(25);

    private final OrderService orderService;
    private final OrderEventRepository orderEventRepository;
    private final OrderEventBroadcaster broadcaster;
    private final RestaurateurIdentityGateway identityGateway;

    OrderEventStreamer(
            OrderService orderService,
            OrderEventRepository orderEventRepository,
            OrderEventBroadcaster broadcaster,
            RestaurateurIdentityGateway identityGateway) {
        this.orderService = orderService;
        this.orderEventRepository = orderEventRepository;
        this.broadcaster = broadcaster;
        this.identityGateway = identityGateway;
    }

    public Multi<OutboundSseEvent> stream(UUID orderId, String trackingToken, String lastEventId, Sse sse) {
        orderService.requireTrackingAccess(orderId, trackingToken);

        long after = parseLastEventId(lastEventId);
        return assemble(orderEventRepository.listForOrderAfter(orderId, after), broadcaster.orderStream(orderId), sse);
    }

    public Multi<OutboundSseEvent> streamEstablishment(
            UUID establishmentId, String accessToken, String lastEventId, Sse sse) {
        identityGateway.authorize(accessToken, establishmentId);

        long after = parseLastEventId(lastEventId);
        return assemble(
                orderEventRepository.listForEstablishmentAfter(establishmentId, after),
                broadcaster.establishmentStream(establishmentId),
                sse);
    }

    private static Multi<OutboundSseEvent> assemble(
            Iterable<OrderEvent> persistedEvents, Multi<PublishedOrderEvent> liveEvents, Sse sse) {
        Multi<OutboundSseEvent> replay =
                Multi.createFrom().iterable(persistedEvents).map(event -> toSseEvent(event, sse));
        Multi<OutboundSseEvent> live = liveEvents.map(event -> toSseEvent(event, sse));
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
                .mediaType(MediaType.TEXT_PLAIN_TYPE)
                .data(String.class, event.getPayload())
                .build();
    }

    private static OutboundSseEvent toSseEvent(PublishedOrderEvent event, Sse sse) {
        return sse.newEventBuilder()
                .id(String.valueOf(event.id()))
                .name(event.name())
                .mediaType(MediaType.TEXT_PLAIN_TYPE)
                .data(String.class, event.payload())
                .build();
    }
}
