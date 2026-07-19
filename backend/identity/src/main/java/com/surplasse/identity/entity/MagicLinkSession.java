package com.surplasse.identity.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "magic_link_session")
public class MagicLinkSession {

    @Id
    private UUID id;

    private UUID restaurateurId;
    private String tokenHash;
    private Instant expiresAt;
    private Instant consumedAt;
    private Instant invalidatedAt;
    private Instant createdAt;

    protected MagicLinkSession() {}

    public MagicLinkSession(UUID id, UUID restaurateurId, String tokenHash, Instant expiresAt, Instant createdAt) {
        this.id = id;
        this.restaurateurId = restaurateurId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    public boolean isExchangeableAt(Instant now) {
        return consumedAt == null && invalidatedAt == null && expiresAt.isAfter(now);
    }

    public void consume(Instant now) {
        consumedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getRestaurateurId() {
        return restaurateurId;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getConsumedAt() {
        return consumedAt;
    }

    public Instant getInvalidatedAt() {
        return invalidatedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
