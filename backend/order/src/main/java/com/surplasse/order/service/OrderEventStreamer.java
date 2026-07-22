package com.surplasse.order.service;

import com.surplasse.common.event.SseConnectionChanged;
import com.surplasse.common.event.SseConnectionChanged.Channel;
import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.order.entity.OrderEvent;
import com.surplasse.order.repository.OrderEventRepository;
import com.surplasse.order.service.OrderStatusService.PublishedOrderEvent;
import io.smallrye.mutiny.Multi;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import java.time.Duration;
import java.util.UUID;
import org.jboss.logging.Logger;

/**
 * Assembles the order SSE streams: replay of persisted events after
 * Last-Event-ID, then the matching live channel, with a periodic comment as
 * heartbeat so that intermediate proxies keep the connection open
 * (docs/architecture/backend.md).
 */
@ApplicationScoped
public class OrderEventStreamer {

    private static final Logger LOG = Logger.getLogger(OrderEventStreamer.class);
    private static final Duration HEARTBEAT_INTERVAL = Duration.ofSeconds(25);

    private final OrderService orderService;
    private final OrderEventRepository orderEventRepository;
    private final OrderEventBroadcaster broadcaster;
    private final RestaurateurIdentityGateway identityGateway;
    private final Event<SseConnectionChanged> connectionChanged;

    OrderEventStreamer(
            OrderService orderService,
            OrderEventRepository orderEventRepository,
            OrderEventBroadcaster broadcaster,
            RestaurateurIdentityGateway identityGateway,
            Event<SseConnectionChanged> connectionChanged) {
        this.orderService = orderService;
        this.orderEventRepository = orderEventRepository;
        this.broadcaster = broadcaster;
        this.identityGateway = identityGateway;
        this.connectionChanged = connectionChanged;
    }

    public Multi<OutboundSseEvent> stream(UUID orderId, String trackingToken, String lastEventId, Sse sse) {
        orderService.requireTrackingAccess(orderId, trackingToken);

        long after = parseLastEventId(lastEventId);
        return monitor(
                assemble(orderEventRepository.listForOrderAfter(orderId, after), broadcaster.orderStream(orderId), sse),
                Channel.ORDER);
    }

    public Multi<OutboundSseEvent> streamEstablishment(
            UUID establishmentId, String accessToken, String lastEventId, Sse sse) {
        identityGateway.authorize(accessToken, establishmentId);

        long after = parseLastEventId(lastEventId);
        return monitor(
                assemble(
                        orderEventRepository.listForEstablishmentAfter(establishmentId, after),
                        broadcaster.establishmentStream(establishmentId),
                        sse),
                Channel.ESTABLISHMENT);
    }

    private Multi<OutboundSseEvent> monitor(Multi<OutboundSseEvent> stream, Channel channel) {
        return stream.onSubscription()
                .invoke(subscription -> publishConnectionChange(channel, true))
                .onTermination()
                .invoke((failure, cancelled) -> publishConnectionChange(channel, false));
    }

    private void publishConnectionChange(Channel channel, boolean connected) {
        try {
            connectionChanged.fire(new SseConnectionChanged(channel, connected));
        } catch (RuntimeException failure) {
            LOG.warnf("SSE connection telemetry failed for channel %s.", channel);
        }
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
