package com.surplasse.payment.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.event.OrderPaid;
import com.surplasse.common.event.StripeAccountUpdated;
import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.entity.PaymentStatus;
import com.surplasse.payment.entity.StripeWebhookEvent;
import com.surplasse.payment.provider.ConnectedAccountProvider;
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

class WebhookEventProcessorTest {

    private static final String CONNECTED_ACCOUNT = "acct_test_restaurant";
    private static final OffsetDateTime ACCOUNT_UPDATED_AT = OffsetDateTime.parse("2026-07-20T10:00:00Z");

    private StripeWebhookEventRepository processedEvents;
    private PaymentRepository paymentRepository;
    private Event<OrderPaid> orderPaid;
    private Event<StripeAccountUpdated> stripeAccountUpdated;
    private WebhookEventProcessor processor;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        processedEvents = mock(StripeWebhookEventRepository.class);
        paymentRepository = mock(PaymentRepository.class);
        orderPaid = mock(Event.class);
        stripeAccountUpdated = mock(Event.class);
        processor = new WebhookEventProcessor(processedEvents, paymentRepository, orderPaid, stripeAccountUpdated);
        when(processedEvents.findByIdOptional(any())).thenReturn(Optional.empty());
    }

    @Test
    void process_duplicateEvent_isAcknowledgedWithoutEffect() {
        StripeEventVerifier.VerifiedEvent event = paymentEvent("evt_1", "payment_intent.succeeded");
        when(processedEvents.findByIdOptional("evt_1"))
                .thenReturn(Optional.of(new StripeWebhookEvent(
                        "evt_1", "payment_intent.succeeded", OffsetDateTime.now(ZoneOffset.UTC))));

        processor.process(event, null);

        verify(paymentRepository, never()).findByExternalReferenceAndAccount(any(), any());
        verify(orderPaid, never()).fire(any());
    }

    @Test
    void process_succeededIntent_marksPaymentAndFiresOrderPaid() {
        Payment payment = pendingPayment();
        when(paymentRepository.findByExternalReferenceAndAccount("pi_1", CONNECTED_ACCOUNT))
                .thenReturn(Optional.of(payment));

        processor.process(paymentEvent("evt_2", "payment_intent.succeeded"), null);

        assertEquals(PaymentStatus.SUCCEEDED, payment.getStatus());
        verify(orderPaid).fire(new OrderPaid(payment.getOrderId(), payment.getEstablishmentId()));
    }

    @Test
    void process_succeededIntent_repairsLegacyFailedPayment() {
        Payment payment = pendingPayment();
        payment.markFailed();
        when(paymentRepository.findByExternalReferenceAndAccount("pi_1", CONNECTED_ACCOUNT))
                .thenReturn(Optional.of(payment));

        processor.process(paymentEvent("evt_legacy", "payment_intent.succeeded"), null);

        assertEquals(PaymentStatus.SUCCEEDED, payment.getStatus());
        verify(orderPaid).fire(new OrderPaid(payment.getOrderId(), payment.getEstablishmentId()));
    }

    @Test
    void process_succeededIntentOnSettledPayment_firesNothing() {
        Payment payment = pendingPayment();
        payment.markSucceeded();
        when(paymentRepository.findByExternalReferenceAndAccount("pi_1", CONNECTED_ACCOUNT))
                .thenReturn(Optional.of(payment));

        processor.process(paymentEvent("evt_3", "payment_intent.succeeded"), null);

        verify(orderPaid, never()).fire(any());
    }

    @Test
    void process_failedIntent_keepsThePaymentRetryable() {
        Payment payment = pendingPayment();
        when(paymentRepository.findByExternalReferenceAndAccount("pi_1", CONNECTED_ACCOUNT))
                .thenReturn(Optional.of(payment));

        processor.process(paymentEvent("evt_4", "payment_intent.payment_failed"), null);

        assertEquals(PaymentStatus.PENDING, payment.getStatus());
        verify(orderPaid, never()).fire(any());
    }

    @Test
    void process_missingConnectedAccount_hasNoPaymentEffect() {
        StripeEventVerifier.VerifiedEvent event =
                new StripeEventVerifier.VerifiedEvent("evt_5", "payment_intent.succeeded", "pi_1", null, false);

        processor.process(event, null);

        verify(paymentRepository, never()).findByExternalReferenceAndAccount(any(), any());
        verify(orderPaid, never()).fire(any());
    }

    @Test
    void process_accountsV2Update_publishesTheAuthoritativeCapabilitySnapshot() {
        StripeEventVerifier.VerifiedEvent event = new StripeEventVerifier.VerifiedEvent(
                "evt_account",
                "v2.core.account[configuration.merchant].capability_status_updated",
                null,
                CONNECTED_ACCOUNT,
                false,
                ACCOUNT_UPDATED_AT);
        ConnectedAccountProvider.Capabilities capabilities = new ConnectedAccountProvider.Capabilities(false, true);

        processor.process(event, capabilities);

        verify(stripeAccountUpdated).fire(new StripeAccountUpdated(CONNECTED_ACCOUNT, false, true, ACCOUNT_UPDATED_AT));
        verify(orderPaid, never()).fire(any());
    }

    private static StripeEventVerifier.VerifiedEvent paymentEvent(String id, String type) {
        return new StripeEventVerifier.VerifiedEvent(id, type, "pi_1", CONNECTED_ACCOUNT, false);
    }

    private static Payment pendingPayment() {
        return new Payment(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "pi_1",
                2250,
                "EUR",
                "secret",
                CONNECTED_ACCOUNT,
                0);
    }
}
