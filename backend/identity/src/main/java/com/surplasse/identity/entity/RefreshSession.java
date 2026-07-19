package com.surplasse.identity.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "restaurateur_session")
public class RefreshSession {

    @Id
    private UUID id;

    private UUID restaurateurId;
    private UUID familyId;
    private String tokenHash;
    private Instant expiresAt;
    private Instant rotatedAt;
    private Instant revokedAt;
    private Instant createdAt;

    protected RefreshSession() {}

    public RefreshSession(
            UUID id, UUID restaurateurId, UUID familyId, String tokenHash, Instant expiresAt, Instant createdAt) {
        this.id = id;
        this.restaurateurId = restaurateurId;
        this.familyId = familyId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    public boolean isActiveAt(Instant now) {
        return rotatedAt == null && revokedAt == null && expiresAt.isAfter(now);
    }

    public boolean wasRotated() {
        return rotatedAt != null;
    }

    public void rotate(Instant now) {
        rotatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getRestaurateurId() {
        return restaurateurId;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getRotatedAt() {
        return rotatedAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
