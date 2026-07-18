package com.surplasse.order.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Anonymous customer session, bound to one establishment and one table. The
 * token is stored hashed: a database leak must not allow session hijacking.
 */
@Entity
@Table(name = "table_session")
public class TableSession {

    @Id
    private UUID id;

    private UUID establishmentId;
    private UUID tableQrId;
    private String tokenHash;
    private OffsetDateTime expiresAt;

    protected TableSession() {}

    public TableSession(UUID id, UUID establishmentId, UUID tableQrId, String tokenHash, OffsetDateTime expiresAt) {
        this.id = id;
        this.establishmentId = establishmentId;
        this.tableQrId = tableQrId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    /** Sliding expiry: extended each time the session is used while still valid. */
    public void slideExpiryTo(OffsetDateTime newExpiry) {
        this.expiresAt = newExpiry;
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

    public String getTokenHash() {
        return tokenHash;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }
}
