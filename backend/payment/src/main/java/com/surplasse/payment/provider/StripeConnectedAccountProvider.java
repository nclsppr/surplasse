package com.surplasse.payment.provider;

import com.stripe.exception.StripeException;
import com.stripe.model.v2.core.Account;
import com.stripe.param.v2.core.AccountRetrieveParams;
import com.surplasse.common.error.DependencyUnavailableException;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

/** Accounts v2 adapter. Capability status is authoritative, never the legacy v1 booleans. */
@ApplicationScoped
public class StripeConnectedAccountProvider implements ConnectedAccountProvider {

    private static final Logger LOG = Logger.getLogger(StripeConnectedAccountProvider.class);

    private final StripeClientFactory clients;

    StripeConnectedAccountProvider(StripeClientFactory clients) {
        this.clients = clients;
    }

    @Override
    public Capabilities retrieveCapabilities(String connectedAccountId) {
        if (connectedAccountId == null || connectedAccountId.isBlank()) {
            throw new DependencyUnavailableException("Stripe connected account is not configured.");
        }
        try {
            Account account = clients.create()
                    .v2()
                    .core()
                    .accounts()
                    .retrieve(
                            connectedAccountId,
                            AccountRetrieveParams.builder()
                                    .addInclude(AccountRetrieveParams.Include.CONFIGURATION__MERCHANT)
                                    .build());
            return toCapabilities(account, connectedAccountId, clients.liveMode());
        } catch (StripeException e) {
            LOG.errorf("Stripe Accounts v2 retrieval failed for account %s: %s", connectedAccountId, e.getMessage());
            throw new DependencyUnavailableException("Stripe did not answer.");
        }
    }

    static Capabilities toCapabilities(Account account, String expectedAccountId, boolean expectedLiveMode) {
        if (account == null
                || !expectedAccountId.equals(account.getId())
                || account.getLivemode() == null
                || account.getLivemode() != expectedLiveMode) {
            throw new DependencyUnavailableException("Stripe returned a connected account from another context.");
        }
        if (Boolean.TRUE.equals(account.getClosed())) {
            return new Capabilities(false, false);
        }
        Account.Configuration configuration = account.getConfiguration();
        Account.Configuration.Merchant merchant = configuration == null ? null : configuration.getMerchant();
        Account.Configuration.Merchant.Capabilities capabilities = merchant == null ? null : merchant.getCapabilities();
        if (capabilities == null) {
            return new Capabilities(false, false);
        }
        boolean cardPaymentsActive = capabilities.getCardPayments() != null
                && "active".equals(capabilities.getCardPayments().getStatus());
        boolean payoutsActive = capabilities.getStripeBalance() != null
                && capabilities.getStripeBalance().getPayouts() != null
                && "active".equals(capabilities.getStripeBalance().getPayouts().getStatus());
        return new Capabilities(cardPaymentsActive, payoutsActive);
    }
}
