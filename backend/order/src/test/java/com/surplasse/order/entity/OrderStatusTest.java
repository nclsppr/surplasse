package com.surplasse.order.entity;

import static com.surplasse.order.entity.OrderStatus.ACCEPTED;
import static com.surplasse.order.entity.OrderStatus.CANCELLED;
import static com.surplasse.order.entity.OrderStatus.PAID;
import static com.surplasse.order.entity.OrderStatus.PENDING_PAYMENT;
import static com.surplasse.order.entity.OrderStatus.PICKED_UP;
import static com.surplasse.order.entity.OrderStatus.PREPARING;
import static com.surplasse.order.entity.OrderStatus.READY;
import static com.surplasse.order.entity.OrderStatus.REFUNDED;
import static com.surplasse.order.entity.OrderStatus.SERVED;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * Exhaustive check of the order state machine
 * (docs/architecture/donnees.md): every allowed transition, and every
 * forbidden one, across the full matrix.
 */
class OrderStatusTest {

    private static final Map<OrderStatus, Set<OrderStatus>> EXPECTED = Map.of(
            PENDING_PAYMENT, Set.of(PAID, CANCELLED),
            PAID, Set.of(ACCEPTED, REFUNDED),
            ACCEPTED, Set.of(PREPARING, REFUNDED),
            PREPARING, Set.of(READY, REFUNDED),
            READY, Set.of(SERVED, PICKED_UP, REFUNDED),
            SERVED, Set.of(),
            PICKED_UP, Set.of(),
            CANCELLED, Set.of(),
            REFUNDED, Set.of());

    @Test
    void canTransitionTo_fullMatrix_matchesTheDataModel() {
        for (OrderStatus from : OrderStatus.values()) {
            for (OrderStatus to : OrderStatus.values()) {
                assertEquals(EXPECTED.get(from).contains(to), from.canTransitionTo(to), "%s -> %s".formatted(from, to));
            }
        }
    }

    @Test
    void isTerminal_terminalStatuses_matchTheDataModel() {
        for (OrderStatus status : Set.of(SERVED, PICKED_UP, CANCELLED, REFUNDED)) {
            assertTrue(status.isTerminal(), status.name());
        }
    }

    @Test
    void dbValue_everyStatus_roundTrips() {
        for (OrderStatus status : OrderStatus.values()) {
            assertEquals(status, OrderStatus.fromDbValue(status.dbValue()));
        }
    }
}
