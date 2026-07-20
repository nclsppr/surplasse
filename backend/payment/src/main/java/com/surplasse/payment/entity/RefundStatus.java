package com.surplasse.payment.entity;

import java.util.Locale;

/** Local refund lifecycle, including the short reservation before the Stripe call. */
public enum RefundStatus {
    CREATING,
    PENDING,
    REQUIRES_ACTION,
    SUCCEEDED,
    FAILED,
    CANCELED;

    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public boolean blocksOrderProgress() {
        return this == CREATING || this == PENDING || this == REQUIRES_ACTION;
    }

    public boolean isActiveOrSucceeded() {
        return blocksOrderProgress() || this == SUCCEEDED;
    }

    public boolean isTerminal() {
        return this == SUCCEEDED || this == FAILED || this == CANCELED;
    }

    public static RefundStatus fromDbValue(String value) {
        return valueOf(value.toUpperCase(Locale.ROOT));
    }

    public static RefundStatus fromProviderValue(String value) {
        if (value == null) {
            throw new IllegalArgumentException("Refund status is missing.");
        }
        return switch (value) {
            case "pending" -> PENDING;
            case "requires_action" -> REQUIRES_ACTION;
            case "succeeded" -> SUCCEEDED;
            case "failed" -> FAILED;
            case "canceled" -> CANCELED;
            default -> throw new IllegalArgumentException("Unknown refund status: " + value);
        };
    }
}
