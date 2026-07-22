package com.surplasse.common.event;

import java.util.UUID;

/** Emitted when a refund enters the failed state. */
public record PaymentRefundFailed(UUID orderId, UUID establishmentId) {}
