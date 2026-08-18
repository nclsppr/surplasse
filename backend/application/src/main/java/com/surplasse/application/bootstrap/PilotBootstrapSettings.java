package com.surplasse.application.bootstrap;

import java.nio.file.Path;
import java.util.Map;
import java.util.regex.Pattern;

record PilotBootstrapSettings(
        Operation operation,
        Path manifestFile,
        String jdbcUrl,
        String databaseUsername,
        Path databasePasswordFile,
        Path stripeKeyFile) {

    static final Path MANIFEST_FILE = Path.of("/run/surplasse/pilot-bootstrap.json");
    static final Path DATABASE_PASSWORD_FILE = Path.of("/run/secrets/surplasse_postgres_runtime_password");
    static final Path STRIPE_KEY_FILE = Path.of("/run/secrets/surplasse_stripe_secret_key");
    static final String JDBC_URL = "jdbc:postgresql://postgresql:5432/surplasse";
    static final String DATABASE_USERNAME = "surplasse_runtime";
    static final Pattern DATABASE_PASSWORD = Pattern.compile("[A-Za-z0-9_-]{32,128}\\n");
    static final Pattern STRIPE_TEST_KEY = Pattern.compile("rk_test_[A-Za-z0-9]{16,}\\n");

    static PilotBootstrapSettings from(String[] arguments, Map<String, String> environment) {
        if (arguments.length != 1) {
            throw PilotBootstrapException.configuration("The command accepts exactly one operation: apply or status.");
        }
        Operation operation = Operation.from(arguments[0]);
        requireExact(environment, "DEPLOYMENT_PROFILE", "production");
        requireExact(environment, "SURPLASSE_PRODUCTION_RELEASE_MODE", "testers");
        requireExact(environment, "STRIPE_LIVE_MODE", "false");
        requireAbsent(environment, "QUARKUS_DATASOURCE_PASSWORD");
        requireAbsent(environment, "STRIPE_SECRET_KEY");

        Path manifest = requireExactPath(environment, "PILOT_BOOTSTRAP_MANIFEST_FILE", MANIFEST_FILE);
        Path databasePassword =
                requireExactPath(environment, "QUARKUS_DATASOURCE_PASSWORD_FILE", DATABASE_PASSWORD_FILE);
        Path stripeKey = requireExactPath(environment, "STRIPE_SECRET_KEY_FILE", STRIPE_KEY_FILE);
        requireExact(environment, "QUARKUS_DATASOURCE_JDBC_URL", JDBC_URL);
        requireExact(environment, "QUARKUS_DATASOURCE_USERNAME", DATABASE_USERNAME);
        return new PilotBootstrapSettings(
                operation, manifest, JDBC_URL, DATABASE_USERNAME, databasePassword, stripeKey);
    }

    private static Path requireExactPath(Map<String, String> environment, String name, Path expected) {
        String value = environment.get(name);
        if (value == null || !expected.toString().equals(value)) {
            throw PilotBootstrapException.configuration(name + " differs from the fixed pilot contract.");
        }
        return expected;
    }

    private static void requireExact(Map<String, String> environment, String name, String expected) {
        if (!expected.equals(environment.get(name))) {
            throw PilotBootstrapException.configuration(name + " differs from the fixed pilot contract.");
        }
    }

    private static void requireAbsent(Map<String, String> environment, String name) {
        if (environment.get(name) != null && !environment.get(name).isBlank()) {
            throw PilotBootstrapException.configuration(name + " must use its protected file.");
        }
    }

    enum Operation {
        APPLY,
        STATUS;

        static Operation from(String value) {
            return switch (value) {
                case "apply" -> APPLY;
                case "status" -> STATUS;
                default ->
                    throw PilotBootstrapException.configuration(
                            "The command accepts exactly one operation: apply or status.");
            };
        }
    }
}
