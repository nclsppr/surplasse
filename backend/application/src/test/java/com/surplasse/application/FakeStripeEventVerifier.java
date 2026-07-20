package com.surplasse.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.surplasse.common.error.InvalidRequestException;
import com.surplasse.payment.provider.StripeEventVerifier;
import com.surplasse.payment.provider.StripeSignatureVerifier;
import io.quarkus.test.Mock;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Test double of the webhook signature verification: the literal signature
 * "test-signature" is valid, anything else is rejected, and the payload is
 * extracted exactly like the real implementation.
 */
@Mock
@ApplicationScoped
public class FakeStripeEventVerifier implements StripeEventVerifier {

    static final String VALID_SIGNATURE = "test-signature";

    private final ObjectMapper objectMapper;

    FakeStripeEventVerifier(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public VerifiedEvent verify(String rawPayload, String signatureHeader, Destination destination) {
        if (!VALID_SIGNATURE.equals(signatureHeader)) {
            throw new InvalidRequestException("Invalid Stripe-Signature header.");
        }
        return StripeSignatureVerifier.extract(rawPayload, objectMapper);
    }
}
