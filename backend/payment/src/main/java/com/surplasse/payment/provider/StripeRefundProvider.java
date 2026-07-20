package com.surplasse.payment.provider;

import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
import com.surplasse.common.error.BusinessRuleException;
import com.surplasse.common.error.DependencyUnavailableException;
import com.surplasse.payment.entity.RefundStatus;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

@ApplicationScoped
public class StripeRefundProvider implements RefundProvider {

    private static final Logger LOG = Logger.getLogger(StripeRefundProvider.class);

    private final StripeClientFactory clients;

    StripeRefundProvider(StripeClientFactory clients) {
        this.clients = clients;
    }

    @Override
    public RefundRef createFullRefund(RefundRequest request) {
        try {
            Refund refund = clients.create().v1().refunds().create(createParams(request), requestOptions(request));
            RefundStatus status;
            try {
                status = RefundStatus.fromProviderValue(refund.getStatus());
            } catch (IllegalArgumentException e) {
                LOG.errorf(
                        "Stripe returned unknown refund status %s for order %s", refund.getStatus(), request.orderId());
                throw new DependencyUnavailableException("Stripe returned an unknown refund status.");
            }
            return new RefundRef(refund.getId(), status, refund.getFailureReason());
        } catch (com.stripe.exception.InvalidRequestException e) {
            LOG.errorf("Stripe rejected refund routing for order %s: %s", request.orderId(), e.getMessage());
            throw new BusinessRuleException("Stripe rejected the refund for this order.");
        } catch (StripeException e) {
            LOG.errorf("Stripe refund creation failed for order %s: %s", request.orderId(), e.getMessage());
            throw new DependencyUnavailableException("Stripe did not answer.");
        }
    }

    static RefundCreateParams createParams(RefundRequest request) {
        RefundCreateParams.Builder params = RefundCreateParams.builder()
                .setPaymentIntent(request.paymentIntentId())
                .putMetadata("refund_id", request.refundId().toString())
                .putMetadata("payment_id", request.paymentId().toString())
                .putMetadata("order_id", request.orderId().toString())
                .putMetadata("establishment_id", request.establishmentId().toString())
                .putMetadata("surplasse_reason", request.reason().dbValue());
        if (request.applicationFeeAmount() > 0) {
            params.setRefundApplicationFee(true);
        }
        return params.build();
    }

    static RequestOptions requestOptions(RefundRequest request) {
        return RequestOptions.builder()
                .setIdempotencyKey(request.idempotencyKey().toString())
                .setStripeAccount(request.connectedAccountId())
                .setMaxNetworkRetries(2)
                .build();
    }
}
