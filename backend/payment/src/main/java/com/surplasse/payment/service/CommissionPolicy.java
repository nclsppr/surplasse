package com.surplasse.payment.service;

import java.time.OffsetDateTime;

/** Commission fixed by ADR-0015: three free months, then one percent rounded down to whole cents. */
final class CommissionPolicy {

    private CommissionPolicy() {}

    static int applicationFeeAmount(int amountCents, OffsetDateTime activatedAt, OffsetDateTime now) {
        if (amountCents < 1 || activatedAt == null || now == null) {
            throw new IllegalArgumentException("A positive amount, activation date and current time are required.");
        }
        if (now.isBefore(activatedAt.plusMonths(3))) {
            return 0;
        }
        return amountCents / 100;
    }
}
