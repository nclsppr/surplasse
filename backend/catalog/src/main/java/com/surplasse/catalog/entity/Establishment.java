package com.surplasse.catalog.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "establishment")
public class Establishment {

    @Id
    private UUID id;

    private UUID restaurateurId;
    private String name;
    private String slug;
    private String address;
    private EstablishmentStatus status;

    protected Establishment() {}

    public Establishment(
            UUID id, UUID restaurateurId, String name, String slug, String address, EstablishmentStatus status) {
        this.id = id;
        this.restaurateurId = restaurateurId;
        this.name = name;
        this.slug = slug;
        this.address = address;
        this.status = status;
    }

    public UUID getId() {
        return id;
    }

    public UUID getRestaurateurId() {
        return restaurateurId;
    }

    public String getName() {
        return name;
    }

    public String getSlug() {
        return slug;
    }

    public String getAddress() {
        return address;
    }

    public EstablishmentStatus getStatus() {
        return status;
    }
}
