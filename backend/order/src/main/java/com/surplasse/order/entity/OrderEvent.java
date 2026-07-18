package com.surplasse.order.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A broadcast order event, persisted so that SSE reconnections can replay
 * what they missed via Last-Event-ID (docs/architecture/backend.md). The
 * bigserial id is the monotonic event id of the SSE protocol.
 */
@Entity
@Table(name = "order_event")
public class OrderEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private UUID establishmentId;
    private UUID orderId;
    private String eventType;

    @JdbcTypeCode(SqlTypes.JSON)
    private String payload;

    private OffsetDateTime createdAt;

    protected OrderEvent() {}

    public OrderEvent(UUID establishmentId, UUID orderId, String eventType, String payload, OffsetDateTime createdAt) {
        this.establishmentId = establishmentId;
        this.orderId = orderId;
        this.eventType = eventType;
        this.payload = payload;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public UUID getEstablishmentId() {
        return establishmentId;
    }

    public UUID getOrderId() {
        return orderId;
    }

    public String getEventType() {
        return eventType;
    }

    public String getPayload() {
        return payload;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
