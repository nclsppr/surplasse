package com.surplasse.payment.provider;

import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import com.surplasse.common.error.DependencyUnavailableException;
import com.surplasse.payment.config.PaymentConfig;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Locale;
import java.util.UUID;
import org.jboss.logging.Logger;

@ApplicationScoped
public class StripePaymentProvider implements PaymentProvider {

    private static final Logger LOG = Logger.getLogger(StripePaymentProvider.class);

    private final PaymentConfig config;

    StripePaymentProvider(PaymentConfig config) {
        this.config = config;
    }

    @Override
    public PaymentIntentRef createIntent(UUID orderId, int amountCents, String currency) {
        String secretKey = config.stripeSecretKey()
                .filter(key -> !key.isBlank())
                .orElseThrow(() -> new DependencyUnavailableException("Stripe is not configured (STRIPE_SECRET_KEY)."));
        try {
            StripeClient client = new StripeClient(secretKey);
            PaymentIntent intent = client.paymentIntents()
                    .create(PaymentIntentCreateParams.builder()
                            .setAmount((long) amountCents)
                            .setCurrency(currency.toLowerCase(Locale.ROOT))
                            .setAutomaticPaymentMethods(PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                                    .setEnabled(true)
                                    .build())
                            .putMetadata("order_id", orderId.toString())
                            .build());
            return new PaymentIntentRef(intent.getId(), intent.getClientSecret());
        } catch (StripeException e) {
            LOG.errorf("Stripe PaymentIntent creation failed for order %s: %s", orderId, e.getMessage());
            throw new DependencyUnavailableException("Stripe did not answer.");
        }
    }
}
