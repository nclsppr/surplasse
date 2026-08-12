package com.surplasse.application.migration;

import java.util.Map;
import org.flywaydb.core.Flyway;

/** Runs the versioned schema migrations without starting the HTTP application. */
public final class DatabaseMigrationCommand {

    private static final String JDBC_URL = "QUARKUS_DATASOURCE_JDBC_URL";
    private static final String USERNAME = "QUARKUS_DATASOURCE_USERNAME";
    private static final String PASSWORD = "QUARKUS_DATASOURCE_PASSWORD";

    private DatabaseMigrationCommand() {}

    public static void main(String[] arguments) {
        if (arguments.length != 0) {
            throw new IllegalArgumentException("The database migration command accepts no arguments.");
        }

        MigrationSettings settings = MigrationSettings.from(System.getenv());
        Flyway.configure(DatabaseMigrationCommand.class.getClassLoader())
                .dataSource(settings.jdbcUrl(), settings.username(), settings.password())
                .locations("classpath:db/migration")
                .baselineOnMigrate(false)
                .cleanDisabled(true)
                .outOfOrder(false)
                .validateMigrationNaming(true)
                .load()
                .migrate();
        System.out.println("Database migrations completed successfully.");
    }

    record MigrationSettings(String jdbcUrl, String username, String password) {

        static MigrationSettings from(Map<String, String> environment) {
            String jdbcUrl = required(environment, JDBC_URL);
            if (!jdbcUrl.startsWith("jdbc:postgresql://")) {
                throw new IllegalArgumentException(JDBC_URL + " must use PostgreSQL JDBC.");
            }
            return new MigrationSettings(jdbcUrl, required(environment, USERNAME), required(environment, PASSWORD));
        }

        private static String required(Map<String, String> environment, String name) {
            String value = environment.get(name);
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException(name + " is required.");
            }
            return value;
        }
    }
}
