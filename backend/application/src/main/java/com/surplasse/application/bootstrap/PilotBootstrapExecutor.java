package com.surplasse.application.bootstrap;

import java.security.SecureRandom;
import java.time.Clock;

final class PilotBootstrapExecutor {

    private final AccountVerifier accountVerifier;
    private final DatabaseOperations database;
    private final Clock clock;
    private final SecureRandom random;

    PilotBootstrapExecutor(
            AccountVerifier accountVerifier, DatabaseOperations database, Clock clock, SecureRandom random) {
        this.accountVerifier = accountVerifier;
        this.database = database;
        this.clock = clock;
        this.random = random;
    }

    Result execute(
            PilotBootstrapSettings settings,
            String databasePassword,
            String stripeKey,
            PilotBootstrapManifest manifest) {
        StripePilotAccountVerifier.Snapshot stripe =
                accountVerifier.verify(manifest.establishment().stripeAccountId(), stripeKey);
        return switch (settings.operation()) {
            case APPLY ->
                switch (database.apply(settings, databasePassword, manifest, stripe, clock.instant(), random)) {
                    case CREATED -> Result.CREATED;
                    case UNCHANGED -> Result.UNCHANGED;
                };
            case STATUS ->
                switch (database.status(settings, databasePassword, manifest, stripe)) {
                    case EMPTY -> Result.EMPTY;
                    case EXACT -> Result.EXACT;
                };
        };
    }

    enum Result {
        CREATED,
        UNCHANGED,
        EMPTY,
        EXACT
    }

    @FunctionalInterface
    interface AccountVerifier {
        StripePilotAccountVerifier.Snapshot verify(String connectedAccountId, String restrictedTestKey);
    }

    interface DatabaseOperations {
        PilotBootstrapDatabase.ApplyResult apply(
                PilotBootstrapSettings settings,
                String databasePassword,
                PilotBootstrapManifest manifest,
                StripePilotAccountVerifier.Snapshot stripe,
                java.time.Instant now,
                SecureRandom random);

        PilotBootstrapDatabase.GraphState status(
                PilotBootstrapSettings settings,
                String databasePassword,
                PilotBootstrapManifest manifest,
                StripePilotAccountVerifier.Snapshot stripe);
    }
}
