package com.surplasse.application.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DatabaseMigrationCommandTest {

    @Test
    void settings_completePostgresEnvironment_returnsExactValues() {
        var settings = DatabaseMigrationCommand.MigrationSettings.from(Map.of(
                "QUARKUS_DATASOURCE_JDBC_URL", "jdbc:postgresql://postgresql:5432/surplasse",
                "QUARKUS_DATASOURCE_USERNAME", "surplasse_migrator",
                "QUARKUS_DATASOURCE_PASSWORD", "test-only-password"));

        assertEquals("jdbc:postgresql://postgresql:5432/surplasse", settings.jdbcUrl());
        assertEquals("surplasse_migrator", settings.username());
        assertEquals("test-only-password", settings.password());
    }

    @Test
    void settings_missingValue_failsClosedWithoutEchoingConfiguredPassword() {
        Map<String, String> environment = new HashMap<>();
        environment.put("QUARKUS_DATASOURCE_JDBC_URL", "jdbc:postgresql://postgresql:5432/surplasse");
        environment.put("QUARKUS_DATASOURCE_PASSWORD", "do-not-echo-this-value");

        var error = assertThrows(
                IllegalArgumentException.class, () -> DatabaseMigrationCommand.MigrationSettings.from(environment));

        assertEquals("QUARKUS_DATASOURCE_USERNAME is required.", error.getMessage());
    }

    @Test
    void settings_nonPostgresJdbcUrl_failsClosed() {
        Map<String, String> environment = Map.of(
                "QUARKUS_DATASOURCE_JDBC_URL", "jdbc:h2:mem:surplasse",
                "QUARKUS_DATASOURCE_USERNAME", "surplasse_migrator",
                "QUARKUS_DATASOURCE_PASSWORD", "test-only-password");

        var error = assertThrows(
                IllegalArgumentException.class, () -> DatabaseMigrationCommand.MigrationSettings.from(environment));

        assertEquals("QUARKUS_DATASOURCE_JDBC_URL must use PostgreSQL JDBC.", error.getMessage());
    }
}
