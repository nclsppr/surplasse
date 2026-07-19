package com.surplasse.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.catalog.entity.Establishment;
import com.surplasse.catalog.entity.EstablishmentStatus;
import com.surplasse.catalog.repository.EstablishmentRepository;
import com.surplasse.common.catalog.EstablishmentAccessGateway.AccessibleEstablishment;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class EstablishmentAccessServiceTest {

    private EstablishmentRepository establishmentRepository;
    private EstablishmentAccessService service;

    @BeforeEach
    void setUp() {
        establishmentRepository = mock(EstablishmentRepository.class);
        service = new EstablishmentAccessService(establishmentRepository);
    }

    @Test
    void listAccessibleEstablishments_unsortedEntities_returnsReferencesSortedByNameThenId() {
        UUID restaurateurId = UUID.randomUUID();
        UUID alphaFirstId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID alphaSecondId = UUID.fromString("00000000-0000-0000-0000-000000000002");
        Establishment beta = establishment(UUID.randomUUID(), restaurateurId, "Beta", "beta");
        Establishment alphaSecond = establishment(alphaSecondId, restaurateurId, "Alpha", "alpha-second");
        Establishment alphaFirst = establishment(alphaFirstId, restaurateurId, "Alpha", "alpha-first");
        when(establishmentRepository.listByRestaurateur(restaurateurId))
                .thenReturn(List.of(beta, alphaSecond, alphaFirst));

        List<AccessibleEstablishment> result = service.listAccessibleEstablishments(restaurateurId);

        assertEquals(
                List.of(
                        new AccessibleEstablishment(alphaFirstId, "Alpha", "alpha-first"),
                        new AccessibleEstablishment(alphaSecondId, "Alpha", "alpha-second"),
                        new AccessibleEstablishment(beta.getId(), "Beta", "beta")),
                result);
    }

    @Test
    void canAccess_repositoryConfirmsMembership_returnsTrue() {
        UUID restaurateurId = UUID.randomUUID();
        UUID establishmentId = UUID.randomUUID();
        when(establishmentRepository.belongsToRestaurateur(establishmentId, restaurateurId))
                .thenReturn(true);

        assertTrue(service.canAccess(restaurateurId, establishmentId));
        verify(establishmentRepository).belongsToRestaurateur(establishmentId, restaurateurId);
    }

    @Test
    void canAccess_repositoryRejectsMembership_returnsFalse() {
        UUID restaurateurId = UUID.randomUUID();
        UUID establishmentId = UUID.randomUUID();

        assertFalse(service.canAccess(restaurateurId, establishmentId));
        verify(establishmentRepository).belongsToRestaurateur(establishmentId, restaurateurId);
    }

    private Establishment establishment(UUID id, UUID restaurateurId, String name, String slug) {
        return new Establishment(id, restaurateurId, name, slug, null, EstablishmentStatus.ACTIVE);
    }
}
