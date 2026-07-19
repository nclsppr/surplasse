package com.surplasse.identity.repository;

import com.surplasse.identity.entity.RefreshSession;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class RefreshSessionRepository implements PanacheRepositoryBase<RefreshSession, UUID> {

    public Optional<RefreshSession> findByTokenHashForUpdate(String tokenHash) {
        return find("tokenHash = ?1", tokenHash)
                .withLock(LockModeType.PESSIMISTIC_WRITE)
                .firstResultOptional();
    }

    public long revokeFamily(UUID familyId, Instant now) {
        return update("revokedAt = ?1 where familyId = ?2 and revokedAt is null", now, familyId);
    }

    public long deleteExpiredBefore(Instant cutoff) {
        return delete("expiresAt < ?1", cutoff);
    }
}
