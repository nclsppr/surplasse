package com.surplasse.identity.repository;

import com.surplasse.identity.entity.MagicLinkSession;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class MagicLinkSessionRepository implements PanacheRepositoryBase<MagicLinkSession, UUID> {

    public Optional<MagicLinkSession> findByTokenHashForUpdate(String tokenHash) {
        return find("tokenHash = ?1", tokenHash)
                .withLock(LockModeType.PESSIMISTIC_WRITE)
                .firstResultOptional();
    }

    public long invalidateUnused(UUID restaurateurId, Instant now) {
        return update(
                "invalidatedAt = ?1 where restaurateurId = ?2 and consumedAt is null and invalidatedAt is null and expiresAt > ?1",
                now,
                restaurateurId);
    }

    public long deleteExpiredBefore(Instant cutoff) {
        return delete("expiresAt < ?1", cutoff);
    }
}
