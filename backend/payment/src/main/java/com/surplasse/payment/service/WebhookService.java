package com.surplasse.payment.service;

import com.surplasse.common.event.OrderPaid;
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
    private final StripeWebhookEventRepository processedEvents;
    private final PaymentRepository paymentRepository;
    private final Event<OrderPaid> orderPaid;

    WebhookService(
            StripeEventVerifier verifier,
            StripeWebhookEventRepository processedEvents,
            PaymentRepository paymentRepository,
            Event<OrderPaid> orderPaid) {
        this.verifier = verifier;
        this.processedEvents = processedEvents;
        this.paymentRepository = paymentRepository;
        this.orderPaid = orderPaid;
    }

    /**
     * Verifies, deduplicates and processes one webhook delivery. Short
     * transaction recording the fact; the slow consequences (SSE broadcast)
     * run on the post-commit OrderPaid observation.
     */
    @Transactional
    public void process(String rawPayload, String signatureHeader) {
        StripeEventVerifier.VerifiedEvent event = verifier.verify(rawPayload, signatureHeader);

        if (processedEvents.findByIdOptional(event.id()).isPresent()) {
            LOG.debugf("Webhook event %s already processed, acknowledged without effect", event.id());
            return;
        }
        processedEvents.persist(new StripeWebhookEvent(event.id(), event.type(), OffsetDateTime.now(ZoneOffset.UTC)));

        switch (event.type()) {
            case "payment_intent.succeeded" -> onIntentSucceeded(event);
            case "payment_intent.payment_failed" -> onIntentFailed(event);
            default -> LOG.debugf("Webhook event type %s ignored", event.type());
        }
    }

    private void onIntentSucceeded(StripeEventVerifier.VerifiedEvent event) {
        Optional<Payment> found = findPayment(event);
        if (found.isEmpty()) {
            return;
        }
        Payment payment = found.get();
        if (payment.getStatus() != PaymentStatus.PENDING) {
            LOG.infof("Payment %s already %s, webhook ignored", payment.getId(), payment.getStatus());
            return;
        }
        payment.markSucceeded();
        orderPaid.fire(new OrderPaid(payment.getOrderId(), payment.getEstablishmentId()));
    }

    private void onIntentFailed(StripeEventVerifier.VerifiedEvent event) {
        findPayment(event).ifPresent(payment -> {
            if (payment.getStatus() == PaymentStatus.PENDING) {
                payment.markFailed();
            }
        });
    }

    private Optional<Payment> findPayment(StripeEventVerifier.VerifiedEvent event) {
        if (event.paymentIntentId() == null) {
            LOG.warnf("Webhook event %s carries no payment intent id", event.id());
            return Optional.empty();
        }
        Optional<Payment> payment = paymentRepository.findByExternalReference(event.paymentIntentId());
        if (payment.isEmpty()) {
            LOG.warnf("Webhook event %s references unknown intent %s", event.id(), event.paymentIntentId());
        }
        return payment;
    }
}
