package com.surplasse.catalog.entity;

import java.util.Locale;

/** Lifecycle of an establishment. Stored lowercase, matching the CHECK constraint. */
public enum EstablishmentStatus {
    PREGENERATED,
    CLAIMED,
    CONFIGURING,
    ACTIVE,
    SUSPENDED;

    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static EstablishmentStatus fromDbValue(String value) {
        return valueOf(value.toUpperCase(Locale.ROOT));
    }
}
