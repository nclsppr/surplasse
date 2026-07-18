package com.surplasse.common.event;

import java.util.UUID;

/**
 * Domain event: a payment for this order was confirmed by the signed Stripe
 * webhook. Emitted by the payment domain after commit; the order domain
 * reacts by moving the order to paid and broadcasting it.
 */
public record OrderPaid(UUID orderId, UUID establishmentId) {}
