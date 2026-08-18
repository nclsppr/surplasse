package com.surplasse.application.bootstrap;

import java.nio.charset.StandardCharsets;
import java.util.Map;

final class PilotBootstrapFixtures {

    private PilotBootstrapFixtures() {}

    static PilotBootstrapManifest manifest() {
        return PilotBootstrapManifest.parse(manifestJson().getBytes(StandardCharsets.UTF_8));
    }

    static String manifestJson() {
        return """
                {
                  "contract": "surplasse.pilot-bootstrap",
                  "schema": 1,
                  "mode": "testers",
                  "restaurateur": {
                    "id": "11111111-1111-4111-8111-111111111111",
                    "email": "tester@restaurant.invalid",
                    "full_name": "Testeur Pilote",
                    "phone": null
                  },
                  "establishment": {
                    "id": "22222222-2222-4222-8222-222222222222",
                    "name": "Restaurant Pilote",
                    "slug": "restaurant-pilote",
                    "address": "1 rue du Test, 75001 Paris",
                    "stripe_account_id": "acct_TestPilot1234"
                  },
                  "menu": {
                    "id": "33333333-3333-4333-8333-333333333333",
                    "name": "Carte pilote"
                  },
                  "category": {
                    "id": "44444444-4444-4444-8444-444444444444",
                    "name": "Plats"
                  },
                  "product": {
                    "id": "55555555-5555-4555-8555-555555555555",
                    "name": "Produit pilote",
                    "description": null,
                    "price_cents": 1200,
                    "currency": "eur"
                  },
                  "table": {
                    "id": "66666666-6666-4666-8666-666666666666",
                    "label": "Table pilote"
                  }
                }
                """;
    }

    static PilotBootstrapSettings settings(PilotBootstrapSettings.Operation operation) {
        return new PilotBootstrapSettings(
                operation,
                PilotBootstrapSettings.MANIFEST_FILE,
                PilotBootstrapSettings.JDBC_URL,
                PilotBootstrapSettings.DATABASE_USERNAME,
                PilotBootstrapSettings.DATABASE_PASSWORD_FILE,
                PilotBootstrapSettings.STRIPE_KEY_FILE);
    }

    static Map<String, String> environment() {
        return Map.of(
                "DEPLOYMENT_PROFILE",
                "production",
                "SURPLASSE_PRODUCTION_RELEASE_MODE",
                "testers",
                "STRIPE_LIVE_MODE",
                "false",
                "PILOT_BOOTSTRAP_MANIFEST_FILE",
                PilotBootstrapSettings.MANIFEST_FILE.toString(),
                "QUARKUS_DATASOURCE_JDBC_URL",
                PilotBootstrapSettings.JDBC_URL,
                "QUARKUS_DATASOURCE_USERNAME",
                PilotBootstrapSettings.DATABASE_USERNAME,
                "QUARKUS_DATASOURCE_PASSWORD_FILE",
                PilotBootstrapSettings.DATABASE_PASSWORD_FILE.toString(),
                "STRIPE_SECRET_KEY_FILE",
                PilotBootstrapSettings.STRIPE_KEY_FILE.toString());
    }

    static String restrictedTestKey() {
        return String.join("", "rk", "_test_", "A".repeat(24));
    }

    static String databasePassword() {
        return "B".repeat(48);
    }
}
