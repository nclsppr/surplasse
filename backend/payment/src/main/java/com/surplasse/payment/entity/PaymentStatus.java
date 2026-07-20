package com.surplasse.payment.entity;

import java.util.Locale;

/** Lifecycle of a payment attempt. Stored lowercase, matching the CHECK constraint. */
public enum PaymentStatus {
    CREATING,
    PENDING,
    SUCCEEDED,
    FAILED,
    REFUNDED;

    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static PaymentStatus fromDbValue(String value) {
        return valueOf(value.toUpperCase(Locale.ROOT));
    }
}
