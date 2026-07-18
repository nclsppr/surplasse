package com.surplasse.catalog.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "option")
public class Option {

    @Id
    private UUID id;

    private UUID optionGroupId;
    private String name;
    private int extraCostCents;
    private boolean available;
    private int position;
    private OffsetDateTime deletedAt;

    protected Option() {}

    public Option(UUID id, UUID optionGroupId, String name, int extraCostCents, boolean available, int position) {
        this.id = id;
        this.optionGroupId = optionGroupId;
        this.name = name;
        this.extraCostCents = extraCostCents;
        this.available = available;
        this.position = position;
    }

    public UUID getId() {
        return id;
    }

    public UUID getOptionGroupId() {
        return optionGroupId;
    }

    public String getName() {
        return name;
    }

    public int getExtraCostCents() {
        return extraCostCents;
    }

    public boolean isAvailable() {
        return available;
    }

    public int getPosition() {
        return position;
    }

    public OffsetDateTime getDeletedAt() {
        return deletedAt;
    }
}
