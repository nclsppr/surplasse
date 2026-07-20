package com.surplasse.payment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/** A Stripe payment attempt for one order. No card data ever transits or is stored. */
@Entity
@Table(name = "payment")
public class Payment {

    @Id
    private UUID id;

    private UUID orderId;
    private UUID establishmentId;
    private String provider;
    private String externalReference;
    private UUID creationKey;
    private String connectedAccountId;
    private int applicationFeeAmount;
    private PaymentStatus status;
    private int amountCents;
    private String currency;
    private String clientSecret;

    protected Payment() {}

    public Payment(
            UUID id,
            UUID orderId,
            UUID establishmentId,
            String externalReference,
            int amountCents,
            String currency,
            String clientSecret,
            String connectedAccountId,
            int applicationFeeAmount) {
        this.id = id;
        this.orderId = orderId;
        this.establishmentId = establishmentId;
        this.provider = "stripe";
        this.externalReference = externalReference;
        this.connectedAccountId = connectedAccountId;
        this.applicationFeeAmount = applicationFeeAmount;
        this.status = PaymentStatus.PENDING;
        this.amountCents = amountCents;
        this.currency = currency;
        this.clientSecret = clientSecret;
    }

    public static Payment reserve(
            UUID id,
            UUID orderId,
            UUID establishmentId,
            int amountCents,
            String currency,
            UUID creationKey,
            String connectedAccountId,
            int applicationFeeAmount) {
        Payment payment = new Payment(
                id,
                orderId,
                establishmentId,
                "creating_" + id,
                amountCents,
                currency,
                null,
                connectedAccountId,
                applicationFeeAmount);
        payment.status = PaymentStatus.CREATING;
        payment.creationKey = creationKey;
        return payment;
    }

    public void activate(String externalReference, String clientSecret) {
        if (status != PaymentStatus.CREATING) {
            return;
        }
        this.externalReference = externalReference;
        this.clientSecret = clientSecret;
        this.status = PaymentStatus.PENDING;
    }

    public void markSucceeded() {
        this.status = PaymentStatus.SUCCEEDED;
    }

    public void markFailed() {
        this.status = PaymentStatus.FAILED;
    }

    public void markRefunded() {
        if (status == PaymentStatus.SUCCEEDED) {
            status = PaymentStatus.REFUNDED;
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrderId() {
        return orderId;
    }

    public UUID getEstablishmentId() {
        return establishmentId;
    }

    public String getProvider() {
        return provider;
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

    public int getApplicationFeeAmount() {
        return applicationFeeAmount;
    }

    public PaymentStatus getStatus() {
        return status;
    }

    public int getAmountCents() {
        return amountCents;
    }

    public String getCurrency() {
        return currency;
    }

    public String getClientSecret() {
        return clientSecret;
    }
}
