package com.surplasse.common.order;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Explicit synchronous boundary of the order domain: the payment domain
 * reads what it needs to open a payment session through this interface.
 */
public interface OrderGateway {

    /** The payable view of an order, scoped to the given establishment. */
    Optional<PayableOrder> payableOrder(UUID orderId, UUID establishmentId);

    /**
     * Authenticates an anonymous table session token for another domain
     * (throws the table-session-expired unauthenticated error otherwise).
     */
    ActiveTableSession requireTableSession(String token);

    record ActiveTableSession(UUID establishmentId, UUID tableQrId) {}

    record PayableOrder(
            UUID orderId,
            UUID establishmentId,
            String status,
            int totalCents,
            String currency,
            List<UUID> productIds) {}
}
