package com.surplasse.payment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * Processed Stripe event ids, with a uniqueness constraint: the idempotency
 * guarantee of the webhook (docs/architecture/securite.md). Duplicated
 * deliveries are acknowledged without any effect.
 */
@Entity
@Table(name = "stripe_webhook_event")
public class StripeWebhookEvent {

    @Id
    private String id;

    private String type;
    private OffsetDateTime createdAt;

    protected StripeWebhookEvent() {}

    public StripeWebhookEvent(String id, String type, OffsetDateTime createdAt) {
        this.id = id;
        this.type = type;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public String getType() {
        return type;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
