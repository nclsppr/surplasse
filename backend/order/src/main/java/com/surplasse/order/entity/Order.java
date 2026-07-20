package com.surplasse.order.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "\"order\"")
public class Order {

    @Id
    private UUID id;

    private UUID establishmentId;
    private UUID tableQrId;
    private UUID tableSessionId;
    private OrderType type;
    private OrderStatus status;
    private String displayNumber;
    private LocalDate serviceDay;
    private int totalCents;
    private String trackingToken;
    private UUID idempotencyKey;
    private String requestHash;
    private OffsetDateTime createdAt;

    protected Order() {}

    public Order(
            UUID id,
            UUID establishmentId,
            UUID tableQrId,
            UUID tableSessionId,
            OrderType type,
            String displayNumber,
            LocalDate serviceDay,
            int totalCents,
            String trackingToken,
            UUID idempotencyKey,
            String requestHash,
            OffsetDateTime createdAt) {
        this.id = id;
        this.establishmentId = establishmentId;
        this.tableQrId = tableQrId;
        this.tableSessionId = tableSessionId;
        this.type = type;
        this.status = OrderStatus.PENDING_PAYMENT;
        this.displayNumber = displayNumber;
        this.serviceDay = serviceDay;
        this.totalCents = totalCents;
        this.trackingToken = trackingToken;
        this.idempotencyKey = idempotencyKey;
        this.requestHash = requestHash;
        this.createdAt = createdAt;
    }

    /** Applies a transition of the state machine; the caller has already validated it. */
    public void moveTo(OrderStatus target) {
        if (!status.canTransitionTo(target)) {
            throw new IllegalStateException("Transition %s -> %s is not allowed".formatted(status, target));
        }
        this.status = target;
    }

    public UUID getId() {
        return id;
    }

    public UUID getEstablishmentId() {
        return establishmentId;
    }

    public UUID getTableQrId() {
        return tableQrId;
    }

    public UUID getTableSessionId() {
        return tableSessionId;
    }

    public OrderType getType() {
        return type;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public String getDisplayNumber() {
        return displayNumber;
    }

    public LocalDate getServiceDay() {
        return serviceDay;
    }

    public int getTotalCents() {
        return totalCents;
    }

    public String getTrackingToken() {
        return trackingToken;
    }

    public UUID getIdempotencyKey() {
        return idempotencyKey;
    }

    public String getRequestHash() {
        return requestHash;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
