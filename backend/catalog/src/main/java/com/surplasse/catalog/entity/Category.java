package com.surplasse.catalog.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "category")
public class Category {

    @Id
    private UUID id;

    private UUID menuId;
    private String name;
    private int position;

    protected Category() {}

    public Category(UUID id, UUID menuId, String name, int position) {
        this.id = id;
        this.menuId = menuId;
        this.name = name;
        this.position = position;
    }

    public UUID getId() {
        return id;
    }

    public UUID getMenuId() {
        return menuId;
    }

    public String getName() {
        return name;
    }

    public int getPosition() {
        return position;
    }
}
