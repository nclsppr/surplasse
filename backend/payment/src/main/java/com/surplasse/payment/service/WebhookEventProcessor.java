package com.surplasse.payment.service;

import com.surplasse.common.event.OrderPaid;
import com.surplasse.common.event.PaymentRefunded;
import com.surplasse.common.event.StripeAccountUpdated;
import com.surplasse.common.order.OrderGateway;
import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.entity.PaymentRefund;
import com.surplasse.payment.entity.PaymentStatus;
import com.surplasse.payment.entity.RefundStatus;
import com.surplasse.payment.entity.StripeWebhookEvent;
import com.surplasse.payment.provider.ConnectedAccountProvider;
import com.surplasse.payment.provider.StripeEventVerifier;
import com.surplasse.payment.repository.PaymentRepository;
import com.surplasse.payment.repository.PaymentRefundRepository;
import com.surplasse.payment.repository.StripeWebhookEventRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.jboss.logging.Logger;

/** Applies one verified Stripe event in a short database transaction. */
@ApplicationScoped
public class WebhookEventProcessor {

    private static final Logger LOG = Logger.getLogger(WebhookEventProcessor.class);

    private final StripeWebhookEventRepository processedEvents;
    private final PaymentRepository paymentRepository;
    private final PaymentRefundRepository refundRepository;
    private final OrderGateway orderGateway;
    private final Event<OrderPaid> orderPaid;
    private final Event<PaymentRefunded> paymentRefunded;
    private final Event<StripeAccountUpdated> stripeAccountUpdated;

    WebhookEventProcessor(
            StripeWebhookEventRepository processedEvents,
            PaymentRepository paymentRepository,
            PaymentRefundRepository refundRepository,
            OrderGateway orderGateway,
            Event<OrderPaid> orderPaid,
            Event<PaymentRefunded> paymentRefunded,
            Event<StripeAccountUpdated> stripeAccountUpdated) {
        this.processedEvents = processedEvents;
        this.paymentRepository = paymentRepository;
        this.refundRepository = refundRepository;
        this.orderGateway = orderGateway;
        this.orderPaid = orderPaid;
        this.paymentRefunded = paymentRefunded;
        this.stripeAccountUpdated = stripeAccountUpdated;
    }

    /** Deduplicates and applies a verified event after all Stripe network reads have completed. */
    @Transactional
    public void process(
            StripeEventVerifier.VerifiedEvent event, ConnectedAccountProvider.Capabilities accountCapabilities) {
        if (processedEvents.findByIdOptional(event.id()).isPresent()) {
            LOG.debugf("Webhook event %s already processed, acknowledged without effect", event.id());
            return;
        }
        processedEvents.persist(new StripeWebhookEvent(event.id(), event.type(), OffsetDateTime.now(ZoneOffset.UTC)));

        switch (event.type()) {
            case "payment_intent.succeeded" -> onIntentSucceeded(event);
            case "payment_intent.payment_failed" -> onIntentFailed(event);
            case "refund.created", "refund.updated", "refund.failed" -> onRefundChanged(event);
            default -> {
                if (event.refreshesConnectedAccountCapabilities()) {
                    onAccountUpdated(event, accountCapabilities);
                } else {
                    LOG.debugf("Webhook event type %s ignored", event.type());
                }
            }
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

    private void onAccountUpdated(
            StripeEventVerifier.VerifiedEvent event, ConnectedAccountProvider.Capabilities capabilities) {
        if (capabilities == null || event.connectedAccountId() == null || event.occurredAt() == null) {
            LOG.warnf("Stripe account event %s carries no authoritative capability snapshot", event.id());
            return;
        }
        stripeAccountUpdated.fire(new StripeAccountUpdated(
                event.connectedAccountId(),
                capabilities.cardPaymentsActive(),
                capabilities.payoutsActive(),
                event.occurredAt()));
    }

    private void onRefundChanged(StripeEventVerifier.VerifiedEvent event) {
        StripeEventVerifier.RefundData data = event.refund();
        if (data == null || event.paymentIntentId() == null) {
            LOG.warnf("Refund webhook event %s carries no refund data", event.id());
            return;
        }
        if (event.connectedAccountId() == null || event.connectedAccountId().isBlank()) {
            LOG.warnf("Connect refund event %s carries no connected account", event.id());
            return;
        }
        Optional<PaymentRefund> found = refundRepository.findByExternalReferenceAndAccount(
                data.externalReference(), event.connectedAccountId());
        if (found.isEmpty() && data.internalRefundId() != null) {
            found = refundRepository.findByIdOptional(data.internalRefundId());
        }
        if (found.isEmpty()) {
            LOG.warnf(
                    "Webhook event %s references unknown refund %s for account %s",
                    event.id(), data.externalReference(), event.connectedAccountId());
            return;
        }

        PaymentRefund snapshot = found.get();
        if (!event.connectedAccountId().equals(snapshot.getConnectedAccountId())) {
            LOG.warnf("Refund event %s account does not match local routing", event.id());
            return;
        }
        orderGateway.lockRefundableOrder(snapshot.getOrderId())
                .orElseThrow(() -> new IllegalStateException("A refund references an unknown order."));
        Payment payment = paymentRepository.findByIdForUpdate(snapshot.getPaymentId())
                .orElseThrow(() -> new IllegalStateException("A refund references an unknown payment."));
        PaymentRefund refund = refundRepository.findByIdForUpdate(snapshot.getId())
                .orElseThrow(() -> new IllegalStateException("A refund disappeared during reconciliation."));
        if (!event.paymentIntentId().equals(payment.getExternalReference())) {
            LOG.warnf("Refund event %s payment intent does not match local payment", event.id());
            return;
        }
        if (!refund.acceptsExternalReference(data.externalReference())) {
            LOG.warnf("Refund event %s external reference does not match the local refund", event.id());
            return;
        }

        RefundStatus previous = refund.getStatus();
        refund.reconcile(data.externalReference(), data.status(), data.failureReason());
        if (previous != RefundStatus.SUCCEEDED && refund.getStatus() == RefundStatus.SUCCEEDED) {
            if (payment.getStatus() != PaymentStatus.SUCCEEDED && payment.getStatus() != PaymentStatus.REFUNDED) {
                throw new IllegalStateException(
                        "Successful refund %s references payment %s in status %s."
                                .formatted(refund.getId(), payment.getId(), payment.getStatus()));
            }
            payment.markRefunded();
            paymentRefunded.fire(new PaymentRefunded(refund.getOrderId(), refund.getEstablishmentId()));
        }
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
