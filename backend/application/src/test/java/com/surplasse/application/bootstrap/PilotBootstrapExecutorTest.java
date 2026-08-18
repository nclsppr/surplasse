package com.surplasse.application.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class PilotBootstrapExecutorTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-08-18T08:00:00Z"), ZoneOffset.UTC);

    @Test
    void execute_applyVerifiesStripeBeforeOpeningDatabase() {
        List<String> events = new ArrayList<>();
        PilotBootstrapExecutor executor = new PilotBootstrapExecutor(
                (accountId, key) -> {
                    events.add("stripe");
                    return new StripePilotAccountVerifier.Snapshot(accountId, false);
                },
                new FakeDatabase(events),
                CLOCK,
                new SecureRandom());

        PilotBootstrapExecutor.Result result = executor.execute(
                PilotBootstrapFixtures.settings(PilotBootstrapSettings.Operation.APPLY),
                PilotBootstrapFixtures.databasePassword(),
                PilotBootstrapFixtures.restrictedTestKey(),
                PilotBootstrapFixtures.manifest());

        assertEquals(PilotBootstrapExecutor.Result.CREATED, result);
        assertEquals(List.of("stripe", "database-apply"), events);
    }

    @Test
    void execute_stripeFailureNeverCallsDatabase() {
        List<String> events = new ArrayList<>();
        PilotBootstrapExecutor executor = new PilotBootstrapExecutor(
                (accountId, key) -> {
                    events.add("stripe");
                    throw PilotBootstrapException.dependency("Stripe unavailable.");
                },
                new FakeDatabase(events),
                CLOCK,
                new SecureRandom());

        assertThrows(
                PilotBootstrapException.class,
                () -> executor.execute(
                        PilotBootstrapFixtures.settings(PilotBootstrapSettings.Operation.APPLY),
                        PilotBootstrapFixtures.databasePassword(),
                        PilotBootstrapFixtures.restrictedTestKey(),
                        PilotBootstrapFixtures.manifest()));
        assertEquals(List.of("stripe"), events);
    }

    @Test
    void execute_statusVerifiesStripeThenReadsGraph() {
        List<String> events = new ArrayList<>();
        PilotBootstrapExecutor executor = new PilotBootstrapExecutor(
                (accountId, key) -> {
                    events.add("stripe");
                    return new StripePilotAccountVerifier.Snapshot(accountId, false);
                },
                new FakeDatabase(events),
                CLOCK,
                new SecureRandom());

        PilotBootstrapExecutor.Result result = executor.execute(
                PilotBootstrapFixtures.settings(PilotBootstrapSettings.Operation.STATUS),
                PilotBootstrapFixtures.databasePassword(),
                PilotBootstrapFixtures.restrictedTestKey(),
                PilotBootstrapFixtures.manifest());

        assertEquals(PilotBootstrapExecutor.Result.EXACT, result);
        assertEquals(List.of("stripe", "database-status"), events);
    }

    private static final class FakeDatabase implements PilotBootstrapExecutor.DatabaseOperations {

        private final List<String> events;

        private FakeDatabase(List<String> events) {
            this.events = events;
        }

        @Override
        public PilotBootstrapDatabase.ApplyResult apply(
                PilotBootstrapSettings settings,
                String databasePassword,
                PilotBootstrapManifest manifest,
                StripePilotAccountVerifier.Snapshot stripe,
                Instant now,
                SecureRandom random) {
            events.add("database-apply");
            return PilotBootstrapDatabase.ApplyResult.CREATED;
        }

        @Override
        public PilotBootstrapDatabase.GraphState status(
                PilotBootstrapSettings settings,
                String databasePassword,
                PilotBootstrapManifest manifest,
                StripePilotAccountVerifier.Snapshot stripe) {
            events.add("database-status");
            return PilotBootstrapDatabase.GraphState.EXACT;
        }
    }
}
