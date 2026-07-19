package com.surplasse.catalog.service;

import com.surplasse.catalog.entity.Establishment;
import com.surplasse.catalog.repository.EstablishmentRepository;
import com.surplasse.common.catalog.EstablishmentAccessGateway;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** Catalog side of the restaurateur-establishment access boundary. */
@ApplicationScoped
public class EstablishmentAccessService implements EstablishmentAccessGateway {

    private static final Comparator<Establishment> ACCESSIBLE_ESTABLISHMENT_ORDER =
            Comparator.comparing(Establishment::getName).thenComparing(Establishment::getId);

    private final EstablishmentRepository establishmentRepository;

    EstablishmentAccessService(EstablishmentRepository establishmentRepository) {
        this.establishmentRepository = establishmentRepository;
    }

    @Override
    public List<AccessibleEstablishment> listAccessibleEstablishments(UUID restaurateurId) {
        return establishmentRepository.listByRestaurateur(restaurateurId).stream()
                .sorted(ACCESSIBLE_ESTABLISHMENT_ORDER)
                .map(establishment -> new AccessibleEstablishment(
                        establishment.getId(), establishment.getName(), establishment.getSlug()))
                .toList();
    }

    @Override
    public boolean canAccess(UUID restaurateurId, UUID establishmentId) {
        return establishmentRepository.belongsToRestaurateur(establishmentId, restaurateurId);
    }
}
