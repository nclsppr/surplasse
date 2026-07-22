package com.surplasse.common.event;

import java.util.UUID;

/** Reports the asynchronous result returned by the configured SMTP transport. */
public record MagicLinkDeliveryCompleted(UUID sessionId, boolean accepted) {}
