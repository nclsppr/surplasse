package com.surplasse.payment.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.net.Webhook;
import com.surplasse.common.error.DependencyUnavailableException;
import com.surplasse.common.error.InvalidRequestException;
import com.surplasse.payment.config.PaymentConfig;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

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
    public VerifiedEvent verify(String rawPayload, String signatureHeader, Destination destination) {
        String webhookSecret = secret(destination)
                .filter(secret -> !secret.isBlank())
                .orElseThrow(() -> new DependencyUnavailableException(
                        "Stripe webhook secret is not configured for this event destination."));
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

    private Optional<String> secret(Destination destination) {
        return destination == Destination.PAYMENT_SNAPSHOT
                ? config.stripePaymentWebhookSecret()
                : config.stripeAccountWebhookSecret();
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
        JsonNode liveModeNode = root.get("livemode");
        if (liveModeNode == null || !liveModeNode.isBoolean()) {
            throw new InvalidRequestException("Webhook payload misses livemode.");
        }
        JsonNode object = root.path("data").path("object");
        String objectId = object.path("id").asText(null);
        String paymentIntentId = type.startsWith("payment_intent.")
                ? objectId
                : object.path("payment_intent").asText(null);
        StripeEventVerifier.RefundData refund = type.startsWith("refund.")
                ? extractRefund(objectId, object)
                : null;
        String connectedAccountId = root.path("account").asText(null);
        boolean liveMode = liveModeNode.booleanValue();
        OffsetDateTime occurredAt = null;
        if (refreshesConnectedAccountCapabilities(type)) {
            JsonNode relatedObject = root.path("related_object");
            String relatedObjectType = relatedObject.path("type").asText(null);
            connectedAccountId = relatedObject.path("id").asText(null);
            if (connectedAccountId == null || !"v2.core.account".equals(relatedObjectType)) {
                throw new InvalidRequestException("Stripe account event is incomplete or inconsistent.");
            }
            occurredAt = parseOccurredAt(root.get("created"));
        }
        return new VerifiedEvent(id, type, paymentIntentId, connectedAccountId, liveMode, occurredAt, refund);
    }

    private static StripeEventVerifier.RefundData extractRefund(String objectId, JsonNode object) {
        String statusValue = object.path("status").asText(null);
        if (objectId == null || object.path("payment_intent").asText(null) == null || statusValue == null) {
            throw new InvalidRequestException("Stripe refund event is incomplete.");
        }
        com.surplasse.payment.entity.RefundStatus status;
        try {
            status = com.surplasse.payment.entity.RefundStatus.fromProviderValue(statusValue);
        } catch (IllegalArgumentException e) {
            throw new InvalidRequestException("Stripe refund event has an unknown status.");
        }
        UUID internalRefundId = null;
        String internalId = object.path("metadata").path("refund_id").asText(null);
        if (internalId != null) {
            try {
                internalRefundId = UUID.fromString(internalId);
            } catch (IllegalArgumentException e) {
                throw new InvalidRequestException("Stripe refund event has an invalid refund identifier.");
            }
        }
        return new StripeEventVerifier.RefundData(
                objectId, internalRefundId, status, object.path("failure_reason").asText(null));
    }

    private static boolean refreshesConnectedAccountCapabilities(String type) {
        return "v2.core.account.updated".equals(type)
                || "v2.core.account.closed".equals(type)
                || type.startsWith("v2.core.account[");
    }

    private static OffsetDateTime parseOccurredAt(JsonNode created) {
        if (created == null) {
            throw new InvalidRequestException("Stripe account event misses its creation time.");
        }
        try {
            Instant instant = created.isNumber()
                    ? Instant.ofEpochSecond(created.longValue())
                    : Instant.parse(created.textValue());
            return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
        } catch (RuntimeException e) {
            throw new InvalidRequestException("Stripe account event has an invalid creation time.");
        }
    }
}
