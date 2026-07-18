package com.surplasse.order.entity;

import java.util.Locale;

/** Type of an order. Stored lowercase, matching the CHECK constraint. */
public enum OrderType {
    ON_SITE,
    TAKEAWAY;

    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static OrderType fromDbValue(String value) {
        return valueOf(value.toUpperCase(Locale.ROOT));
    }
}
