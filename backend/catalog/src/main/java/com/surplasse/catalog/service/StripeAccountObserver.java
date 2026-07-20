package com.surplasse.catalog.service;

import com.surplasse.catalog.repository.EstablishmentRepository;
import com.surplasse.common.event.StripeAccountUpdated;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

/** Applies signed Stripe capability updates to the establishment routing snapshot. */
@ApplicationScoped
public class StripeAccountObserver {

    private static final Logger LOG = Logger.getLogger(StripeAccountObserver.class);

    private final EstablishmentRepository establishments;

    StripeAccountObserver(EstablishmentRepository establishments) {
        this.establishments = establishments;
    }

    @Transactional
    void onStripeAccountUpdated(@Observes StripeAccountUpdated event) {
        establishments
                .findByStripeAccountIdForUpdate(event.connectedAccountId())
                .ifPresentOrElse(
                        establishment -> {
                            if (establishment.updateStripeCapabilities(
                                    event.chargesEnabled(), event.payoutsEnabled(), event.occurredAt())) {
                                establishments.flush();
                            }
                        },
                        () -> LOG.warnf(
                                "Stripe account update ignored for unknown account %s", event.connectedAccountId()));
    }
}
