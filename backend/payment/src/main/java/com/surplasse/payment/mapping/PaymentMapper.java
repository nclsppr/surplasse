package com.surplasse.payment.mapping;

import com.surplasse.contract.model.PaymentSession;
import com.surplasse.payment.entity.Payment;

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
}
