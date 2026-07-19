package com.surplasse.catalog.repository;

import com.surplasse.catalog.entity.Establishment;
import com.surplasse.catalog.entity.EstablishmentStatus;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class EstablishmentRepository implements PanacheRepositoryBase<Establishment, UUID> {

    public Optional<Establishment> findActiveBySlug(String slug) {
        return find("slug = ?1 and status = ?2", slug, EstablishmentStatus.ACTIVE)
                .firstResultOptional();
    }

    public List<Establishment> listByRestaurateur(UUID restaurateurId) {
        return list("restaurateurId", restaurateurId);
    }

    public boolean belongsToRestaurateur(UUID establishmentId, UUID restaurateurId) {
        return count("id = ?1 and restaurateurId = ?2", establishmentId, restaurateurId) > 0;
    }
}
