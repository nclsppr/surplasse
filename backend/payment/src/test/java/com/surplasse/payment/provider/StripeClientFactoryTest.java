package com.surplasse.payment.provider;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.surplasse.common.error.DependencyUnavailableException;
import org.junit.jupiter.api.Test;

class StripeClientFactoryTest {

    @Test
    void requireExpectedKeyMode_testEnvironment_rejectsLiveKey() {
        assertThrows(
                DependencyUnavailableException.class,
                () -> StripeClientFactory.requireExpectedKeyMode("sk_live_example", false));
    }

    @Test
    void requireExpectedKeyMode_liveEnvironment_rejectsTestKey() {
        assertThrows(
                DependencyUnavailableException.class,
                () -> StripeClientFactory.requireExpectedKeyMode("sk_test_example", true));
    }

    @Test
    void requireExpectedKeyMode_matchingModes_areAccepted() {
        StripeClientFactory.requireExpectedKeyMode("sk_test_example", false);
        StripeClientFactory.requireExpectedKeyMode("rk_live_example", true);
    }
}
