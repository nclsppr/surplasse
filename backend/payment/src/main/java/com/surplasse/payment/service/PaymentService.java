package com.surplasse.payment.service;

import com.surplasse.common.catalog.CatalogGateway;
import com.surplasse.common.error.ConflictException;
import com.surplasse.common.error.NotFoundException;
import com.surplasse.common.order.OrderGateway;
import com.surplasse.payment.entity.Payment;
import com.surplasse.payment.provider.PaymentProvider;
import com.surplasse.payment.repository.PaymentRepository;
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

    PaymentService(
            PaymentRepository paymentRepository,
            OrderGateway orderGateway,
            CatalogGateway catalogGateway,
            PaymentProvider paymentProvider) {
        this.paymentRepository = paymentRepository;
        this.orderGateway = orderGateway;
        this.catalogGateway = catalogGateway;
        this.paymentProvider = paymentProvider;
    }

    /**
     * Opens (or returns, when replayed) the payment session of an order.
     * Three-step motif (docs/developpement/conventions-quarkus.md): checks,
     * then the external Stripe call outside any transaction, then a short
     * transaction to record the attempt.
     */
    public Payment createSession(UUID establishmentId, UUID orderId) {
        Optional<Payment> pending = paymentRepository.findPendingByOrder(orderId);
        if (pending.isPresent()) {
            return pending.get();
        }

        OrderGateway.PayableOrder order = orderGateway
                .payableOrder(orderId, establishmentId)
                .orElseThrow(() -> new NotFoundException("No order matches this identifier."));
        if (!"pending_payment".equals(order.status())) {
            throw ConflictException.orderNotModifiable("Order %s is already %s.".formatted(orderId, order.status()));
        }
        requireAvailability(order);

        PaymentProvider.PaymentIntentRef intent =
                paymentProvider.createIntent(orderId, order.totalCents(), order.currency());

        return QuarkusTransaction.requiringNew().call(() -> {
            // A concurrent creation may have won the partial unique index race:
            // that attempt is the session, the extra intent stays unused.
            Optional<Payment> raced = paymentRepository.findPendingByOrder(orderId);
            if (raced.isPresent()) {
                return raced.get();
            }
            Payment payment = new Payment(
                    UUID.randomUUID(),
                    orderId,
                    establishmentId,
                    intent.externalReference(),
                    order.totalCents(),
                    order.currency(),
                    intent.clientSecret());
            paymentRepository.persist(payment);
            return payment;
        });
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
