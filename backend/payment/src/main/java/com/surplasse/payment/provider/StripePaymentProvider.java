package com.surplasse.payment.provider;

import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import com.surplasse.common.error.BusinessRuleException;
import com.surplasse.common.error.DependencyUnavailableException;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Locale;
import org.jboss.logging.Logger;

@ApplicationScoped
public class StripePaymentProvider implements PaymentProvider {

    private static final Logger LOG = Logger.getLogger(StripePaymentProvider.class);

    private final StripeClientFactory clients;
    private final ConnectedAccountProvider connectedAccounts;

    StripePaymentProvider(StripeClientFactory clients, ConnectedAccountProvider connectedAccounts) {
        this.clients = clients;
        this.connectedAccounts = connectedAccounts;
    }

    @Override
    public PaymentIntentRef createIntent(PaymentIntentRequest request) {
        ConnectedAccountProvider.Capabilities capabilities =
                connectedAccounts.retrieveCapabilities(request.connectedAccountId());
        if (!capabilities.cardPaymentsActive()) {
            throw new BusinessRuleException("This establishment is not ready to accept payments.");
        }
        try {
            PaymentIntent intent =
                    clients.create().v1().paymentIntents().create(createParams(request), requestOptions(request));
            if (intent.getLivemode() == null || intent.getLivemode() != clients.liveMode()) {
                throw new DependencyUnavailableException("Stripe returned a payment intent from another mode.");
            }
            return new PaymentIntentRef(intent.getId(), intent.getClientSecret());
        } catch (com.stripe.exception.InvalidRequestException e) {
            LOG.errorf("Stripe rejected payment routing for order %s: %s", request.orderId(), e.getMessage());
            throw new BusinessRuleException("Stripe rejected the payment routing for this establishment.");
        } catch (StripeException e) {
            LOG.errorf("Stripe PaymentIntent creation failed for order %s: %s", request.orderId(), e.getMessage());
            throw new DependencyUnavailableException("Stripe did not answer.");
        }
    }

    static PaymentIntentCreateParams createParams(PaymentIntentRequest request) {
        PaymentIntentCreateParams.Builder params = PaymentIntentCreateParams.builder()
                .setAmount((long) request.amountCents())
                .setCurrency(request.currency().toLowerCase(Locale.ROOT))
                .setAutomaticPaymentMethods(PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                        .setEnabled(true)
                        .build())
                .putMetadata("payment_id", request.paymentId().toString())
                .putMetadata("order_id", request.orderId().toString())
                .putMetadata("establishment_id", request.establishmentId().toString());
        if (request.applicationFeeAmount() > 0) {
            params.setApplicationFeeAmount((long) request.applicationFeeAmount());
        }
        return params.build();
    }

    static RequestOptions requestOptions(PaymentIntentRequest request) {
        return RequestOptions.builder()
                .setIdempotencyKey(request.idempotencyKey().toString())
                .setStripeAccount(request.connectedAccountId())
                .setMaxNetworkRetries(2)
                .build();
    }
}
