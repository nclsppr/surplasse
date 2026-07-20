package com.surplasse.catalog.service;

import com.surplasse.catalog.entity.Establishment;
import com.surplasse.catalog.entity.EstablishmentStatus;
import com.surplasse.catalog.entity.OrderIntakeStatus;
import com.surplasse.catalog.repository.EstablishmentRepository;
import com.surplasse.catalog.repository.MenuRepository;
import com.surplasse.catalog.repository.TableQrRepository;
import com.surplasse.common.error.BusinessRuleException;
import com.surplasse.common.error.NotFoundException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/** Owns the operational switch and all prerequisites needed to open it. */
@ApplicationScoped
public class OrderIntakeService {

    private final EstablishmentRepository establishmentRepository;
    private final MenuRepository menuRepository;
    private final TableQrRepository tableQrRepository;

    OrderIntakeService(
            EstablishmentRepository establishmentRepository,
            MenuRepository menuRepository,
            TableQrRepository tableQrRepository) {
        this.establishmentRepository = establishmentRepository;
        this.menuRepository = menuRepository;
        this.tableQrRepository = tableQrRepository;
    }

    @Transactional
    public State get(UUID establishmentId, UUID restaurateurId) {
        Establishment establishment = establishmentRepository
                .findOwned(establishmentId, restaurateurId)
                .orElseThrow(OrderIntakeService::notFound);
        return stateOf(establishment);
    }

    @Transactional
    public State update(UUID establishmentId, UUID restaurateurId, OrderIntakeStatus desiredStatus) {
        Establishment establishment = establishmentRepository
                .findOwnedForUpdate(establishmentId, restaurateurId)
                .orElseThrow(OrderIntakeService::notFound);

        boolean changed;
        if (desiredStatus == OrderIntakeStatus.PAUSED) {
            changed = establishment.pauseOrderIntake(now());
        } else {
            requireReadyToOpen(establishment);
            changed = establishment.openOrderIntake(now());
        }
        if (changed) {
            establishmentRepository.flush();
        }
        return stateOf(establishment);
    }

    private State stateOf(Establishment establishment) {
        boolean configurationReady = configurationReady(establishment.getId());
        OrderIntakeBlockReason blockedReason = blockedReason(establishment, configurationReady);
        return new State(
                establishment.getId(),
                establishment.getOrderIntakeStatus(),
                blockedReason == null,
                blockedReason,
                establishment.getOrderIntakeUpdatedAt());
    }

    private OrderIntakeBlockReason blockedReason(Establishment establishment, boolean configurationReady) {
        if (!establishment.isOrderIntakeOpen()) {
            return OrderIntakeBlockReason.PAUSED;
        }
        if (establishment.getStatus() != EstablishmentStatus.ACTIVE) {
            return OrderIntakeBlockReason.ESTABLISHMENT_NOT_ACTIVE;
        }
        if (!configurationReady) {
            return OrderIntakeBlockReason.CONFIGURATION_UNAVAILABLE;
        }
        if (!establishment.hasLifecycleAndPaymentReadiness()) {
            return OrderIntakeBlockReason.PAYMENTS_UNAVAILABLE;
        }
        return null;
    }

    private void requireReadyToOpen(Establishment establishment) {
        if (establishment.getStatus() != EstablishmentStatus.ACTIVE) {
            throw BusinessRuleException.orderIntakeEstablishmentNotActive();
        }
        if (!menuRepository.hasPublishedByEstablishment(establishment.getId())) {
            throw BusinessRuleException.orderIntakeConfigurationUnavailable(
                    "A published menu is required before accepting orders.");
        }
        if (!tableQrRepository.hasActiveByEstablishment(establishment.getId())) {
            throw BusinessRuleException.orderIntakeConfigurationUnavailable(
                    "At least one active table is required before accepting orders.");
        }
        if (!paymentsReady(establishment)) {
            throw BusinessRuleException.orderIntakePaymentsUnavailable();
        }
    }

    private boolean configurationReady(UUID establishmentId) {
        return menuRepository.hasPublishedByEstablishment(establishmentId)
                && tableQrRepository.hasActiveByEstablishment(establishmentId);
    }

    private static boolean paymentsReady(Establishment establishment) {
        return establishment.getStripeAccountId() != null
                && !establishment.getStripeAccountId().isBlank()
                && establishment.isStripeChargesEnabled()
                && establishment.getActivatedAt() != null;
    }

    private static NotFoundException notFound() {
        return new NotFoundException("The establishment does not exist or is not accessible.");
    }

    private static OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }

    public record State(
            UUID establishmentId,
            OrderIntakeStatus status,
            boolean acceptingOrders,
            OrderIntakeBlockReason blockedReason,
            OffsetDateTime updatedAt) {}
}
