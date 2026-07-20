package com.surplasse.payment.provider;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.stripe.model.v2.core.Account;
import com.surplasse.common.error.DependencyUnavailableException;
import org.junit.jupiter.api.Test;

class StripeConnectedAccountProviderTest {

    private static final String ACCOUNT_ID = "acct_test_restaurant";

    @Test
    void toCapabilities_activeAccountsV2Snapshot_activatesCardPaymentsAndPayouts() {
        Account account = account("active", "active");

        ConnectedAccountProvider.Capabilities capabilities =
                StripeConnectedAccountProvider.toCapabilities(account, ACCOUNT_ID, false);

        assertTrue(capabilities.cardPaymentsActive());
        assertTrue(capabilities.payoutsActive());
    }

    @Test
    void toCapabilities_restrictedSnapshot_failsClosed() {
        Account account = account("restricted", "pending");

        ConnectedAccountProvider.Capabilities capabilities =
                StripeConnectedAccountProvider.toCapabilities(account, ACCOUNT_ID, false);

        assertFalse(capabilities.cardPaymentsActive());
        assertFalse(capabilities.payoutsActive());
    }

    @Test
    void toCapabilities_closedAccount_failsClosed() {
        Account account = account("active", "active");
        account.setClosed(true);

        ConnectedAccountProvider.Capabilities capabilities =
                StripeConnectedAccountProvider.toCapabilities(account, ACCOUNT_ID, false);

        assertEquals(new ConnectedAccountProvider.Capabilities(false, false), capabilities);
    }

    @Test
    void toCapabilities_wrongMode_isRejected() {
        Account account = account("active", "active");

        assertThrows(
                DependencyUnavailableException.class,
                () -> StripeConnectedAccountProvider.toCapabilities(account, ACCOUNT_ID, true));
    }

    private static Account account(String cardPaymentsStatus, String payoutsStatus) {
        Account account = new Account();
        account.setId(ACCOUNT_ID);
        account.setLivemode(false);
        account.setClosed(false);

        Account.Configuration.Merchant.Capabilities.CardPayments cardPayments =
                new Account.Configuration.Merchant.Capabilities.CardPayments();
        cardPayments.setStatus(cardPaymentsStatus);
        Account.Configuration.Merchant.Capabilities.StripeBalance.Payouts payouts =
                new Account.Configuration.Merchant.Capabilities.StripeBalance.Payouts();
        payouts.setStatus(payoutsStatus);
        Account.Configuration.Merchant.Capabilities.StripeBalance stripeBalance =
                new Account.Configuration.Merchant.Capabilities.StripeBalance();
        stripeBalance.setPayouts(payouts);
        Account.Configuration.Merchant.Capabilities capabilities = new Account.Configuration.Merchant.Capabilities();
        capabilities.setCardPayments(cardPayments);
        capabilities.setStripeBalance(stripeBalance);
        Account.Configuration.Merchant merchant = new Account.Configuration.Merchant();
        merchant.setCapabilities(capabilities);
        Account.Configuration configuration = new Account.Configuration();
        configuration.setMerchant(merchant);
        account.setConfiguration(configuration);
        return account;
    }
}
