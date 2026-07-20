package com.surplasse.payment.repository;

import com.surplasse.payment.entity.PaymentRefund;
import com.surplasse.payment.entity.RefundStatus;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class PaymentRefundRepository implements PanacheRepositoryBase<PaymentRefund, UUID> {

    public Optional<PaymentRefund> findActiveOrSucceededByPayment(UUID paymentId) {
        return find(
                        "paymentId = ?1 and status in ?2",
                        paymentId,
                        List.of(
                                RefundStatus.CREATING,
                                RefundStatus.PENDING,
                                RefundStatus.REQUIRES_ACTION,
                                RefundStatus.SUCCEEDED))
                .firstResultOptional();
    }

    public boolean hasInProgressByOrder(UUID orderId, UUID establishmentId) {
        return count(
                        "orderId = ?1 and establishmentId = ?2 and status in ?3",
                        orderId,
                        establishmentId,
                        List.of(RefundStatus.CREATING, RefundStatus.PENDING, RefundStatus.REQUIRES_ACTION))
                > 0;
    }

    public Optional<PaymentRefund> findByExternalReferenceAndAccount(
            String externalReference, String connectedAccountId) {
        return find("externalReference = ?1 and connectedAccountId = ?2", externalReference, connectedAccountId)
                .firstResultOptional();
    }

    public Optional<PaymentRefund> findByIdForUpdate(UUID refundId) {
        return find("id", refundId).withLock(LockModeType.PESSIMISTIC_WRITE).firstResultOptional();
    }
}
