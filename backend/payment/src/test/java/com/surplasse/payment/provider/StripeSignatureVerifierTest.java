package com.surplasse.payment.provider;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
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

    private static final String SECRET = "whsec_test";

    @Test
    void verify_connectTestEvent_extractsAccountAndMode() throws Exception {
        PaymentConfig config = mock(PaymentConfig.class);
        when(config.stripeWebhookSecret()).thenReturn(Optional.of(SECRET));
        when(config.liveMode()).thenReturn(false);
        StripeSignatureVerifier verifier = new StripeSignatureVerifier(config, new ObjectMapper());
        String payload =
                "{\"id\":\"evt_1\",\"type\":\"payment_intent.succeeded\",\"account\":\"acct_test_restaurant\",\"livemode\":false,\"data\":{\"object\":{\"id\":\"pi_1\"}}}";

        StripeEventVerifier.VerifiedEvent event = verifier.verify(payload, signature(payload));

        assertEquals("acct_test_restaurant", event.connectedAccountId());
        assertEquals("pi_1", event.paymentIntentId());
        assertFalse(event.liveMode());
    }

    @Test
    void verify_liveEvent_preservesModeForTheServiceBoundary() throws Exception {
        PaymentConfig config = mock(PaymentConfig.class);
        when(config.stripeWebhookSecret()).thenReturn(Optional.of(SECRET));
        when(config.liveMode()).thenReturn(false);
        StripeSignatureVerifier verifier = new StripeSignatureVerifier(config, new ObjectMapper());
        String payload =
                "{\"id\":\"evt_live\",\"type\":\"payment_intent.succeeded\",\"account\":\"acct_live\",\"livemode\":true,\"data\":{\"object\":{\"id\":\"pi_live\"}}}";

        StripeEventVerifier.VerifiedEvent event = verifier.verify(payload, signature(payload));

        assertEquals(true, event.liveMode());
    }

    @Test
    void verify_accountUpdated_extractsTheCapabilitySnapshot() throws Exception {
        PaymentConfig config = mock(PaymentConfig.class);
        when(config.stripeWebhookSecret()).thenReturn(Optional.of(SECRET));
        StripeSignatureVerifier verifier = new StripeSignatureVerifier(config, new ObjectMapper());
        String payload =
                "{\"id\":\"evt_account\",\"type\":\"account.updated\",\"account\":\"acct_test_restaurant\",\"created\":1784541600,\"livemode\":false,\"data\":{\"object\":{\"id\":\"acct_test_restaurant\",\"charges_enabled\":false,\"payouts_enabled\":true}}}";

        StripeEventVerifier.VerifiedEvent event = verifier.verify(payload, signature(payload));

        assertEquals(false, event.accountStatus().chargesEnabled());
        assertEquals(true, event.accountStatus().payoutsEnabled());
        assertEquals(
                OffsetDateTime.parse("2026-07-20T10:00:00Z"),
                event.accountStatus().occurredAt());
    }

    private static String signature(String payload) throws Exception {
        long timestamp = Instant.now().getEpochSecond();
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String signedPayload = timestamp + "." + payload;
        String digest = HexFormat.of().formatHex(mac.doFinal(signedPayload.getBytes(StandardCharsets.UTF_8)));
        return "t=" + timestamp + ",v1=" + digest;
    }
}
