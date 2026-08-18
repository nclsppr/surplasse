package com.surplasse.application.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class PilotBootstrapManifestTest {

    @Test
    void parse_exactTesterManifest_returnsBoundedGraph() {
        PilotBootstrapManifest manifest = PilotBootstrapFixtures.manifest();

        assertEquals("restaurant-pilote", manifest.establishment().slug());
        assertEquals("eur", manifest.product().currency());
    }

    @Test
    void parse_duplicateField_failsClosed() {
        String invalid =
                PilotBootstrapFixtures.manifestJson().replace("\"schema\": 1,", "\"schema\": 1,\n  \"schema\": 1,");

        PilotBootstrapException error = assertThrows(
                PilotBootstrapException.class,
                () -> PilotBootstrapManifest.parse(invalid.getBytes(StandardCharsets.UTF_8)));

        assertEquals(PilotBootstrapException.CONFIGURATION_EXIT, error.exitCode());
    }

    @Test
    void parse_unknownSecretField_failsWithoutEchoingValue() {
        String marker = String.join("", "do", "-not-", "echo");
        String invalid = PilotBootstrapFixtures.manifestJson()
                .replace(
                        "\"mode\": \"testers\",",
                        "\"mode\": \"testers\",\n  \"stripe_secret_key\": \"" + marker + "\",");

        PilotBootstrapException error = assertThrows(
                PilotBootstrapException.class,
                () -> PilotBootstrapManifest.parse(invalid.getBytes(StandardCharsets.UTF_8)));

        org.junit.jupiter.api.Assertions.assertFalse(error.getMessage().contains(marker));
    }

    @Test
    void parse_reservedSlug_failsClosed() {
        for (String reserved : java.util.List.of("api", "autodiscover", "mta-sts", "status")) {
            String invalid = PilotBootstrapFixtures.manifestJson()
                    .replace("\"slug\": \"restaurant-pilote\"", "\"slug\": \"" + reserved + "\"");

            assertThrows(
                    PilotBootstrapException.class,
                    () -> PilotBootstrapManifest.parse(invalid.getBytes(StandardCharsets.UTF_8)),
                    reserved);
        }
    }

    @Test
    void parse_duplicateUuid_failsClosed() {
        String invalid = PilotBootstrapFixtures.manifestJson()
                .replace(
                        "\"id\": \"22222222-2222-4222-8222-222222222222\"",
                        "\"id\": \"11111111-1111-4111-8111-111111111111\"");

        assertThrows(
                PilotBootstrapException.class,
                () -> PilotBootstrapManifest.parse(invalid.getBytes(StandardCharsets.UTF_8)));
    }
}
