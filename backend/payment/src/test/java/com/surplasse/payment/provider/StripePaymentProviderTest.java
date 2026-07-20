package com.surplasse.payment.provider;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import com.surplasse.common.error.DependencyUnavailableException;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StripePaymentProviderTest {

    private static final String CONNECTED_ACCOUNT = "acct_test_restaurant";

    private PaymentProvider.PaymentIntentRequest request(int applicationFeeAmount) {
        return new PaymentProvider.PaymentIntentRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                2250,
                "EUR",
                CONNECTED_ACCOUNT,
                applicationFeeAmount,
                UUID.randomUUID());
    }

    @Test
    void requestOptions_creationIsIdempotentAcrossBoundedNetworkRetries() {
        PaymentProvider.PaymentIntentRequest request = request(0);

        RequestOptions options = StripePaymentProvider.requestOptions(request);

        assertEquals(request.idempotencyKey().toString(), options.getIdempotencyKey());
        assertEquals(CONNECTED_ACCOUNT, options.getStripeAccount());
        assertEquals(2, options.getMaxNetworkRetries());
    }

    @Test
    void createParams_freePeriod_omitsApplicationFeeAndAddsReconciliationMetadata() {
        PaymentProvider.PaymentIntentRequest request = request(0);

        PaymentIntentCreateParams params = StripePaymentProvider.createParams(request);

        assertNull(params.getApplicationFeeAmount());
        assertEquals(request.paymentId().toString(), params.getMetadata().get("payment_id"));
        assertEquals(request.orderId().toString(), params.getMetadata().get("order_id"));
        assertEquals(request.establishmentId().toString(), params.getMetadata().get("establishment_id"));
    }

    @Test
    void createParams_paidPeriod_setsApplicationFee() {
        PaymentIntentCreateParams params = StripePaymentProvider.createParams(request(22));

        assertEquals(22L, params.getApplicationFeeAmount());
    }

    @Test
    void requireExpectedKeyMode_testEnvironment_rejectsLiveKey() {
        assertThrows(
                DependencyUnavailableException.class,
                () -> StripePaymentProvider.requireExpectedKeyMode("sk_live_example", false));
    }

    @Test
    void requireExpectedKeyMode_liveEnvironment_rejectsTestKey() {
        assertThrows(
                DependencyUnavailableException.class,
                () -> StripePaymentProvider.requireExpectedKeyMode("sk_test_example", true));
    }

    @Test
    void requireExpectedKeyMode_matchingModes_areAccepted() {
        StripePaymentProvider.requireExpectedKeyMode("sk_test_example", false);
        StripePaymentProvider.requireExpectedKeyMode("rk_live_example", true);
    }
}
