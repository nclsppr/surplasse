package com.surplasse.payment.repository;

import com.surplasse.payment.entity.PaymentRequest;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.UUID;

@ApplicationScoped
public class PaymentRequestRepository implements PanacheRepositoryBase<PaymentRequest, UUID> {

    /** Serializes the same client key even when two requests target different orders. */
    public void lockIdempotencyKey(UUID idempotencyKey) {
        long lockKey = idempotencyKey.getMostSignificantBits() ^ idempotencyKey.getLeastSignificantBits();
        getEntityManager()
                .createNativeQuery("select pg_advisory_xact_lock(?1)")
                .setParameter(1, lockKey)
                .getSingleResult();
    }
}
