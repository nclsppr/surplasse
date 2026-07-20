package com.surplasse.payment.provider;

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
    VerifiedEvent verify(String rawPayload, String signatureHeader);

    record VerifiedEvent(
            String id,
            String type,
            String paymentIntentId,
            String connectedAccountId,
            boolean liveMode,
            AccountStatus accountStatus) {

        public VerifiedEvent(
                String id, String type, String paymentIntentId, String connectedAccountId, boolean liveMode) {
            this(id, type, paymentIntentId, connectedAccountId, liveMode, null);
        }
    }

    record AccountStatus(boolean chargesEnabled, boolean payoutsEnabled, java.time.OffsetDateTime occurredAt) {}
}
