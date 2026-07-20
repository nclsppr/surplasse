package com.surplasse.payment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/**
 * One client payment intention linked to the payment session it received.
 * Several keys may point to the same pending payment after a browser reload,
 * while replaying any one key always returns its original session.
 */
@Entity
@Table(name = "payment_request")
public class PaymentRequest {

    @Id
    private UUID idempotencyKey;

    private UUID paymentId;
    private UUID orderId;
    private UUID establishmentId;
    private UUID tableSessionId;

    protected PaymentRequest() {}

    public PaymentRequest(
            UUID idempotencyKey, UUID paymentId, UUID orderId, UUID establishmentId, UUID tableSessionId) {
        this.idempotencyKey = idempotencyKey;
        this.paymentId = paymentId;
        this.orderId = orderId;
        this.establishmentId = establishmentId;
        this.tableSessionId = tableSessionId;
    }

    public UUID getIdempotencyKey() {
        return idempotencyKey;
    }

    public UUID getPaymentId() {
        return paymentId;
    }

    public UUID getOrderId() {
        return orderId;
    }

    public UUID getEstablishmentId() {
        return establishmentId;
    }

    public UUID getTableSessionId() {
        return tableSessionId;
    }
}
