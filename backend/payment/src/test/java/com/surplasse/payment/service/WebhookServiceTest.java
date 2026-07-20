package com.surplasse.payment.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.error.InvalidRequestException;
import com.surplasse.payment.config.PaymentConfig;
import com.surplasse.payment.provider.ConnectedAccountProvider;
import com.surplasse.payment.provider.StripeEventVerifier;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class WebhookServiceTest {

    private static final String CONNECTED_ACCOUNT = "acct_test_restaurant";

    private StripeEventVerifier verifier;
    private PaymentConfig config;
    private ConnectedAccountProvider connectedAccounts;
    private WebhookEventProcessor processor;
    private WebhookService service;

    @BeforeEach
    void setUp() {
        verifier = mock(StripeEventVerifier.class);
        config = mock(PaymentConfig.class);
        connectedAccounts = mock(ConnectedAccountProvider.class);
        processor = mock(WebhookEventProcessor.class);
        service = new WebhookService(verifier, config, connectedAccounts, processor);
        when(config.liveMode()).thenReturn(false);
    }

    @Test
    void process_invalidSignature_rejectsWithoutAnyEffect() {
        when(verifier.verify(any(), any(), any()))
                .thenThrow(new InvalidRequestException("Invalid Stripe-Signature header."));

        assertThrows(
                InvalidRequestException.class,
                () -> service.process("{}", "bad", StripeEventVerifier.Destination.PAYMENT_SNAPSHOT));

        verify(connectedAccounts, never()).retrieveCapabilities(any());
        verify(processor, never()).process(any(), any());
    }

    @Test
    void process_eventFromAnotherStripeMode_isAcknowledgedWithoutAnyEffect() {
        StripeEventVerifier.VerifiedEvent event = new StripeEventVerifier.VerifiedEvent(
                "evt_live", "payment_intent.succeeded", "pi_1", CONNECTED_ACCOUNT, true);
        when(verifier.verify(any(), any(), any())).thenReturn(event);

        service.process("{}", "sig", StripeEventVerifier.Destination.PAYMENT_SNAPSHOT);

        verify(connectedAccounts, never()).retrieveCapabilities(any());
        verify(processor, never()).process(any(), any());
    }

    @Test
    void process_paymentEvent_doesNotReadTheConnectedAccount() {
        StripeEventVerifier.VerifiedEvent event = new StripeEventVerifier.VerifiedEvent(
                "evt_payment", "payment_intent.succeeded", "pi_1", CONNECTED_ACCOUNT, false);
        when(verifier.verify(any(), any(), any())).thenReturn(event);

        service.process("{}", "sig", StripeEventVerifier.Destination.PAYMENT_SNAPSHOT);

        verify(connectedAccounts, never()).retrieveCapabilities(any());
        verify(processor).process(event, null);
    }

    @Test
    void process_accountsV2Event_readsCapabilitiesBeforeTheTransaction() {
        StripeEventVerifier.VerifiedEvent event = new StripeEventVerifier.VerifiedEvent(
                "evt_account",
                "v2.core.account[configuration.merchant].capability_status_updated",
                null,
                CONNECTED_ACCOUNT,
                false,
                OffsetDateTime.parse("2026-07-20T10:00:00Z"));
        ConnectedAccountProvider.Capabilities capabilities = new ConnectedAccountProvider.Capabilities(false, true);
        when(verifier.verify(any(), any(), any())).thenReturn(event);
        when(connectedAccounts.retrieveCapabilities(CONNECTED_ACCOUNT)).thenReturn(capabilities);

        service.process("{}", "sig", StripeEventVerifier.Destination.ACCOUNT_THIN);

        verify(processor).process(event, capabilities);
    }

    @Test
    void process_accountEventOnPaymentDestination_rejectsWithoutRemoteRead() {
        StripeEventVerifier.VerifiedEvent event = new StripeEventVerifier.VerifiedEvent(
                "evt_account",
                "v2.core.account[configuration.merchant].capability_status_updated",
                null,
                CONNECTED_ACCOUNT,
                false,
                OffsetDateTime.parse("2026-07-20T10:00:00Z"));
        when(verifier.verify(any(), any(), any())).thenReturn(event);

        assertThrows(
                InvalidRequestException.class,
                () -> service.process("{}", "sig", StripeEventVerifier.Destination.PAYMENT_SNAPSHOT));

        verify(connectedAccounts, never()).retrieveCapabilities(any());
        verify(processor, never()).process(any(), any());
    }

    @Test
    void process_paymentEventOnAccountDestination_rejectsWithoutAnyEffect() {
        StripeEventVerifier.VerifiedEvent event = new StripeEventVerifier.VerifiedEvent(
                "evt_payment", "payment_intent.succeeded", "pi_1", CONNECTED_ACCOUNT, false);
        when(verifier.verify(any(), any(), any())).thenReturn(event);

        assertThrows(
                InvalidRequestException.class,
                () -> service.process("{}", "sig", StripeEventVerifier.Destination.ACCOUNT_THIN));

        verify(connectedAccounts, never()).retrieveCapabilities(any());
        verify(processor, never()).process(any(), any());
    }
}
