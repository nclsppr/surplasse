package com.surplasse.payment.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.net.Webhook;
import com.surplasse.common.error.DependencyUnavailableException;
import com.surplasse.common.error.InvalidRequestException;
import com.surplasse.payment.config.PaymentConfig;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class StripeSignatureVerifier implements StripeEventVerifier {

    /** Clock tolerance of the signature, in seconds (docs/architecture/securite.md). */
    private static final long CLOCK_TOLERANCE_SECONDS = 300L;

    private final PaymentConfig config;
    private final ObjectMapper objectMapper;

    StripeSignatureVerifier(PaymentConfig config, ObjectMapper objectMapper) {
        this.config = config;
        this.objectMapper = objectMapper;
    }

    @Override
    public VerifiedEvent verify(String rawPayload, String signatureHeader) {
        String webhookSecret = config.stripeWebhookSecret()
                .filter(secret -> !secret.isBlank())
                .orElseThrow(() -> new DependencyUnavailableException(
                        "Stripe webhook secret is not configured (STRIPE_WEBHOOK_SECRET)."));
        if (signatureHeader == null || signatureHeader.isBlank()) {
            throw new InvalidRequestException("Missing Stripe-Signature header.");
        }
        try {
            Webhook.Signature.verifyHeader(rawPayload, signatureHeader, webhookSecret, CLOCK_TOLERANCE_SECONDS);
        } catch (SignatureVerificationException e) {
            throw new InvalidRequestException("Invalid Stripe-Signature header.");
        }
        return extract(rawPayload, objectMapper);
    }

    /** Field extraction shared with the test double, so both read the payload the same way. */
    public static VerifiedEvent extract(String rawPayload, ObjectMapper objectMapper) {
        JsonNode root;
        try {
            root = objectMapper.readTree(rawPayload);
        } catch (Exception e) {
            throw new InvalidRequestException("Unparseable webhook payload.");
        }
        String id = root.path("id").asText(null);
        String type = root.path("type").asText(null);
        if (id == null || type == null) {
            throw new InvalidRequestException("Webhook payload misses id or type.");
        }
        String paymentIntentId = root.path("data").path("object").path("id").asText(null);
        return new VerifiedEvent(id, type, paymentIntentId);
    }
}
