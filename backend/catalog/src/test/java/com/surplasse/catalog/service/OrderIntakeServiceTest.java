package com.surplasse.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.catalog.entity.Establishment;
import com.surplasse.catalog.entity.EstablishmentStatus;
import com.surplasse.catalog.entity.OrderIntakeStatus;
import com.surplasse.catalog.repository.EstablishmentRepository;
import com.surplasse.catalog.repository.MenuRepository;
import com.surplasse.catalog.repository.TableQrRepository;
import com.surplasse.common.error.BusinessRuleException;
import com.surplasse.common.error.NotFoundException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OrderIntakeServiceTest {

    private static final UUID RESTAURATEUR = UUID.randomUUID();
    private static final UUID ESTABLISHMENT_ID = UUID.randomUUID();

    private EstablishmentRepository establishmentRepository;
    private MenuRepository menuRepository;
    private TableQrRepository tableQrRepository;
    private OrderIntakeService service;

    @BeforeEach
    void setUp() {
        establishmentRepository = mock(EstablishmentRepository.class);
        menuRepository = mock(MenuRepository.class);
        tableQrRepository = mock(TableQrRepository.class);
        service = new OrderIntakeService(establishmentRepository, menuRepository, tableQrRepository);
        when(menuRepository.hasPublishedByEstablishment(ESTABLISHMENT_ID)).thenReturn(true);
        when(tableQrRepository.hasActiveByEstablishment(ESTABLISHMENT_ID)).thenReturn(true);
    }

    @Test
    void update_readyEstablishment_opensIdempotentlyWithoutMovingTimestamp() {
        Establishment establishment = readyEstablishment();
        when(establishmentRepository.findOwnedForUpdate(ESTABLISHMENT_ID, RESTAURATEUR))
                .thenReturn(Optional.of(establishment));

        OrderIntakeService.State opened = service.update(ESTABLISHMENT_ID, RESTAURATEUR, OrderIntakeStatus.OPEN);
        OrderIntakeService.State replayed = service.update(ESTABLISHMENT_ID, RESTAURATEUR, OrderIntakeStatus.OPEN);

        assertEquals(OrderIntakeStatus.OPEN, opened.status());
        assertTrue(opened.acceptingOrders());
        assertEquals(opened.updatedAt(), replayed.updatedAt());
        verify(establishmentRepository).flush();
    }

    @Test
    void update_pauseIsAlwaysAllowedAndIdempotent() {
        Establishment establishment = new Establishment(
                ESTABLISHMENT_ID, RESTAURATEUR, "Le Cormoran", "le-cormoran", null, EstablishmentStatus.SUSPENDED);
        establishment.openOrderIntake(OffsetDateTime.parse("2026-07-20T10:00:00Z"));
        when(establishmentRepository.findOwnedForUpdate(ESTABLISHMENT_ID, RESTAURATEUR))
                .thenReturn(Optional.of(establishment));
        when(menuRepository.hasPublishedByEstablishment(ESTABLISHMENT_ID)).thenReturn(false);
        when(tableQrRepository.hasActiveByEstablishment(ESTABLISHMENT_ID)).thenReturn(false);

        OrderIntakeService.State paused = service.update(ESTABLISHMENT_ID, RESTAURATEUR, OrderIntakeStatus.PAUSED);
        OrderIntakeService.State replayed = service.update(ESTABLISHMENT_ID, RESTAURATEUR, OrderIntakeStatus.PAUSED);

        assertEquals(OrderIntakeStatus.PAUSED, paused.status());
        assertFalse(paused.acceptingOrders());
        assertEquals(OrderIntakeBlockReason.PAUSED, paused.blockedReason());
        assertEquals(paused.updatedAt(), replayed.updatedAt());
        verify(establishmentRepository).flush();
    }

    @Test
    void update_openWhileLifecycleIsNotActive_isRejected() {
        Establishment establishment = new Establishment(
                ESTABLISHMENT_ID, RESTAURATEUR, "Le Cormoran", "le-cormoran", null, EstablishmentStatus.SUSPENDED);
        when(establishmentRepository.findOwnedForUpdate(ESTABLISHMENT_ID, RESTAURATEUR))
                .thenReturn(Optional.of(establishment));

        BusinessRuleException error = assertThrows(
                BusinessRuleException.class,
                () -> service.update(ESTABLISHMENT_ID, RESTAURATEUR, OrderIntakeStatus.OPEN));

        assertEquals("order-intake-establishment-not-active", error.problemType());
        verify(menuRepository, never()).hasPublishedByEstablishment(ESTABLISHMENT_ID);
    }

    @Test
    void update_openWithoutPublishedMenu_isRejected() {
        Establishment establishment = readyEstablishment();
        when(establishmentRepository.findOwnedForUpdate(ESTABLISHMENT_ID, RESTAURATEUR))
                .thenReturn(Optional.of(establishment));
        when(menuRepository.hasPublishedByEstablishment(ESTABLISHMENT_ID)).thenReturn(false);

        BusinessRuleException error = assertThrows(
                BusinessRuleException.class,
                () -> service.update(ESTABLISHMENT_ID, RESTAURATEUR, OrderIntakeStatus.OPEN));

        assertEquals("order-intake-configuration-unavailable", error.problemType());
        verify(establishmentRepository, never()).flush();
    }

    @Test
    void update_openWithoutActiveTable_isRejected() {
        Establishment establishment = readyEstablishment();
        when(establishmentRepository.findOwnedForUpdate(ESTABLISHMENT_ID, RESTAURATEUR))
                .thenReturn(Optional.of(establishment));
        when(tableQrRepository.hasActiveByEstablishment(ESTABLISHMENT_ID)).thenReturn(false);

        BusinessRuleException error = assertThrows(
                BusinessRuleException.class,
                () -> service.update(ESTABLISHMENT_ID, RESTAURATEUR, OrderIntakeStatus.OPEN));

        assertEquals("order-intake-configuration-unavailable", error.problemType());
    }

    @Test
    void update_openWithoutStripeCharges_isRejected() {
        Establishment establishment = new Establishment(
                ESTABLISHMENT_ID,
                RESTAURATEUR,
                "Le Cormoran",
                "le-cormoran",
                null,
                EstablishmentStatus.ACTIVE,
                "acct_test_restaurant",
                false,
                true,
                OffsetDateTime.parse("2026-07-01T10:00:00Z"));
        when(establishmentRepository.findOwnedForUpdate(ESTABLISHMENT_ID, RESTAURATEUR))
                .thenReturn(Optional.of(establishment));

        BusinessRuleException error = assertThrows(
                BusinessRuleException.class,
                () -> service.update(ESTABLISHMENT_ID, RESTAURATEUR, OrderIntakeStatus.OPEN));

        assertEquals("order-intake-payments-unavailable", error.problemType());
    }

    @Test
    void get_configurationRemovedAfterOpening_reportsEffectiveBlock() {
        Establishment establishment = readyEstablishment();
        establishment.openOrderIntake(OffsetDateTime.parse("2026-07-20T10:00:00Z"));
        when(establishmentRepository.findOwned(ESTABLISHMENT_ID, RESTAURATEUR)).thenReturn(Optional.of(establishment));
        when(tableQrRepository.hasActiveByEstablishment(ESTABLISHMENT_ID)).thenReturn(false);

        OrderIntakeService.State state = service.get(ESTABLISHMENT_ID, RESTAURATEUR);

        assertEquals(OrderIntakeStatus.OPEN, state.status());
        assertFalse(state.acceptingOrders());
        assertEquals(OrderIntakeBlockReason.CONFIGURATION_UNAVAILABLE, state.blockedReason());
    }

    @Test
    void get_outsideRestaurateurScope_yieldsIndistinguishable404() {
        when(establishmentRepository.findOwned(ESTABLISHMENT_ID, RESTAURATEUR)).thenReturn(Optional.empty());

        NotFoundException error =
                assertThrows(NotFoundException.class, () -> service.get(ESTABLISHMENT_ID, RESTAURATEUR));

        assertEquals("resource-not-found", error.problemType());
        verify(menuRepository, never()).hasPublishedByEstablishment(ESTABLISHMENT_ID);
    }

    private static Establishment readyEstablishment() {
        return new Establishment(
                ESTABLISHMENT_ID,
                RESTAURATEUR,
                "Le Cormoran",
                "le-cormoran",
                null,
                EstablishmentStatus.ACTIVE,
                "acct_test_restaurant",
                true,
                true,
                OffsetDateTime.parse("2026-07-01T10:00:00Z"));
    }
}
