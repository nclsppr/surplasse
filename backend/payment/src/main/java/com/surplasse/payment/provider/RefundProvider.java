package com.surplasse.payment.provider;

import com.surplasse.payment.entity.RefundReason;
import com.surplasse.payment.entity.RefundStatus;
import java.util.UUID;

/** External boundary for full payment refunds. */
public interface RefundProvider {

    RefundRef createFullRefund(RefundRequest request);

    record RefundRequest(
            UUID refundId,
            UUID paymentId,
            UUID orderId,
            UUID establishmentId,
            String paymentIntentId,
            String connectedAccountId,
            int applicationFeeAmount,
            RefundReason reason,
            UUID idempotencyKey) {}

    record RefundRef(String externalReference, RefundStatus status, String failureReason) {}
}
