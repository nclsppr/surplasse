package com.surplasse.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.catalog.entity.Establishment;
import com.surplasse.catalog.entity.EstablishmentStatus;
import com.surplasse.catalog.entity.OrderIntakeStatus;
import com.surplasse.catalog.repository.EstablishmentRepository;
import com.surplasse.common.event.StripeAccountUpdated;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StripeAccountObserverTest {

    private static final OffsetDateTime NEWER = OffsetDateTime.parse("2099-07-20T10:00:01Z");
    private static final OffsetDateTime OLDER = OffsetDateTime.parse("2099-07-20T10:00:00Z");
    private static final OffsetDateTime PROCESSED_AT = OffsetDateTime.parse("2099-07-20T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(PROCESSED_AT.toInstant(), ZoneOffset.UTC);

    @Test
    void onStripeAccountUpdated_knownAccount_updatesBothCapabilities() {
        EstablishmentRepository establishments = mock(EstablishmentRepository.class);
        Establishment establishment = new Establishment(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Le Cormoran",
                "le-cormoran",
                null,
                EstablishmentStatus.ACTIVE,
                "acct_test_restaurant",
                true,
                false,
                OffsetDateTime.parse("2026-07-20T10:00:00Z"));
        establishment.openOrderIntake(OLDER);
        when(establishments.findByStripeAccountIdForUpdate("acct_test_restaurant"))
                .thenReturn(Optional.of(establishment));
        StripeAccountObserver observer = new StripeAccountObserver(establishments, CLOCK);

        observer.onStripeAccountUpdated(new StripeAccountUpdated("acct_test_restaurant", false, true, NEWER));

        assertFalse(establishment.isStripeCardPaymentsActive());
        assertTrue(establishment.isStripePayoutsActive());
        assertEquals(OrderIntakeStatus.PAUSED, establishment.getOrderIntakeStatus());
        assertEquals(PROCESSED_AT, establishment.getOrderIntakeUpdatedAt());
        verify(establishments).flush();
    }

    @Test
    void onStripeAccountUpdated_olderDelivery_cannotReenableCharges() {
        EstablishmentRepository establishments = mock(EstablishmentRepository.class);
        Establishment establishment = new Establishment(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Le Cormoran",
                "le-cormoran",
                null,
                EstablishmentStatus.ACTIVE,
                "acct_test_restaurant",
                true,
                true,
                OffsetDateTime.parse("2026-07-20T09:00:00Z"));
        establishment.openOrderIntake(OLDER);
        when(establishments.findByStripeAccountIdForUpdate("acct_test_restaurant"))
                .thenReturn(Optional.of(establishment));
        StripeAccountObserver observer = new StripeAccountObserver(establishments, CLOCK);

        observer.onStripeAccountUpdated(new StripeAccountUpdated("acct_test_restaurant", false, true, NEWER));
        observer.onStripeAccountUpdated(new StripeAccountUpdated("acct_test_restaurant", true, true, OLDER));

        assertFalse(establishment.isStripeCardPaymentsActive());
        assertEquals(OrderIntakeStatus.PAUSED, establishment.getOrderIntakeStatus());
    }

    @Test
    void onStripeAccountUpdated_chargesReenabled_neverAutoOpensIntake() {
        EstablishmentRepository establishments = mock(EstablishmentRepository.class);
        Establishment establishment = new Establishment(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Le Cormoran",
                "le-cormoran",
                null,
                EstablishmentStatus.ACTIVE,
                "acct_test_restaurant",
                false,
                true,
                OffsetDateTime.parse("2026-07-20T09:00:00Z"));
        when(establishments.findByStripeAccountIdForUpdate("acct_test_restaurant"))
                .thenReturn(Optional.of(establishment));
        StripeAccountObserver observer = new StripeAccountObserver(establishments, CLOCK);

        observer.onStripeAccountUpdated(new StripeAccountUpdated("acct_test_restaurant", true, true, NEWER));

        assertTrue(establishment.isStripeCardPaymentsActive());
        assertEquals(OrderIntakeStatus.PAUSED, establishment.getOrderIntakeStatus());
    }

    @Test
    void onStripeAccountUpdated_delayedRemoval_usesEventTimeForFreshnessAndProcessingTimeForPause() {
        EstablishmentRepository establishments = mock(EstablishmentRepository.class);
        Establishment establishment = new Establishment(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Le Cormoran",
                "le-cormoran",
                null,
                EstablishmentStatus.ACTIVE,
                "acct_test_restaurant",
                true,
                true,
                OffsetDateTime.parse("2026-07-20T08:00:00Z"));
        OffsetDateTime openedAt = OffsetDateTime.parse("2099-07-20T11:00:00Z");
        OffsetDateTime eventOccurredAt = OffsetDateTime.parse("2099-07-20T09:00:00Z");
        establishment.openOrderIntake(openedAt);
        when(establishments.findByStripeAccountIdForUpdate("acct_test_restaurant"))
                .thenReturn(Optional.of(establishment));
        StripeAccountObserver observer = new StripeAccountObserver(establishments, CLOCK);

        observer.onStripeAccountUpdated(new StripeAccountUpdated("acct_test_restaurant", false, true, eventOccurredAt));

        assertEquals(eventOccurredAt, establishment.getStripeCapabilitiesUpdatedAt());
        assertEquals(OrderIntakeStatus.PAUSED, establishment.getOrderIntakeStatus());
        assertEquals(PROCESSED_AT, establishment.getOrderIntakeUpdatedAt());
        assertTrue(establishment.getOrderIntakeUpdatedAt().isAfter(openedAt));
    }
}
