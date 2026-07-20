package com.surplasse.payment.service;

import com.surplasse.common.error.BusinessRuleException;
import com.surplasse.common.error.ConflictException;
import com.surplasse.common.error.NotFoundException;
import com.surplasse.common.event.PaymentRefunded;
import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.common.order.OrderGateway;
import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.entity.PaymentRefund;
import com.surplasse.payment.entity.PaymentStatus;
import com.surplasse.payment.entity.RefundReason;
import com.surplasse.payment.entity.RefundRequest;
import com.surplasse.payment.entity.RefundStatus;
import com.surplasse.payment.provider.RefundProvider;
import com.surplasse.payment.repository.PaymentRefundRepository;
import com.surplasse.payment.repository.PaymentRepository;
import com.surplasse.payment.repository.RefundRequestRepository;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class RefundService {

    private static final Set<String> REFUNDABLE_ORDER_STATUSES = Set.of("paid", "accepted", "preparing", "ready");

    private final RestaurateurIdentityGateway identityGateway;
    private final OrderGateway orderGateway;
    private final PaymentRepository payments;
    private final PaymentRefundRepository refunds;
    private final RefundRequestRepository requests;
    private final RefundProvider provider;
    private final Event<PaymentRefunded> paymentRefunded;

    RefundService(
            RestaurateurIdentityGateway identityGateway,
            OrderGateway orderGateway,
            PaymentRepository payments,
            PaymentRefundRepository refunds,
            RefundRequestRepository requests,
            RefundProvider provider,
            Event<PaymentRefunded> paymentRefunded) {
        this.identityGateway = identityGateway;
        this.orderGateway = orderGateway;
        this.payments = payments;
        this.refunds = refunds;
        this.requests = requests;
        this.provider = provider;
        this.paymentRefunded = paymentRefunded;
    }

    /** Reserves locally, calls Stripe without a transaction, then reconciles the authoritative result. */
    public PaymentRefund create(String accessToken, UUID orderId, RefundReason reason, UUID idempotencyKey) {
        identityGateway.authenticate(accessToken);
        PaymentRefund refund =
                QuarkusTransaction.requiringNew().call(() -> reserve(accessToken, orderId, reason, idempotencyKey));
        if (refund.getStatus() != RefundStatus.CREATING) {
            return refund;
        }

        RefundProvider.RefundRef providerRefund;
        try {
            providerRefund = provider.createFullRefund(new RefundProvider.RefundRequest(
                    refund.getId(),
                    refund.getPaymentId(),
                    refund.getOrderId(),
                    refund.getEstablishmentId(),
                    refund.getPaymentIntentId(),
                    refund.getConnectedAccountId(),
                    refund.getApplicationFeeAmount(),
                    refund.getReason(),
                    refund.getCreationKey()));
        } catch (BusinessRuleException rejected) {
            QuarkusTransaction.requiringNew().run(() -> markCreationFailed(refund.getId(), rejected.getMessage()));
            throw rejected;
        }
        return QuarkusTransaction.requiringNew()
                .call(() -> reconcile(refund.getOrderId(), refund.getPaymentId(), refund.getId(), providerRefund));
    }

    private PaymentRefund reserve(String accessToken, UUID orderId, RefundReason reason, UUID idempotencyKey) {
        requests.lockIdempotencyKey(idempotencyKey);
        Optional<PaymentRefund> replayed = replay(accessToken, orderId, reason, idempotencyKey);
        if (replayed.isPresent()) {
            return replayed.get();
        }

        OrderGateway.RefundableOrder order = orderGateway
                .lockRefundableOrder(orderId)
                .orElseThrow(() -> new NotFoundException("No order matches this identifier."));
        identityGateway.authorize(accessToken, order.establishmentId());

        Payment payment = payments.findByOrderForUpdate(orderId, order.establishmentId())
                .orElseThrow(() -> new NotFoundException("No settled payment matches this order."));
        Optional<PaymentRefund> reusable = refunds.findActiveOrSucceededByPayment(payment.getId());
        if (reusable.isPresent()) {
            return linkRequest(idempotencyKey, reason, reusable.get());
        }
        if (!REFUNDABLE_ORDER_STATUSES.contains(order.status()) || payment.getStatus() != PaymentStatus.SUCCEEDED) {
            throw ConflictException.orderNotModifiable(
                    "Order %s cannot be refunded from status %s.".formatted(orderId, order.status()));
        }

        PaymentRefund refund = PaymentRefund.reserve(UUID.randomUUID(), payment, idempotencyKey, reason);
        refunds.persist(refund);
        refunds.flush();
        requests.persist(new RefundRequest(idempotencyKey, refund.getId(), orderId, order.establishmentId(), reason));
        return refund;
    }

    private Optional<PaymentRefund> replay(String accessToken, UUID orderId, RefundReason reason, UUID idempotencyKey) {
        return requests.findByIdOptional(idempotencyKey).map(request -> {
            identityGateway.authorize(accessToken, request.getEstablishmentId());
            if (!request.getOrderId().equals(orderId) || request.getReason() != reason) {
                throw ConflictException.idempotencyKeyConflict();
            }
            return refunds.findByIdOptional(request.getRefundId())
                    .orElseThrow(() -> new IllegalStateException("A refund request references an unknown refund."));
        });
    }

    private PaymentRefund linkRequest(UUID idempotencyKey, RefundReason reason, PaymentRefund refund) {
        requests.persist(new RefundRequest(
                idempotencyKey, refund.getId(), refund.getOrderId(), refund.getEstablishmentId(), reason));
        return refund;
    }

    private PaymentRefund reconcile(
            UUID orderId, UUID paymentId, UUID refundId, RefundProvider.RefundRef providerRefund) {
        // Global lock order is Order, Payment, Refund. It is shared with reservation and kitchen updates.
        orderGateway
                .lockRefundableOrder(orderId)
                .orElseThrow(() -> new IllegalStateException("A refund order disappeared before reconciliation."));
        Payment payment = payments.findByIdForUpdate(paymentId)
                .orElseThrow(() -> new IllegalStateException("A refund references an unknown payment."));
        PaymentRefund refund = refunds.findByIdForUpdate(refundId)
                .orElseThrow(() -> new IllegalStateException("A reserved refund disappeared before reconciliation."));
        RefundStatus previous = refund.getStatus();
        refund.reconcile(providerRefund.externalReference(), providerRefund.status(), providerRefund.failureReason());
        if (previous != RefundStatus.SUCCEEDED && refund.getStatus() == RefundStatus.SUCCEEDED) {
            requireSettledPayment(payment, refund);
            payment.markRefunded();
            paymentRefunded.fire(new PaymentRefunded(refund.getOrderId(), refund.getEstablishmentId()));
        }
        refunds.flush();
        return refund;
    }

    private void markCreationFailed(UUID refundId, String failureReason) {
        PaymentRefund refund = refunds.findByIdForUpdate(refundId)
                .orElseThrow(
                        () -> new IllegalStateException("A reserved refund disappeared after provider rejection."));
        refund.markCreationFailed(failureReason);
    }

    private static void requireSettledPayment(Payment payment, PaymentRefund refund) {
        if (payment.getStatus() != PaymentStatus.SUCCEEDED && payment.getStatus() != PaymentStatus.REFUNDED) {
            throw new IllegalStateException("Successful refund %s references payment %s in status %s."
                    .formatted(refund.getId(), payment.getId(), payment.getStatus()));
        }
    }
}
