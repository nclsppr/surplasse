package com.surplasse.order.entity;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * The order state machine (docs/architecture/donnees.md). Stored lowercase,
 * matching the CHECK constraint. Any transition outside {@link #TRANSITIONS}
 * is rejected by the services.
 */
public enum OrderStatus {
    PENDING_PAYMENT,
    PAID,
    ACCEPTED,
    PREPARING,
    READY,
    SERVED,
    PICKED_UP,
    CANCELLED,
    REFUNDED;

    private static final Map<OrderStatus, Set<OrderStatus>> TRANSITIONS = Map.of(
            PENDING_PAYMENT, Set.of(PAID, CANCELLED),
            PAID, Set.of(ACCEPTED, REFUNDED),
            ACCEPTED, Set.of(PREPARING, REFUNDED),
            PREPARING, Set.of(READY, REFUNDED),
            READY, Set.of(SERVED, PICKED_UP, REFUNDED),
            SERVED, Set.of(),
            PICKED_UP, Set.of(),
            CANCELLED, Set.of(),
            REFUNDED, Set.of());

    private static final List<OrderStatus> OPERATIONAL = List.of(PAID, ACCEPTED, PREPARING, READY);

    public boolean canTransitionTo(OrderStatus target) {
        return TRANSITIONS.get(this).contains(target);
    }

    public boolean isTerminal() {
        return TRANSITIONS.get(this).isEmpty();
    }

    /** Statuses that must remain visible to the restaurant staff until service completes. */
    public boolean isOperational() {
        return OPERATIONAL.contains(this);
    }

    /** Stable database filter for the operational Dashboard list. */
    public static List<OrderStatus> operationalValues() {
        return OPERATIONAL;
    }

    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static OrderStatus fromDbValue(String value) {
        return valueOf(value.toUpperCase(Locale.ROOT));
    }
}
