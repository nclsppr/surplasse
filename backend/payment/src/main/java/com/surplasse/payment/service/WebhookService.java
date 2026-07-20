package com.surplasse.payment.service;

import com.surplasse.common.error.InvalidRequestException;
import com.surplasse.payment.config.PaymentConfig;
import com.surplasse.payment.provider.ConnectedAccountProvider;
import com.surplasse.payment.provider.StripeEventVerifier;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

/** Verifies Stripe deliveries and performs remote reads before opening the database transaction. */
@ApplicationScoped
public class WebhookService {

    private static final Logger LOG = Logger.getLogger(WebhookService.class);

    private final StripeEventVerifier verifier;
    private final PaymentConfig config;
    private final ConnectedAccountProvider connectedAccounts;
    private final WebhookEventProcessor processor;

    WebhookService(
            StripeEventVerifier verifier,
            PaymentConfig config,
            ConnectedAccountProvider connectedAccounts,
            WebhookEventProcessor processor) {
        this.verifier = verifier;
        this.config = config;
        this.connectedAccounts = connectedAccounts;
        this.processor = processor;
    }

    /** Verifies one delivery, refreshes Accounts v2 state, then applies it transactionally. */
    public void process(String rawPayload, String signatureHeader, StripeEventVerifier.Destination destination) {
        StripeEventVerifier.VerifiedEvent event = verifier.verify(rawPayload, signatureHeader, destination);
        if (event.liveMode() != config.liveMode()) {
            LOG.warnf("Webhook event %s belongs to another Stripe mode and is acknowledged without effect", event.id());
            return;
        }
        requireExpectedDestination(event, destination);
        ConnectedAccountProvider.Capabilities capabilities = event.refreshesConnectedAccountCapabilities()
                ? connectedAccounts.retrieveCapabilities(event.connectedAccountId())
                : null;
        processor.process(event, capabilities);
    }

    private static void requireExpectedDestination(
            StripeEventVerifier.VerifiedEvent event, StripeEventVerifier.Destination destination) {
        boolean accountEvent = event.refreshesConnectedAccountCapabilities();
        if ((destination == StripeEventVerifier.Destination.ACCOUNT_THIN) != accountEvent) {
            throw new InvalidRequestException("Stripe event type does not match this event destination.");
        }
    }
}
