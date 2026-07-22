package com.surplasse.identity.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.event.MagicLinkDeliveryCompleted;
import io.quarkus.mailer.reactive.ReactiveMailer;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.event.Event;
import java.net.URI;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MagicLinkDispatcherTest {

    @Test
    @SuppressWarnings("unchecked")
    void dispatch_smtpAcceptsMessage_reportsAcceptedDelivery() {
        ReactiveMailer mailer = mock(ReactiveMailer.class);
        Event<MagicLinkDeliveryCompleted> deliveryCompleted = mock(Event.class);
        UUID sessionId = UUID.randomUUID();
        when(mailer.send(any())).thenReturn(Uni.createFrom().voidItem());

        new MagicLinkDispatcher(mailer, deliveryCompleted)
                .dispatch(Optional.of(new MagicLinkDelivery(
                        sessionId, "operator@example.invalid", URI.create("https://example.invalid"))));

        verify(deliveryCompleted).fire(new MagicLinkDeliveryCompleted(sessionId, true));
    }

    @Test
    @SuppressWarnings("unchecked")
    void dispatch_smtpFails_reportsFailedDelivery() {
        ReactiveMailer mailer = mock(ReactiveMailer.class);
        Event<MagicLinkDeliveryCompleted> deliveryCompleted = mock(Event.class);
        UUID sessionId = UUID.randomUUID();
        when(mailer.send(any())).thenReturn(Uni.createFrom().failure(new IllegalStateException("smtp unavailable")));

        new MagicLinkDispatcher(mailer, deliveryCompleted)
                .dispatch(Optional.of(new MagicLinkDelivery(
                        sessionId, "operator@example.invalid", URI.create("https://example.invalid"))));

        verify(deliveryCompleted).fire(new MagicLinkDeliveryCompleted(sessionId, false));
    }
}
