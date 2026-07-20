package com.surplasse.common.payment;

import java.util.UUID;

/** Read boundary used by the order domain to block kitchen progress while money is being returned. */
public interface RefundGateway {

    boolean hasInProgressRefund(UUID orderId, UUID establishmentId);
}
