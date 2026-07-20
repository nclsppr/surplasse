package com.surplasse.payment.repository;

import com.surplasse.payment.entity.RefundRequest;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.UUID;

@ApplicationScoped
public class RefundRequestRepository implements PanacheRepositoryBase<RefundRequest, UUID> {

    /** Serializes one key even when concurrent requests carry different payloads. */
    public void lockIdempotencyKey(UUID idempotencyKey) {
        long lockKey = idempotencyKey.getMostSignificantBits() ^ idempotencyKey.getLeastSignificantBits();
        getEntityManager()
                .createNativeQuery("select pg_advisory_xact_lock(?1)")
                .setParameter(1, lockKey)
                .getSingleResult();
    }
}
