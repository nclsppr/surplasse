package com.surplasse.catalog.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.catalog.entity.Establishment;
import com.surplasse.catalog.entity.EstablishmentStatus;
import com.surplasse.catalog.repository.EstablishmentRepository;
import com.surplasse.common.event.StripeAccountUpdated;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StripeAccountObserverTest {

    private static final OffsetDateTime NEWER = OffsetDateTime.parse("2026-07-20T10:00:01Z");
    private static final OffsetDateTime OLDER = OffsetDateTime.parse("2026-07-20T10:00:00Z");

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
        when(establishments.findByStripeAccountIdForUpdate("acct_test_restaurant"))
                .thenReturn(Optional.of(establishment));
        StripeAccountObserver observer = new StripeAccountObserver(establishments);

        observer.onStripeAccountUpdated(new StripeAccountUpdated("acct_test_restaurant", false, true, NEWER));

        assertFalse(establishment.isStripeChargesEnabled());
        assertTrue(establishment.isStripePayoutsEnabled());
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
        when(establishments.findByStripeAccountIdForUpdate("acct_test_restaurant"))
                .thenReturn(Optional.of(establishment));
        StripeAccountObserver observer = new StripeAccountObserver(establishments);

        observer.onStripeAccountUpdated(new StripeAccountUpdated("acct_test_restaurant", false, true, NEWER));
        observer.onStripeAccountUpdated(new StripeAccountUpdated("acct_test_restaurant", true, true, OLDER));

        assertFalse(establishment.isStripeChargesEnabled());
    }
}
