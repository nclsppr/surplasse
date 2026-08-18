package com.surplasse.application.bootstrap;

import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.v2.core.Account;
import com.stripe.param.v2.core.AccountRetrieveParams;
import com.surplasse.common.error.DependencyUnavailableException;
import com.surplasse.payment.provider.ConnectedAccountProvider;
import com.surplasse.payment.provider.StripeConnectedAccountProvider;

final class StripePilotAccountVerifier {

    private final AccountRetriever accounts;

    StripePilotAccountVerifier() {
        this(StripePilotAccountVerifier::retrieve);
    }

    StripePilotAccountVerifier(AccountRetriever accounts) {
        this.accounts = accounts;
    }

    Snapshot verify(String connectedAccountId, String restrictedTestKey) {
        final Account account;
        try {
            account = accounts.retrieve(connectedAccountId, restrictedTestKey);
        } catch (StripeException | RuntimeException exception) {
            throw PilotBootstrapException.dependency("Stripe Accounts v2 did not return an eligible test account.");
        }
        try {
            ConnectedAccountProvider.Capabilities capabilities =
                    StripeConnectedAccountProvider.toCapabilities(account, connectedAccountId, false);
            if (!capabilities.cardPaymentsActive()) {
                throw PilotBootstrapException.dependency(
                        "Stripe Accounts v2 card_payments is not active in test mode.");
            }
            return new Snapshot(connectedAccountId, capabilities.payoutsActive());
        } catch (DependencyUnavailableException exception) {
            throw PilotBootstrapException.dependency("Stripe Accounts v2 returned a different account or mode.");
        }
    }

    private static Account retrieve(String connectedAccountId, String restrictedTestKey) throws StripeException {
        return StripeClient.builder()
                .setApiKey(restrictedTestKey)
                .setConnectTimeout(5_000)
                .setReadTimeout(15_000)
                .setMaxNetworkRetries(1)
                .build()
                .v2()
                .core()
                .accounts()
                .retrieve(
                        connectedAccountId,
                        AccountRetrieveParams.builder()
                                .addInclude(AccountRetrieveParams.Include.CONFIGURATION__MERCHANT)
                                .build());
    }

    record Snapshot(String accountId, boolean payoutsActive) {}

    @FunctionalInterface
    interface AccountRetriever {
        Account retrieve(String connectedAccountId, String restrictedTestKey) throws StripeException;
    }
}
