package com.surplasse.payment.service;

import com.surplasse.common.catalog.CatalogGateway;
import com.surplasse.common.error.ConflictException;
import com.surplasse.common.error.NotFoundException;
import com.surplasse.common.order.OrderGateway;
import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.entity.PaymentRequest;
import com.surplasse.payment.entity.PaymentStatus;
import com.surplasse.payment.provider.PaymentProvider;
import com.surplasse.payment.repository.PaymentRepository;
import com.surplasse.payment.repository.PaymentRequestRepository;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final OrderGateway orderGateway;
    private final CatalogGateway catalogGateway;
    private final PaymentProvider paymentProvider;
    private final PaymentRequestRepository paymentRequestRepository;

    PaymentService(
            PaymentRepository paymentRepository,
            OrderGateway orderGateway,
            CatalogGateway catalogGateway,
            PaymentProvider paymentProvider,
            PaymentRequestRepository paymentRequestRepository) {
        this.paymentRepository = paymentRepository;
        this.orderGateway = orderGateway;
        this.catalogGateway = catalogGateway;
        this.paymentProvider = paymentProvider;
        this.paymentRequestRepository = paymentRequestRepository;
    }

    /**
     * Opens or replays one payment session. A short transaction reserves the
     * order and the stable Stripe idempotency key, the network call runs with
     * no transaction open, then a second short transaction activates it.
     */
    public Payment createSession(OrderGateway.ActiveTableSession tableSession, UUID orderId, UUID idempotencyKey) {
        Payment payment = QuarkusTransaction.requiringNew().call(() -> reserve(tableSession, orderId, idempotencyKey));
        if (payment.getStatus() != PaymentStatus.CREATING) {
            return payment;
        }

        PaymentProvider.PaymentIntentRef intent = paymentProvider.createIntent(
                orderId, payment.getAmountCents(), payment.getCurrency(), payment.getCreationKey());
        return QuarkusTransaction.requiringNew().call(() -> activate(payment.getId(), intent));
    }

    private Payment reserve(OrderGateway.ActiveTableSession tableSession, UUID orderId, UUID idempotencyKey) {
        paymentRequestRepository.lockIdempotencyKey(idempotencyKey);
        Optional<Payment> replayed = replay(tableSession, orderId, idempotencyKey);
        if (replayed.isPresent() && replayed.get().getStatus() != PaymentStatus.CREATING) {
            return replayed.get();
        }

        OrderGateway.PayableOrder order = orderGateway
                .lockPayableOrder(orderId, tableSession.sessionId())
                .orElseThrow(() -> new NotFoundException("No order matches this identifier."));

        // The row lock may have waited for another reservation to commit.
        replayed = replay(tableSession, orderId, idempotencyKey);
        if (replayed.isPresent() && replayed.get().getStatus() != PaymentStatus.CREATING) {
            return replayed.get();
        }
        if (!"pending_payment".equals(order.status())) {
            throw ConflictException.orderNotModifiable("Order %s is already %s.".formatted(orderId, order.status()));
        }
        if (replayed.isPresent()) {
            requireAvailability(order);
            return replayed.get();
        }

        Optional<Payment> reusable = paymentRepository.findReusableByOrder(orderId, tableSession.establishmentId());
        if (reusable.isPresent()) {
            if (reusable.get().getStatus() == PaymentStatus.CREATING) {
                requireAvailability(order);
            }
            return linkRequest(tableSession, orderId, idempotencyKey, reusable.get());
        }
        if (paymentRepository.existsByOrder(orderId, tableSession.establishmentId())) {
            throw ConflictException.orderNotModifiable("Order %s already has a settled payment.".formatted(orderId));
        }
        requireAvailability(order);

        Payment payment = Payment.reserve(
                UUID.randomUUID(),
                orderId,
                tableSession.establishmentId(),
                order.totalCents(),
                order.currency(),
                idempotencyKey);
        paymentRepository.persist(payment);
        paymentRepository.flush();
        paymentRequestRepository.persist(new PaymentRequest(
                idempotencyKey, payment.getId(), orderId, tableSession.establishmentId(), tableSession.sessionId()));
        return payment;
    }

    private Payment activate(UUID paymentId, PaymentProvider.PaymentIntentRef intent) {
        Payment payment = paymentRepository
                .findByIdForUpdate(paymentId)
                .orElseThrow(() -> new IllegalStateException("A reserved payment disappeared before activation."));
        payment.activate(intent.externalReference(), intent.clientSecret());
        paymentRepository.flush();
        return payment;
    }

    private Optional<Payment> replay(OrderGateway.ActiveTableSession tableSession, UUID orderId, UUID idempotencyKey) {
        return paymentRequestRepository.findByIdOptional(idempotencyKey).map(request -> {
            if (!request.getEstablishmentId().equals(tableSession.establishmentId())
                    || !request.getTableSessionId().equals(tableSession.sessionId())
                    || !request.getOrderId().equals(orderId)) {
                throw ConflictException.idempotencyKeyConflict();
            }
            return paymentRepository
                    .findByIdOptional(request.getPaymentId())
                    .orElseThrow(() -> new IllegalStateException("A payment request references an unknown payment."));
        });
    }

    private Payment linkRequest(
            OrderGateway.ActiveTableSession tableSession, UUID orderId, UUID idempotencyKey, Payment payment) {
        paymentRequestRepository.persist(new PaymentRequest(
                idempotencyKey, payment.getId(), orderId, tableSession.establishmentId(), tableSession.sessionId()));
        return payment;
    }

    /** Availability is re-checked right before payment: nobody pays for a dish the kitchen cannot serve. */
    private void requireAvailability(OrderGateway.PayableOrder order) {
        Map<UUID, CatalogGateway.ProductPricing> pricing =
                catalogGateway.priceProducts(order.establishmentId(), order.productIds());
        for (UUID productId : order.productIds()) {
            CatalogGateway.ProductPricing product = pricing.get(productId);
            if (product == null || !product.available()) {
                throw ConflictException.productUnavailable(
                        "A product of this order became unavailable; adjust the cart before paying.");
            }
        }
    }
}
