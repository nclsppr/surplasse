package com.surplasse.common.event;

import java.time.OffsetDateTime;

/** Stripe reported the current payment and payout capabilities of one connected account. */
public record StripeAccountUpdated(
        String connectedAccountId, boolean chargesEnabled, boolean payoutsEnabled, OffsetDateTime occurredAt) {}
