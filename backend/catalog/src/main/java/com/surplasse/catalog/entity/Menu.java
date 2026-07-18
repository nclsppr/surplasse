package com.surplasse.catalog.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "menu")
public class Menu {

    @Id
    private UUID id;

    private UUID establishmentId;
    private String name;
    private MenuStatus status;

    protected Menu() {}

    public Menu(UUID id, UUID establishmentId, String name, MenuStatus status) {
        this.id = id;
        this.establishmentId = establishmentId;
        this.name = name;
        this.status = status;
    }

    public UUID getId() {
        return id;
    }

    public UUID getEstablishmentId() {
        return establishmentId;
    }

    public String getName() {
        return name;
    }

    public MenuStatus getStatus() {
        return status;
    }
}
