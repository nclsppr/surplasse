package com.surplasse.payment.entity;

import java.util.Locale;

/** Auditable operational reason for a full refund. */
public enum RefundReason {
    RESTAURANT_REFUSAL,
    ITEM_UNAVAILABLE,
    SERVICE_INCIDENT;

    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static RefundReason fromDbValue(String value) {
        return valueOf(value.toUpperCase(Locale.ROOT));
    }
}
