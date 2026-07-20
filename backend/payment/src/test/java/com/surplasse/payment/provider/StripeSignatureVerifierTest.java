package com.surplasse.payment.provider;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.surplasse.common.error.InvalidRequestException;
import com.surplasse.payment.config.PaymentConfig;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class StripeSignatureVerifierTest {

    private static final String PAYMENT_SECRET = "whsec_payment_test";
    private static final String ACCOUNT_SECRET = "whsec_account_test";

    @Test
    void verify_connectTestEvent_extractsAccountAndMode() throws Exception {
        PaymentConfig config = mock(PaymentConfig.class);
        when(config.stripePaymentWebhookSecret()).thenReturn(Optional.of(PAYMENT_SECRET));
        when(config.liveMode()).thenReturn(false);
        StripeSignatureVerifier verifier = new StripeSignatureVerifier(config, new ObjectMapper());
        String payload =
                "{\"id\":\"evt_1\",\"type\":\"payment_intent.succeeded\",\"account\":\"acct_test_restaurant\",\"livemode\":false,\"data\":{\"object\":{\"id\":\"pi_1\"}}}";

        StripeEventVerifier.VerifiedEvent event = verifier.verify(
                payload, signature(payload, PAYMENT_SECRET), StripeEventVerifier.Destination.PAYMENT_SNAPSHOT);

        assertEquals("acct_test_restaurant", event.connectedAccountId());
        assertEquals("pi_1", event.paymentIntentId());
        assertFalse(event.liveMode());
    }

    @Test
    void verify_liveEvent_preservesModeForTheServiceBoundary() throws Exception {
        PaymentConfig config = mock(PaymentConfig.class);
        when(config.stripePaymentWebhookSecret()).thenReturn(Optional.of(PAYMENT_SECRET));
        when(config.liveMode()).thenReturn(false);
        StripeSignatureVerifier verifier = new StripeSignatureVerifier(config, new ObjectMapper());
        String payload =
                "{\"id\":\"evt_live\",\"type\":\"payment_intent.succeeded\",\"account\":\"acct_live\",\"livemode\":true,\"data\":{\"object\":{\"id\":\"pi_live\"}}}";

        StripeEventVerifier.VerifiedEvent event = verifier.verify(
                payload, signature(payload, PAYMENT_SECRET), StripeEventVerifier.Destination.PAYMENT_SNAPSHOT);

        assertEquals(true, event.liveMode());
    }

    @Test
    void verify_accountsV2CapabilityEvent_extractsTheRelatedAccountAndTime() throws Exception {
        PaymentConfig config = mock(PaymentConfig.class);
        when(config.stripeAccountWebhookSecret()).thenReturn(Optional.of(ACCOUNT_SECRET));
        StripeSignatureVerifier verifier = new StripeSignatureVerifier(config, new ObjectMapper());
        String payload =
                "{\"id\":\"evt_account\",\"object\":\"v2.core.event\",\"type\":\"v2.core.account[configuration.merchant].capability_status_updated\",\"created\":\"2026-07-20T10:00:00Z\",\"livemode\":false,\"related_object\":{\"id\":\"acct_test_restaurant\",\"type\":\"v2.core.account\",\"url\":\"/v2/core/accounts/acct_test_restaurant\"}}";

        StripeEventVerifier.VerifiedEvent event = verifier.verify(
                payload, signature(payload, ACCOUNT_SECRET), StripeEventVerifier.Destination.ACCOUNT_THIN);

        assertEquals("acct_test_restaurant", event.connectedAccountId());
        assertEquals(OffsetDateTime.parse("2026-07-20T10:00:00Z"), event.occurredAt());
        assertEquals(true, event.refreshesConnectedAccountCapabilities());
    }

    @Test
    void verify_accountsV2Destination_rejectsThePaymentDestinationSecret() throws Exception {
        PaymentConfig config = mock(PaymentConfig.class);
        when(config.stripeAccountWebhookSecret()).thenReturn(Optional.of(ACCOUNT_SECRET));
        StripeSignatureVerifier verifier = new StripeSignatureVerifier(config, new ObjectMapper());
        String payload =
                "{\"id\":\"evt_account\",\"object\":\"v2.core.event\",\"type\":\"v2.core.account.updated\",\"created\":\"2026-07-20T10:00:00Z\",\"livemode\":false,\"related_object\":{\"id\":\"acct_test_restaurant\",\"type\":\"v2.core.account\"}}";

        assertThrows(
                InvalidRequestException.class,
                () -> verifier.verify(
                        payload, signature(payload, PAYMENT_SECRET), StripeEventVerifier.Destination.ACCOUNT_THIN));
    }

    private static String signature(String payload, String secret) throws Exception {
        long timestamp = Instant.now().getEpochSecond();
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String signedPayload = timestamp + "." + payload;
        String digest = HexFormat.of().formatHex(mac.doFinal(signedPayload.getBytes(StandardCharsets.UTF_8)));
        return "t=" + timestamp + ",v1=" + digest;
    }
}
