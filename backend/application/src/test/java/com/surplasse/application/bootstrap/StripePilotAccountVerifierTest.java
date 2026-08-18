package com.surplasse.application.bootstrap;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.stripe.model.v2.core.Account;
import org.junit.jupiter.api.Test;

class StripePilotAccountVerifierTest {

    private static final String ACCOUNT_ID = "acct_TestPilot1234";

    @Test
    void verify_activeTestMerchant_returnsExactSnapshot() {
        StripePilotAccountVerifier verifier =
                new StripePilotAccountVerifier((ignoredAccount, ignoredKey) -> account(false, "active", "active"));

        StripePilotAccountVerifier.Snapshot snapshot =
                verifier.verify(ACCOUNT_ID, PilotBootstrapFixtures.restrictedTestKey());

        assertTrue(snapshot.payoutsActive());
    }

    @Test
    void verify_liveAccount_failsClosed() {
        StripePilotAccountVerifier verifier =
                new StripePilotAccountVerifier((ignoredAccount, ignoredKey) -> account(true, "active", "active"));

        assertThrows(
                PilotBootstrapException.class,
                () -> verifier.verify(ACCOUNT_ID, PilotBootstrapFixtures.restrictedTestKey()));
    }

    @Test
    void verify_inactiveCardPayments_failsClosed() {
        StripePilotAccountVerifier verifier =
                new StripePilotAccountVerifier((ignoredAccount, ignoredKey) -> account(false, "restricted", "active"));

        PilotBootstrapException error = assertThrows(
                PilotBootstrapException.class,
                () -> verifier.verify(ACCOUNT_ID, PilotBootstrapFixtures.restrictedTestKey()));

        assertTrue(error.getMessage().contains("card_payments"));
    }

    private static Account account(boolean liveMode, String cardPaymentsStatus, String payoutsStatus) {
        Account account = new Account();
        account.setId(ACCOUNT_ID);
        account.setLivemode(liveMode);
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
