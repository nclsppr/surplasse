package com.surplasse.payment.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.error.InvalidRequestException;
import com.surplasse.common.event.OrderPaid;
import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.entity.PaymentStatus;
import com.surplasse.payment.entity.StripeWebhookEvent;
import com.surplasse.payment.provider.StripeEventVerifier;
import com.surplasse.payment.repository.PaymentRepository;
import com.surplasse.payment.repository.StripeWebhookEventRepository;
import jakarta.enterprise.event.Event;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class WebhookServiceTest {

    private StripeEventVerifier verifier;
    private StripeWebhookEventRepository processedEvents;
    private PaymentRepository paymentRepository;
    private Event<OrderPaid> orderPaid;
    private WebhookService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        verifier = mock(StripeEventVerifier.class);
        processedEvents = mock(StripeWebhookEventRepository.class);
        paymentRepository = mock(PaymentRepository.class);
        orderPaid = mock(Event.class);
        service = new WebhookService(verifier, processedEvents, paymentRepository, orderPaid);
        when(processedEvents.findByIdOptional(any())).thenReturn(Optional.empty());
    }

    private Payment pendingPayment() {
        return new Payment(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "pi_1", 2250, "EUR", "secret");
    }

    @Test
    void process_invalidSignature_rejectsWithoutAnyEffect() {
        when(verifier.verify(any(), any())).thenThrow(new InvalidRequestException("Invalid Stripe-Signature header."));

        assertThrows(InvalidRequestException.class, () -> service.process("{}", "bad"));
        verify(processedEvents, never()).persist(any(StripeWebhookEvent.class));
        verify(orderPaid, never()).fire(any());
    }

    @Test
    void process_duplicateEvent_isAcknowledgedWithoutEffect() {
        when(verifier.verify(any(), any()))
                .thenReturn(new StripeEventVerifier.VerifiedEvent("evt_1", "payment_intent.succeeded", "pi_1"));
        when(processedEvents.findByIdOptional("evt_1"))
                .thenReturn(Optional.of(new StripeWebhookEvent(
                        "evt_1", "payment_intent.succeeded", OffsetDateTime.now(ZoneOffset.UTC))));

        service.process("{}", "sig");

        verify(paymentRepository, never()).findByExternalReference(any());
        verify(orderPaid, never()).fire(any());
    }

    @Test
    void process_succeededIntent_marksPaymentAndFiresOrderPaid() {
        Payment payment = pendingPayment();
        when(verifier.verify(any(), any()))
                .thenReturn(new StripeEventVerifier.VerifiedEvent("evt_1", "payment_intent.succeeded", "pi_1"));
        when(paymentRepository.findByExternalReference("pi_1")).thenReturn(Optional.of(payment));

        service.process("{}", "sig");

        assertEquals(PaymentStatus.SUCCEEDED, payment.getStatus());
        verify(orderPaid).fire(new OrderPaid(payment.getOrderId(), payment.getEstablishmentId()));
    }

    @Test
    void process_succeededIntent_repairsLegacyFailedPayment() {
        Payment payment = pendingPayment();
        payment.markFailed();
        when(verifier.verify(any(), any()))
                .thenReturn(new StripeEventVerifier.VerifiedEvent("evt_legacy", "payment_intent.succeeded", "pi_1"));
        when(paymentRepository.findByExternalReference("pi_1")).thenReturn(Optional.of(payment));

        service.process("{}", "sig");

        assertEquals(PaymentStatus.SUCCEEDED, payment.getStatus());
        verify(orderPaid).fire(new OrderPaid(payment.getOrderId(), payment.getEstablishmentId()));
    }

    @Test
    void process_succeededIntentOnSettledPayment_firesNothing() {
        Payment payment = pendingPayment();
        payment.markSucceeded();
        when(verifier.verify(any(), any()))
                .thenReturn(new StripeEventVerifier.VerifiedEvent("evt_2", "payment_intent.succeeded", "pi_1"));
        when(paymentRepository.findByExternalReference("pi_1")).thenReturn(Optional.of(payment));

        service.process("{}", "sig");

        verify(orderPaid, never()).fire(any());
    }

    @Test
    void process_failedIntent_keepsThePaymentRetryable() {
        Payment payment = pendingPayment();
        when(verifier.verify(any(), any()))
                .thenReturn(new StripeEventVerifier.VerifiedEvent("evt_3", "payment_intent.payment_failed", "pi_1"));
        when(paymentRepository.findByExternalReference("pi_1")).thenReturn(Optional.of(payment));

        service.process("{}", "sig");

        assertEquals(PaymentStatus.PENDING, payment.getStatus());
        verify(orderPaid, never()).fire(any());
    }

    @Test
    void process_unknownIntent_isAcknowledgedWithoutEffect() {
        when(verifier.verify(any(), any()))
                .thenReturn(new StripeEventVerifier.VerifiedEvent("evt_4", "payment_intent.succeeded", "pi_ghost"));
        when(paymentRepository.findByExternalReference("pi_ghost")).thenReturn(Optional.empty());

        service.process("{}", "sig");

        verify(orderPaid, never()).fire(any());
    }
}
