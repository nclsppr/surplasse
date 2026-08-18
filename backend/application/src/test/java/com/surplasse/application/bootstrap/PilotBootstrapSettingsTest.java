package com.surplasse.application.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PilotBootstrapSettingsTest {

    @Test
    void from_exactProductionTesterContract_acceptsApply() {
        PilotBootstrapSettings settings =
                PilotBootstrapSettings.from(new String[] {"apply"}, PilotBootstrapFixtures.environment());

        assertEquals(PilotBootstrapSettings.Operation.APPLY, settings.operation());
    }

    @Test
    void from_liveMode_failsClosed() {
        Map<String, String> environment = new HashMap<>(PilotBootstrapFixtures.environment());
        environment.put("STRIPE_LIVE_MODE", "true");

        assertThrows(
                PilotBootstrapException.class, () -> PilotBootstrapSettings.from(new String[] {"apply"}, environment));
    }

    @Test
    void from_directSecret_failsWithoutEchoingValue() {
        String marker = String.join("", "sensitive", "-marker");
        Map<String, String> environment = new HashMap<>(PilotBootstrapFixtures.environment());
        environment.put("STRIPE_SECRET_KEY", marker);

        PilotBootstrapException error = assertThrows(
                PilotBootstrapException.class, () -> PilotBootstrapSettings.from(new String[] {"status"}, environment));

        assertFalse(error.getMessage().contains(marker));
    }

    @Test
    void from_unknownOperation_failsClosed() {
        assertThrows(
                PilotBootstrapException.class,
                () -> PilotBootstrapSettings.from(new String[] {"serve"}, PilotBootstrapFixtures.environment()));
    }
}
