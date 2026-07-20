package com.surplasse.payment.provider;

import com.stripe.StripeClient;
import com.surplasse.common.error.DependencyUnavailableException;
import com.surplasse.payment.config.PaymentConfig;
import jakarta.enterprise.context.ApplicationScoped;

/** Builds mode-safe Stripe clients from environment-owned credentials. */
@ApplicationScoped
public class StripeClientFactory {

    private final PaymentConfig config;

    StripeClientFactory(PaymentConfig config) {
        this.config = config;
    }

    StripeClient create() {
        String secretKey = config.stripeSecretKey()
                .filter(key -> !key.isBlank())
                .orElseThrow(() -> new DependencyUnavailableException("Stripe is not configured (STRIPE_SECRET_KEY)."));
        requireExpectedKeyMode(secretKey, config.liveMode());
        return StripeClient.builder()
                .setApiKey(secretKey)
                .setMaxNetworkRetries(2)
                .build();
    }

    boolean liveMode() {
        return config.liveMode();
    }

    static void requireExpectedKeyMode(String secretKey, boolean liveMode) {
        boolean testKey = secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_");
        boolean liveKey = secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
        if ((!testKey && !liveKey) || liveKey != liveMode) {
            throw new DependencyUnavailableException("Stripe key mode does not match this environment.");
        }
    }
}
