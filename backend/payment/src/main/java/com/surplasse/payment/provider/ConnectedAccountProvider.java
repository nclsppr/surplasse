package com.surplasse.payment.provider;

/** Reads the authoritative Accounts v2 capabilities of a Stripe connected account. */
public interface ConnectedAccountProvider {

    /** Returns the current capability snapshot, failing closed when Stripe can't be reached. */
    Capabilities retrieveCapabilities(String connectedAccountId);

    record Capabilities(boolean cardPaymentsActive, boolean payoutsActive) {}
}
