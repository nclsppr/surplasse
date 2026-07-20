package com.surplasse.common.order;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Explicit synchronous boundary of the order domain: the payment domain
 * reads what it needs to open a payment session through this interface.
 */
public interface OrderGateway {

    /**
     * Locks and returns the payable view of an order scoped to the exact
     * anonymous table session. The caller must own a transaction.
     */
    Optional<PayableOrder> lockPayableOrder(UUID orderId, UUID tableSessionId);

    /** Locks one order before the payment domain reserves a full refund. */
    Optional<RefundableOrder> lockRefundableOrder(UUID orderId);

    /**
     * Authenticates an anonymous table session token for another domain
     * (throws the table-session-expired unauthenticated error otherwise).
     */
    ActiveTableSession requireTableSession(String token);

    record ActiveTableSession(UUID sessionId, UUID establishmentId, UUID tableQrId) {}

    record PayableOrder(
            UUID orderId,
            UUID establishmentId,
            String status,
            int totalCents,
            String currency,
            List<UUID> productIds) {}

    record RefundableOrder(UUID orderId, UUID establishmentId, String status) {}
}
