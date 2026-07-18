package com.surplasse.payment.repository;

import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.entity.PaymentStatus;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class PaymentRepository implements PanacheRepositoryBase<Payment, UUID> {

    public Optional<Payment> findPendingByOrder(UUID orderId) {
        return find("orderId = ?1 and status = ?2", orderId, PaymentStatus.PENDING)
                .firstResultOptional();
    }

    public Optional<Payment> findByExternalReference(String externalReference) {
        return find("externalReference = ?1", externalReference).firstResultOptional();
    }
}
