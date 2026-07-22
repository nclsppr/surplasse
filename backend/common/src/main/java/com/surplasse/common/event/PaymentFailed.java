package com.surplasse.common.event;

import java.util.UUID;

/** Emitted for a unique, reconciled payment failure event. */
public record PaymentFailed(UUID orderId, UUID establishmentId) {}
