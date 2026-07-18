package com.surplasse.catalog.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "product")
public class Product {

    @Id
    private UUID id;

    private UUID categoryId;
    private String name;
    private String description;
    private int priceCents;
    private boolean available;
    private int position;
    private OffsetDateTime deletedAt;

    protected Product() {}

    public Product(
            UUID id,
            UUID categoryId,
            String name,
            String description,
            int priceCents,
            boolean available,
            int position) {
        this.id = id;
        this.categoryId = categoryId;
        this.name = name;
        this.description = description;
        this.priceCents = priceCents;
        this.available = available;
        this.position = position;
    }

    public UUID getId() {
        return id;
    }

    public UUID getCategoryId() {
        return categoryId;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public int getPriceCents() {
        return priceCents;
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
