package com.surplasse.payment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/** One auditable attempt to return the full payment and any Surplasse application fee. */
@Entity
@Table(name = "payment_refund")
public class PaymentRefund {

    @Id
    private UUID id;

    private UUID paymentId;
    private UUID orderId;
    private UUID establishmentId;
    private String provider;
    private String externalReference;
    private UUID creationKey;
    private String paymentIntentId;
    private String connectedAccountId;
    private int amountCents;
    private int applicationFeeAmount;
    private String currency;
    private RefundReason reason;
    private RefundStatus status;
    private String failureReason;

    protected PaymentRefund() {}

    private PaymentRefund(
            UUID id,
            UUID paymentId,
            UUID orderId,
            UUID establishmentId,
            UUID creationKey,
            String paymentIntentId,
            String connectedAccountId,
            int amountCents,
            int applicationFeeAmount,
            String currency,
            RefundReason reason) {
        this.id = id;
        this.paymentId = paymentId;
        this.orderId = orderId;
        this.establishmentId = establishmentId;
        this.provider = "stripe";
        this.externalReference = "creating_" + id;
        this.creationKey = creationKey;
        this.paymentIntentId = paymentIntentId;
        this.connectedAccountId = connectedAccountId;
        this.amountCents = amountCents;
        this.applicationFeeAmount = applicationFeeAmount;
        this.currency = currency;
        this.reason = reason;
        this.status = RefundStatus.CREATING;
    }

    public static PaymentRefund reserve(UUID id, Payment payment, UUID creationKey, RefundReason reason) {
        return new PaymentRefund(
                id,
                payment.getId(),
                payment.getOrderId(),
                payment.getEstablishmentId(),
                creationKey,
                payment.getExternalReference(),
                payment.getConnectedAccountId(),
                payment.getAmountCents(),
                payment.getApplicationFeeAmount(),
                payment.getCurrency(),
                reason);
    }

    public void reconcile(String externalReference, RefundStatus status, String failureReason) {
        if (this.status.isTerminal()) {
            return;
        }
        if (!acceptsExternalReference(externalReference)) {
            throw new IllegalArgumentException("A Stripe refund cannot change its external reference.");
        }
        this.externalReference = externalReference;
        this.status = status;
        this.failureReason = failureReason;
    }

    public boolean acceptsExternalReference(String candidate) {
        return externalReference.startsWith("creating_") || externalReference.equals(candidate);
    }

    public void markCreationFailed(String failureReason) {
        if (status == RefundStatus.CREATING) {
            status = RefundStatus.FAILED;
            this.failureReason = failureReason;
        }
    }

    public UUID getId() {
        return id;
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

    public String getExternalReference() {
        return externalReference;
    }

    public UUID getCreationKey() {
        return creationKey;
    }

    public String getConnectedAccountId() {
        return connectedAccountId;
    }

    public String getPaymentIntentId() {
        return paymentIntentId;
    }

    public int getAmountCents() {
        return amountCents;
    }

    public int getApplicationFeeAmount() {
        return applicationFeeAmount;
    }

    public String getCurrency() {
        return currency;
    }

    public RefundReason getReason() {
        return reason;
    }

    public RefundStatus getStatus() {
        return status;
    }

    public String getFailureReason() {
        return failureReason;
    }
}
