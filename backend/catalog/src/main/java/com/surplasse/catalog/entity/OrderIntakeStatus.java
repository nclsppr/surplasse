package com.surplasse.catalog.entity;

import java.util.Locale;

/** Operational switch controlling admission of new customer operations. */
public enum OrderIntakeStatus {
    OPEN,
    PAUSED;

    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static OrderIntakeStatus fromDbValue(String value) {
        return valueOf(value.toUpperCase(Locale.ROOT));
    }
}
