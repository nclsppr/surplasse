package com.surplasse.catalog.entity;

import java.util.Locale;

/** Lifecycle of a menu. Stored lowercase, matching the CHECK constraint. */
public enum MenuStatus {
    DRAFT,
    PUBLISHED;

    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static MenuStatus fromDbValue(String value) {
        return valueOf(value.toUpperCase(Locale.ROOT));
    }
}
