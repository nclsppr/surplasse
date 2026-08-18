package com.surplasse.payment.config;

import io.smallrye.config.ConfigMapping;
import java.util.Optional;

/**
 * Configuration of the payment domain. Absent values mean Stripe is not
 * configured: the endpoints answer 503 dependency-unavailable with a clear
 * detail instead of failing at boot, so that a workstation without keys can
 * still run everything else.
 */
@ConfigMapping(prefix = "surplasse.payment")
public interface PaymentConfig {

    /** Stripe restricted key for the versioned release mode, from STRIPE_SECRET_KEY. */
    Optional<String> stripeSecretKey();

    /** Snapshot payment webhook signing secret, from STRIPE_PAYMENT_WEBHOOK_SECRET. */
    Optional<String> stripePaymentWebhookSecret();

    /** Thin Accounts v2 webhook signing secret, from STRIPE_ACCOUNT_WEBHOOK_SECRET. */
    Optional<String> stripeAccountWebhookSecret();

    /** Expected Stripe object mode. False in development, tests, and tester production. */
    boolean liveMode();
}
