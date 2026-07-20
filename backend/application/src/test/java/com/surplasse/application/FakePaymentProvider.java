package com.surplasse.application;

import com.surplasse.payment.entity.RefundStatus;
import com.surplasse.payment.provider.PaymentProvider;
import com.surplasse.payment.provider.RefundProvider;
import io.quarkus.test.Mock;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Test double of the Stripe provider, at the module boundary
 * (docs/developpement/tests.md): deterministic references derived from the
 * order id, no network.
 */
@Mock
@ApplicationScoped
public class FakePaymentProvider implements PaymentProvider, RefundProvider {

    @Override
    public PaymentIntentRef createIntent(PaymentIntentRequest request) {
        return new PaymentIntentRef("pi_fake_" + request.orderId(), "pi_fake_secret_" + request.orderId());
    }

    @Override
    public RefundRef createFullRefund(RefundRequest request) {
        return new RefundRef("re_fake_" + request.orderId(), RefundStatus.SUCCEEDED, null);
    }
}
