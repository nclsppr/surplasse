package com.surplasse.payment.provider;

import com.surplasse.payment.entity.RefundStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Port of the webhook signature verification, doubled in tests. The real
 * implementation checks the Stripe-Signature header against the webhook
 * secret before anything is trusted.
 */
public interface StripeEventVerifier {

    /**
     * Verifies the signature and extracts the useful fields. Throws the
     * validation-error problem when the signature or payload is invalid.
     */
    VerifiedEvent verify(String rawPayload, String signatureHeader, Destination destination);

    enum Destination {
        PAYMENT_SNAPSHOT,
        ACCOUNT_THIN
    }

    record VerifiedEvent(
            String id,
            String type,
            String paymentIntentId,
            String connectedAccountId,
            boolean liveMode,
            OffsetDateTime occurredAt,
            RefundData refund) {

        public VerifiedEvent(
                String id, String type, String paymentIntentId, String connectedAccountId, boolean liveMode) {
            this(id, type, paymentIntentId, connectedAccountId, liveMode, null, null);
        }

        public VerifiedEvent(
                String id,
                String type,
                String paymentIntentId,
                String connectedAccountId,
                boolean liveMode,
                OffsetDateTime occurredAt) {
            this(id, type, paymentIntentId, connectedAccountId, liveMode, occurredAt, null);
        }

        public boolean refreshesConnectedAccountCapabilities() {
            return "v2.core.account.updated".equals(type)
                    || "v2.core.account.closed".equals(type)
                    || type.startsWith("v2.core.account[");
        }
    }

    record RefundData(String externalReference, UUID internalRefundId, RefundStatus status, String failureReason) {}
}
