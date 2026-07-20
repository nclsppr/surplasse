package com.surplasse.payment.mapping;

import com.surplasse.contract.model.PaymentSession;
import com.surplasse.contract.model.Refund;
import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.entity.PaymentRefund;

/** Transports payment entities to the DTOs of the contract. Computes nothing. */
public final class PaymentMapper {

    private PaymentMapper() {}

    public static PaymentSession toPaymentSession(Payment payment) {
        return new PaymentSession()
                .id(payment.getId())
                .orderId(payment.getOrderId())
                .amountCents(payment.getAmountCents())
                .currency(payment.getCurrency())
                .clientSecret(payment.getClientSecret())
                .connectedAccountId(payment.getConnectedAccountId());
    }

    public static Refund toRefund(PaymentRefund refund) {
        String publicStatus = refund.getStatus().dbValue();
        if (refund.getStatus() == com.surplasse.payment.entity.RefundStatus.CREATING) {
            publicStatus = "pending";
        }
        return new Refund()
                .id(refund.getId())
                .orderId(refund.getOrderId())
                .amountCents(refund.getAmountCents())
                .applicationFeeRefundedCents(refund.getApplicationFeeAmount())
                .currency(refund.getCurrency())
                .reason(Refund.ReasonEnum.fromValue(refund.getReason().dbValue()))
                .status(Refund.StatusEnum.fromValue(publicStatus));
    }
}
