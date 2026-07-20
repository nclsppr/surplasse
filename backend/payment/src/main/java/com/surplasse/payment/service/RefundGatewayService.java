package com.surplasse.payment.service;

import com.surplasse.common.payment.RefundGateway;
import com.surplasse.payment.repository.PaymentRefundRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.UUID;

@ApplicationScoped
public class RefundGatewayService implements RefundGateway {

    private final PaymentRefundRepository refunds;

    RefundGatewayService(PaymentRefundRepository refunds) {
        this.refunds = refunds;
    }

    @Override
    public boolean hasInProgressRefund(UUID orderId, UUID establishmentId) {
        return refunds.hasInProgressByOrder(orderId, establishmentId);
    }
}
