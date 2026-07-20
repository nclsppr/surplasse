package com.surplasse.payment.provider;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
import com.surplasse.payment.entity.RefundReason;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StripeRefundProviderTest {

    private static final String CONNECTED_ACCOUNT = "acct_test_restaurant";

    private RefundProvider.RefundRequest request(int applicationFeeAmount) {
        return new RefundProvider.RefundRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "pi_1",
                CONNECTED_ACCOUNT,
                applicationFeeAmount,
                RefundReason.RESTAURANT_REFUSAL,
                UUID.randomUUID());
    }

    @Test
    void createParams_fullRefund_usesIntentAndReconciliationMetadata() {
        RefundProvider.RefundRequest request = request(0);

        RefundCreateParams params = StripeRefundProvider.createParams(request);

        assertEquals("pi_1", params.getPaymentIntent());
        assertNull(params.getAmount());
        assertNull(params.getRefundApplicationFee());
        Map<?, ?> metadata = (Map<?, ?>) params.getMetadata();
        assertEquals(request.refundId().toString(), metadata.get("refund_id"));
        assertEquals(request.paymentId().toString(), metadata.get("payment_id"));
        assertEquals(request.orderId().toString(), metadata.get("order_id"));
        assertEquals(request.establishmentId().toString(), metadata.get("establishment_id"));
        assertEquals("restaurant_refusal", metadata.get("surplasse_reason"));
    }

    @Test
    void createParams_paidPeriod_returnsTheApplicationFee() {
        RefundCreateParams params = StripeRefundProvider.createParams(request(22));

        assertTrue(params.getRefundApplicationFee());
    }

    @Test
    void requestOptions_scopeToConnectedAccountAndKeepOneStripeOperation() {
        RefundProvider.RefundRequest request = request(22);

        RequestOptions options = StripeRefundProvider.requestOptions(request);

        assertEquals(request.idempotencyKey().toString(), options.getIdempotencyKey());
        assertEquals(CONNECTED_ACCOUNT, options.getStripeAccount());
        assertEquals(2, options.getMaxNetworkRetries());
    }
}
