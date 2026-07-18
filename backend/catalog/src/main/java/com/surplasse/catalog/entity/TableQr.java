package com.surplasse.catalog.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "table_qr")
public class TableQr {

    @Id
    private UUID id;

    private UUID establishmentId;
    private String label;
    private String code;
    private boolean active;

    protected TableQr() {}

    public TableQr(UUID id, UUID establishmentId, String label, String code, boolean active) {
        this.id = id;
        this.establishmentId = establishmentId;
        this.label = label;
        this.code = code;
        this.active = active;
    }

    public UUID getId() {
        return id;
    }

    public UUID getEstablishmentId() {
        return establishmentId;
    }

    public String getLabel() {
        return label;
    }

    public String getCode() {
        return code;
    }

    public boolean isActive() {
        return active;
    }
}
