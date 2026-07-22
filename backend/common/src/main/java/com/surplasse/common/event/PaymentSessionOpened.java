package com.surplasse.common.event;

import java.util.UUID;

/** Emitted after a reserved payment session receives its provider reference. */
public record PaymentSessionOpened(UUID orderId, UUID establishmentId) {}
