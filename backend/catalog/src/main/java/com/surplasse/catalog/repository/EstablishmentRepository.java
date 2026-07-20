package com.surplasse.catalog.repository;

import com.surplasse.catalog.entity.Establishment;
import com.surplasse.catalog.entity.EstablishmentStatus;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class EstablishmentRepository implements PanacheRepositoryBase<Establishment, UUID> {

    public Optional<Establishment> findActiveBySlug(String slug) {
        return find("slug = ?1 and status = ?2", slug, EstablishmentStatus.ACTIVE)
                .firstResultOptional();
    }

    public Optional<Establishment> findActiveBySlugForAdmission(String slug) {
        return find("slug = ?1 and status = ?2", slug, EstablishmentStatus.ACTIVE)
                .withLock(LockModeType.PESSIMISTIC_READ)
                .firstResultOptional();
    }

    public Optional<Establishment> findByIdForAdmission(UUID establishmentId) {
        return find("id", establishmentId)
                .withLock(LockModeType.PESSIMISTIC_READ)
                .firstResultOptional();
    }

    public Optional<Establishment> findOwned(UUID establishmentId, UUID restaurateurId) {
        return find("id = ?1 and restaurateurId = ?2", establishmentId, restaurateurId)
                .firstResultOptional();
    }

    public Optional<Establishment> findOwnedForUpdate(UUID establishmentId, UUID restaurateurId) {
        return find("id = ?1 and restaurateurId = ?2", establishmentId, restaurateurId)
                .withLock(LockModeType.PESSIMISTIC_WRITE)
                .firstResultOptional();
    }

    public List<Establishment> listByRestaurateur(UUID restaurateurId) {
        return list("restaurateurId", restaurateurId);
    }

    public boolean belongsToRestaurateur(UUID establishmentId, UUID restaurateurId) {
        return count("id = ?1 and restaurateurId = ?2", establishmentId, restaurateurId) > 0;
    }

    public Optional<Establishment> findByStripeAccountIdForUpdate(String stripeAccountId) {
        return find("stripeAccountId", stripeAccountId)
                .withLock(LockModeType.PESSIMISTIC_WRITE)
                .firstResultOptional();
    }
}
