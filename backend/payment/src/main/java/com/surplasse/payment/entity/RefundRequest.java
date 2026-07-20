package com.surplasse.payment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/** One client refund intention linked to the attempt it received. */
@Entity
@Table(name = "refund_request")
public class RefundRequest {

    @Id
    private UUID idempotencyKey;

    private UUID refundId;
    private UUID orderId;
    private UUID establishmentId;
    private RefundReason reason;

    protected RefundRequest() {}

    public RefundRequest(UUID idempotencyKey, UUID refundId, UUID orderId, UUID establishmentId, RefundReason reason) {
        this.idempotencyKey = idempotencyKey;
        this.refundId = refundId;
        this.orderId = orderId;
        this.establishmentId = establishmentId;
        this.reason = reason;
    }

    public UUID getIdempotencyKey() {
        return idempotencyKey;
    }

    public UUID getRefundId() {
        return refundId;
    }

    public UUID getOrderId() {
        return orderId;
    }

    public UUID getEstablishmentId() {
        return establishmentId;
    }

    public RefundReason getReason() {
        return reason;
    }
}
