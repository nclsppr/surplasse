package com.surplasse.payment.repository;

import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.entity.PaymentStatus;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class PaymentRepository implements PanacheRepositoryBase<Payment, UUID> {

    public Optional<Payment> findReusableByOrder(UUID orderId, UUID establishmentId) {
        return find(
                        "orderId = ?1 and establishmentId = ?2 and status in ?3",
                        orderId,
                        establishmentId,
                        java.util.List.of(PaymentStatus.CREATING, PaymentStatus.PENDING, PaymentStatus.FAILED))
                .firstResultOptional();
    }

    public boolean existsByOrder(UUID orderId, UUID establishmentId) {
        return count("orderId = ?1 and establishmentId = ?2", orderId, establishmentId) > 0;
    }

    public Optional<Payment> findByExternalReferenceAndAccount(String externalReference, String connectedAccountId) {
        return find("externalReference = ?1 and connectedAccountId = ?2", externalReference, connectedAccountId)
                .firstResultOptional();
    }

    public Optional<Payment> findByIdForUpdate(UUID paymentId) {
        return find("id", paymentId)
                .withLock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
                .firstResultOptional();
    }
}
