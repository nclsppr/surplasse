package com.surplasse.payment.service;

import com.surplasse.common.event.OrderPaid;
import com.surplasse.common.event.StripeAccountUpdated;
import com.surplasse.payment.config.PaymentConfig;
import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.entity.PaymentStatus;
import com.surplasse.payment.entity.StripeWebhookEvent;
import com.surplasse.payment.provider.StripeEventVerifier;
import com.surplasse.payment.repository.PaymentRepository;
import com.surplasse.payment.repository.StripeWebhookEventRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.jboss.logging.Logger;

@ApplicationScoped
public class WebhookService {

    private static final Logger LOG = Logger.getLogger(WebhookService.class);

    private final StripeEventVerifier verifier;
    private final PaymentConfig config;
    private final StripeWebhookEventRepository processedEvents;
    private final PaymentRepository paymentRepository;
    private final Event<OrderPaid> orderPaid;
    private final Event<StripeAccountUpdated> stripeAccountUpdated;

    WebhookService(
            StripeEventVerifier verifier,
            PaymentConfig config,
            StripeWebhookEventRepository processedEvents,
            PaymentRepository paymentRepository,
            Event<OrderPaid> orderPaid,
            Event<StripeAccountUpdated> stripeAccountUpdated) {
        this.verifier = verifier;
        this.config = config;
        this.processedEvents = processedEvents;
        this.paymentRepository = paymentRepository;
        this.orderPaid = orderPaid;
        this.stripeAccountUpdated = stripeAccountUpdated;
    }

    /**
     * Verifies, deduplicates and processes one webhook delivery. Durable
     * payment, order and event-log changes share this transaction; only the
     * in-memory SSE broadcast runs after a successful commit.
     */
    @Transactional
    public void process(String rawPayload, String signatureHeader) {
        StripeEventVerifier.VerifiedEvent event = verifier.verify(rawPayload, signatureHeader);

        if (event.liveMode() != config.liveMode()) {
            LOG.warnf("Webhook event %s belongs to another Stripe mode and is acknowledged without effect", event.id());
            return;
        }

        if (processedEvents.findByIdOptional(event.id()).isPresent()) {
            LOG.debugf("Webhook event %s already processed, acknowledged without effect", event.id());
            return;
        }
        processedEvents.persist(new StripeWebhookEvent(event.id(), event.type(), OffsetDateTime.now(ZoneOffset.UTC)));

        switch (event.type()) {
            case "payment_intent.succeeded" -> onIntentSucceeded(event);
            case "payment_intent.payment_failed" -> onIntentFailed(event);
            case "account.updated" -> onAccountUpdated(event);
            default -> LOG.debugf("Webhook event type %s ignored", event.type());
        }
    }

    private void onIntentSucceeded(StripeEventVerifier.VerifiedEvent event) {
        Optional<Payment> found = findPayment(event);
        if (found.isEmpty()) {
            return;
        }
        Payment payment = found.get();
        if (payment.getStatus() == PaymentStatus.SUCCEEDED || payment.getStatus() == PaymentStatus.REFUNDED) {
            LOG.infof("Payment %s already %s, webhook ignored", payment.getId(), payment.getStatus());
            return;
        }
        // Versions before V7 marked payment_failed as terminal even though
        // Stripe can later succeed the same PaymentIntent with another method.
        payment.markSucceeded();
        orderPaid.fire(new OrderPaid(payment.getOrderId(), payment.getEstablishmentId()));
    }

    private void onIntentFailed(StripeEventVerifier.VerifiedEvent event) {
        findPayment(event).ifPresent(payment -> {
            if (payment.getStatus() == PaymentStatus.PENDING) {
                // A PaymentIntent can emit payment_failed and still accept a
                // new payment method. Keep the session pending so the same
                // Payment Element can retry and a later succeeded event is
                // still authoritative.
                LOG.infof("Payment intent %s failed and remains retryable", event.paymentIntentId());
            }
        });
    }

    private void onAccountUpdated(StripeEventVerifier.VerifiedEvent event) {
        StripeEventVerifier.AccountStatus status = event.accountStatus();
        if (status == null || event.connectedAccountId() == null) {
            LOG.warnf("Stripe account event %s carries no capability snapshot", event.id());
            return;
        }
        stripeAccountUpdated.fire(new StripeAccountUpdated(
                event.connectedAccountId(), status.chargesEnabled(), status.payoutsEnabled(), status.occurredAt()));
    }

    private Optional<Payment> findPayment(StripeEventVerifier.VerifiedEvent event) {
        if (event.paymentIntentId() == null) {
            LOG.warnf("Webhook event %s carries no payment intent id", event.id());
            return Optional.empty();
        }
        if (event.connectedAccountId() == null || event.connectedAccountId().isBlank()) {
            LOG.warnf("Connect webhook event %s carries no connected account", event.id());
            return Optional.empty();
        }
        Optional<Payment> payment = paymentRepository.findByExternalReferenceAndAccount(
                event.paymentIntentId(), event.connectedAccountId());
        if (payment.isEmpty()) {
            LOG.warnf(
                    "Webhook event %s references unknown intent %s for account %s",
                    event.id(), event.paymentIntentId(), event.connectedAccountId());
        }
        return payment;
    }
}
