package com.surplasse.common.event;

import java.util.UUID;

/** Trusted payment-domain fact emitted only after Stripe reports a successful full refund. */
public record PaymentRefunded(UUID orderId, UUID establishmentId) {}
