package com.surplasse.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.catalog.entity.Establishment;
import com.surplasse.catalog.entity.EstablishmentStatus;
import com.surplasse.catalog.entity.TableQr;
import com.surplasse.catalog.repository.CategoryRepository;
import com.surplasse.catalog.repository.EstablishmentRepository;
import com.surplasse.catalog.repository.MenuRepository;
import com.surplasse.catalog.repository.OptionGroupRepository;
import com.surplasse.catalog.repository.OptionRepository;
import com.surplasse.catalog.repository.ProductRepository;
import com.surplasse.catalog.repository.TableQrRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CatalogGatewayServiceTest {

    private TableQrRepository tableQrRepository;
    private EstablishmentRepository establishmentRepository;
    private MenuRepository menuRepository;
    private CatalogGatewayService service;

    @BeforeEach
    void setUp() {
        tableQrRepository = mock(TableQrRepository.class);
        establishmentRepository = mock(EstablishmentRepository.class);
        menuRepository = mock(MenuRepository.class);
        service = new CatalogGatewayService(
                establishmentRepository,
                tableQrRepository,
                menuRepository,
                mock(CategoryRepository.class),
                mock(ProductRepository.class),
                mock(OptionGroupRepository.class),
                mock(OptionRepository.class));
    }

    @Test
    void findTableLabels_existingTables_returnsLabelsByIdentifier() {
        UUID establishmentId = UUID.randomUUID();
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        List<UUID> requestedIds = List.of(firstId, secondId);
        when(tableQrRepository.listByIds(requestedIds))
                .thenReturn(List.of(
                        new TableQr(firstId, establishmentId, "Table 1", "T1", true),
                        new TableQr(secondId, establishmentId, "Terrasse 2", "T2", true)));

        Map<UUID, String> result = service.findTableLabels(requestedIds);

        assertEquals(Map.of(firstId, "Table 1", secondId, "Terrasse 2"), result);
        verify(tableQrRepository).listByIds(requestedIds);
    }

    @Test
    void findTableLabels_emptyInput_returnsEmptyMap() {
        assertEquals(Map.of(), service.findTableLabels(List.of()));
        verify(tableQrRepository).listByIds(List.of());
    }

    @Test
    void lockOrderIntake_readyOpenEstablishment_returnsLockedAdmissionAndRouting() {
        UUID establishmentId = UUID.randomUUID();
        OffsetDateTime activatedAt = OffsetDateTime.parse("2026-07-20T10:00:00Z");
        Establishment establishment = new Establishment(
                establishmentId,
                UUID.randomUUID(),
                "Le Cormoran",
                "le-cormoran",
                null,
                EstablishmentStatus.ACTIVE,
                "acct_test_restaurant",
                true,
                false,
                activatedAt);
        establishment.openOrderIntake(OffsetDateTime.parse("2026-07-20T10:01:00Z"));
        when(establishmentRepository.findByIdForAdmission(establishmentId)).thenReturn(Optional.of(establishment));
        when(menuRepository.hasPublishedByEstablishment(establishmentId)).thenReturn(true);
        when(tableQrRepository.hasActiveByEstablishment(establishmentId)).thenReturn(true);

        var admission = service.lockOrderIntake(establishmentId).orElseThrow();
        var routing = admission.paymentRouting();

        assertTrue(admission.open());
        assertTrue(admission.acceptingOrders());
        assertEquals("acct_test_restaurant", routing.stripeAccountId());
        assertEquals(true, routing.cardPaymentsActive());
        assertEquals(false, routing.payoutsActive());
        assertEquals(activatedAt, routing.activatedAt());
    }

    @Test
    void lockOrderIntake_missingPublishedMenu_failsEffectiveAdmission() {
        UUID establishmentId = UUID.randomUUID();
        Establishment establishment = new Establishment(
                establishmentId,
                UUID.randomUUID(),
                "Le Cormoran",
                "le-cormoran",
                null,
                EstablishmentStatus.ACTIVE,
                "acct_test_restaurant",
                true,
                true,
                OffsetDateTime.parse("2026-07-20T10:00:00Z"));
        establishment.openOrderIntake(OffsetDateTime.parse("2026-07-20T10:01:00Z"));
        when(establishmentRepository.findByIdForAdmission(establishmentId)).thenReturn(Optional.of(establishment));
        when(tableQrRepository.hasActiveByEstablishment(establishmentId)).thenReturn(true);

        var admission = service.lockOrderIntake(establishmentId).orElseThrow();

        assertTrue(admission.open());
        assertFalse(admission.acceptingOrders());
    }
}
