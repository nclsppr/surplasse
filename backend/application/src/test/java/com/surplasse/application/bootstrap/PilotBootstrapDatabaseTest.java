package com.surplasse.application.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PilotBootstrapDatabaseTest.EmptyProductionSchemaProfile.class)
class PilotBootstrapDatabaseTest {

    private static final Instant CREATED_AT = Instant.parse("2026-08-18T08:00:00.123456Z");

    @Inject
    AgroalDataSource dataSource;

    @Test
    void apply_emptyDatabaseCreatesAtomicallyThenRerunsWithoutMutationAndRejectsDrift() throws SQLException {
        PilotBootstrapDatabase database =
                new PilotBootstrapDatabase((ignoredUrl, ignoredProperties) -> dataSource.getConnection());
        PilotBootstrapSettings settings = PilotBootstrapFixtures.settings(PilotBootstrapSettings.Operation.APPLY);
        PilotBootstrapManifest manifest = PilotBootstrapFixtures.manifest();
        StripePilotAccountVerifier.Snapshot stripe =
                new StripePilotAccountVerifier.Snapshot(manifest.establishment().stripeAccountId(), false);

        assertEquals(
                PilotBootstrapDatabase.GraphState.EMPTY,
                database.status(settings, PilotBootstrapFixtures.databasePassword(), manifest, stripe));

        assertThrows(
                PilotBootstrapException.class,
                () -> database.apply(
                        settings,
                        PilotBootstrapFixtures.databasePassword(),
                        manifest,
                        stripe,
                        CREATED_AT,
                        new ThrowingRandom()));
        assertEquals(0, structuralRowCount());

        assertEquals(
                PilotBootstrapDatabase.ApplyResult.CREATED,
                database.apply(
                        settings,
                        PilotBootstrapFixtures.databasePassword(),
                        manifest,
                        stripe,
                        CREATED_AT,
                        new SecureRandom()));
        PersistedProof first = proof();
        assertTrue(first.tableCode().matches("^tbl_[0-9a-f]{32}$"));
        assertEquals(CREATED_AT, first.activatedAt());
        assertEquals("paused", first.orderIntakeStatus());
        assertEquals(6, structuralRowCount());

        assertEquals(
                PilotBootstrapDatabase.ApplyResult.UNCHANGED,
                database.apply(
                        settings,
                        PilotBootstrapFixtures.databasePassword(),
                        manifest,
                        stripe,
                        CREATED_AT.plusSeconds(3600),
                        new SecureRandom()));
        assertEquals(first, proof());

        insertMagicLinkSession(manifest);
        PilotBootstrapException extraRow = assertThrows(
                PilotBootstrapException.class,
                () -> database.status(settings, PilotBootstrapFixtures.databasePassword(), manifest, stripe));
        assertEquals(PilotBootstrapException.DRIFT_EXIT, extraRow.exitCode());
        execute("delete from magic_link_session");
        assertEquals(
                PilotBootstrapDatabase.GraphState.EXACT,
                database.status(settings, PilotBootstrapFixtures.databasePassword(), manifest, stripe));

        execute("update product set price_cents = price_cents + 1");
        PilotBootstrapException drift = assertThrows(
                PilotBootstrapException.class,
                () -> database.status(settings, PilotBootstrapFixtures.databasePassword(), manifest, stripe));
        assertEquals(PilotBootstrapException.DRIFT_EXIT, drift.exitCode());
        PersistedProof afterDrift = proof();
        assertEquals(first.tableCode(), afterDrift.tableCode());
        assertEquals(first.activatedAt(), afterDrift.activatedAt());
        assertNotEquals(first.productPriceCents(), afterDrift.productPriceCents());
    }

    private int structuralRowCount() throws SQLException {
        try (Connection connection = dataSource.getConnection();
                Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery("""
                        select
                            (select count(*) from restaurateur)
                          + (select count(*) from establishment)
                          + (select count(*) from menu)
                          + (select count(*) from category)
                          + (select count(*) from product)
                          + (select count(*) from table_qr)
                        """)) {
            result.next();
            return result.getInt(1);
        }
    }

    private PersistedProof proof() throws SQLException {
        try (Connection connection = dataSource.getConnection();
                Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery("""
                        select t.code, e.activated_at, e.order_intake_status, p.price_cents
                        from table_qr t
                        join establishment e on e.id = t.establishment_id
                        cross join product p
                        """)) {
            result.next();
            return new PersistedProof(
                    result.getString(1),
                    result.getObject(2, java.time.OffsetDateTime.class).toInstant(),
                    result.getString(3),
                    result.getInt(4));
        }
    }

    private void execute(String sql) throws SQLException {
        try (Connection connection = dataSource.getConnection();
                Statement statement = connection.createStatement()) {
            statement.executeUpdate(sql);
        }
    }

    private void insertMagicLinkSession(PilotBootstrapManifest manifest) throws SQLException {
        try (Connection connection = dataSource.getConnection();
                var statement = connection.prepareStatement("""
                        insert into magic_link_session
                            (id, restaurateur_id, token_hash, expires_at, created_at)
                        values (?, ?, ?, now() + interval '1 hour', now())
                        """)) {
            statement.setObject(1, java.util.UUID.randomUUID());
            statement.setObject(2, manifest.restaurateur().id());
            statement.setString(3, "a".repeat(64));
            statement.executeUpdate();
        }
    }

    private record PersistedProof(
            String tableCode, Instant activatedAt, String orderIntakeStatus, int productPriceCents) {}

    private static final class ThrowingRandom extends SecureRandom {

        @Override
        public void nextBytes(byte[] bytes) {
            throw new IllegalStateException("synthetic entropy failure");
        }
    }

    public static final class EmptyProductionSchemaProfile implements QuarkusTestProfile {

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "quarkus.datasource.devservices.db-name", "surplasse_pilot_bootstrap_test",
                    "quarkus.flyway.locations", "classpath:db/migration");
        }
    }
}
