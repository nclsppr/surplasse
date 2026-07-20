package com.surplasse.payment.provider;

import java.util.UUID;

/**
 * Port of the payment provider, doubled at the module boundary in tests
 * (docs/developpement/tests.md): the real implementation talks to Stripe.
 */
public interface PaymentProvider {

    /** Creates a payment intent and returns its reference and client secret. */
    PaymentIntentRef createIntent(PaymentIntentRequest request);

    record PaymentIntentRequest(
            UUID paymentId,
            UUID orderId,
            UUID establishmentId,
            int amountCents,
            String currency,
            String connectedAccountId,
            int applicationFeeAmount,
            UUID idempotencyKey) {}

    record PaymentIntentRef(String externalReference, String clientSecret) {}
}
