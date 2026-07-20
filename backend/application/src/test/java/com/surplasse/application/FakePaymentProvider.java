package com.surplasse.application;

import com.surplasse.payment.provider.PaymentProvider;
import io.quarkus.test.Mock;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.UUID;

/**
 * Test double of the Stripe provider, at the module boundary
 * (docs/developpement/tests.md): deterministic references derived from the
 * order id, no network.
 */
@Mock
@ApplicationScoped
public class FakePaymentProvider implements PaymentProvider {

    @Override
    public PaymentIntentRef createIntent(UUID orderId, int amountCents, String currency, UUID idempotencyKey) {
        return new PaymentIntentRef("pi_fake_" + orderId, "pi_fake_secret_" + orderId);
    }
}
