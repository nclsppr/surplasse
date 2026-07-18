package com.surplasse.order.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A line of an order: product, price and options frozen at creation time. */
@Entity
@Table(name = "order_line")
public class OrderLine {

    @Id
    private UUID id;

    private UUID orderId;
    private UUID productId;
    private String productName;
    private int unitPriceCents;
    private int quantity;

    @JdbcTypeCode(SqlTypes.JSON)
    private String optionsJson;

    private String note;
    private int lineTotalCents;
    private int position;

    protected OrderLine() {}

    public OrderLine(
            UUID id,
            UUID orderId,
            UUID productId,
            String productName,
            int unitPriceCents,
            int quantity,
            String optionsJson,
            String note,
            int lineTotalCents,
            int position) {
        this.id = id;
        this.orderId = orderId;
        this.productId = productId;
        this.productName = productName;
        this.unitPriceCents = unitPriceCents;
        this.quantity = quantity;
        this.optionsJson = optionsJson;
        this.note = note;
        this.lineTotalCents = lineTotalCents;
        this.position = position;
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrderId() {
        return orderId;
    }

    public UUID getProductId() {
        return productId;
    }

    public String getProductName() {
        return productName;
    }

    public int getUnitPriceCents() {
        return unitPriceCents;
    }

    public int getQuantity() {
        return quantity;
    }

    public String getOptionsJson() {
        return optionsJson;
    }

    public String getNote() {
        return note;
    }

    public int getLineTotalCents() {
        return lineTotalCents;
    }

    public int getPosition() {
        return position;
    }
}
