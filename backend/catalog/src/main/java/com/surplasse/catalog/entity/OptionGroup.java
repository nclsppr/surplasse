package com.surplasse.catalog.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "option_group")
public class OptionGroup {

    @Id
    private UUID id;

    private UUID productId;
    private String name;
    private int minChoices;
    private int maxChoices;
    private int position;

    protected OptionGroup() {}

    public OptionGroup(UUID id, UUID productId, String name, int minChoices, int maxChoices, int position) {
        this.id = id;
        this.productId = productId;
        this.name = name;
        this.minChoices = minChoices;
        this.maxChoices = maxChoices;
        this.position = position;
    }

    public UUID getId() {
        return id;
    }

    public UUID getProductId() {
        return productId;
    }

    public String getName() {
        return name;
    }

    public int getMinChoices() {
        return minChoices;
    }

    public int getMaxChoices() {
        return maxChoices;
    }

    public int getPosition() {
        return position;
    }
}
