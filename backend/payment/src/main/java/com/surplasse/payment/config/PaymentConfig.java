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

    /** Stripe secret key (test mode in dev), from STRIPE_SECRET_KEY. */
    Optional<String> stripeSecretKey();

    /** Stripe webhook signing secret, from STRIPE_WEBHOOK_SECRET. */
    Optional<String> stripeWebhookSecret();
}
