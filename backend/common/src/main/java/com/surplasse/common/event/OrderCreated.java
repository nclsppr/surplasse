package com.surplasse.common.event;

import java.util.UUID;

/** Emitted once for a newly persisted order, never for an idempotent replay. */
public record OrderCreated(UUID orderId, UUID establishmentId) {}
