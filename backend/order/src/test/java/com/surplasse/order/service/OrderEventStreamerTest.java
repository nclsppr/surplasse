package com.surplasse.order.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.error.AccessDeniedException;
import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.order.repository.OrderEventRepository;
import io.smallrye.mutiny.Multi;
import jakarta.ws.rs.sse.Sse;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OrderEventStreamerTest {

    private static final String ACCESS_TOKEN = "access-token";
    private static final UUID ESTABLISHMENT = UUID.randomUUID();

    private OrderEventRepository eventRepository;
    private OrderEventBroadcaster broadcaster;
    private RestaurateurIdentityGateway identityGateway;
    private OrderEventStreamer streamer;

    @BeforeEach
    void setUp() {
        eventRepository = mock(OrderEventRepository.class);
        broadcaster = mock(OrderEventBroadcaster.class);
        identityGateway = mock(RestaurateurIdentityGateway.class);
        streamer = new OrderEventStreamer(mock(OrderService.class), eventRepository, broadcaster, identityGateway);
    }

    @Test
    void streamEstablishment_authorizedRestaurateur_replaysAfterLastEventId() {
        when(eventRepository.listForEstablishmentAfter(ESTABLISHMENT, 41L)).thenReturn(List.of());
        when(broadcaster.establishmentStream(ESTABLISHMENT))
                .thenReturn(Multi.createFrom().empty());

        streamer.streamEstablishment(ESTABLISHMENT, ACCESS_TOKEN, "41", mock(Sse.class));

        verify(identityGateway).authorize(ACCESS_TOKEN, ESTABLISHMENT);
        verify(eventRepository).listForEstablishmentAfter(ESTABLISHMENT, 41L);
        verify(broadcaster).establishmentStream(ESTABLISHMENT);
    }

    @Test
    void streamEstablishment_inaccessibleEstablishment_doesNotReadEvents() {
        when(identityGateway.authorize(ACCESS_TOKEN, ESTABLISHMENT))
                .thenThrow(new AccessDeniedException("The establishment does not exist or is not accessible."));

        assertThrows(
                AccessDeniedException.class,
                () -> streamer.streamEstablishment(ESTABLISHMENT, ACCESS_TOKEN, null, mock(Sse.class)));

        verify(eventRepository, never()).listForEstablishmentAfter(ESTABLISHMENT, 0L);
        verify(broadcaster, never()).establishmentStream(ESTABLISHMENT);
    }
}
