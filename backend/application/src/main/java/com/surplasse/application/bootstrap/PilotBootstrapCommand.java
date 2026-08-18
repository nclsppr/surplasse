package com.surplasse.application.bootstrap;

import java.io.PrintStream;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Arrays;
import java.util.Map;

/** Creates or verifies the single production tester pilot without starting HTTP. */
public final class PilotBootstrapCommand {

    private static final int EMPTY_STATUS_EXIT = 3;

    private PilotBootstrapCommand() {}

    public static void main(String[] arguments) {
        int exitCode = run(arguments, System.getenv(), System.out, System.err);
        if (exitCode != 0) {
            System.exit(exitCode);
        }
    }

    static int run(
            String[] arguments,
            Map<String, String> environment,
            PrintStream standardOutput,
            PrintStream standardError) {
        byte[] manifestBytes = null;
        try {
            PilotBootstrapSettings settings = PilotBootstrapSettings.from(arguments, environment);
            manifestBytes = ProtectedPilotFile.readManifest(settings.manifestFile());
            PilotBootstrapManifest manifest = PilotBootstrapManifest.parse(manifestBytes);
            String databasePassword = ProtectedPilotFile.readSecret(
                    settings.databasePasswordFile(), PilotBootstrapSettings.DATABASE_PASSWORD, "database password");
            String stripeKey = ProtectedPilotFile.readSecret(
                    settings.stripeKeyFile(), PilotBootstrapSettings.STRIPE_TEST_KEY, "Stripe restricted test key");
            StripePilotAccountVerifier stripe = new StripePilotAccountVerifier();
            PilotBootstrapExecutor.Result result = new PilotBootstrapExecutor(
                            stripe::verify, new PilotBootstrapDatabase(), Clock.systemUTC(), new SecureRandom())
                    .execute(settings, databasePassword, stripeKey, manifest);
            return report(result, standardOutput);
        } catch (PilotBootstrapException exception) {
            standardError.println("Pilot bootstrap refused: " + exception.getMessage());
            return exception.exitCode();
        } catch (RuntimeException exception) {
            standardError.println("Pilot bootstrap refused: an unexpected bounded operation failed.");
            return PilotBootstrapException.DATABASE_EXIT;
        } finally {
            if (manifestBytes != null) {
                Arrays.fill(manifestBytes, (byte) 0);
            }
        }
    }

    private static int report(PilotBootstrapExecutor.Result result, PrintStream output) {
        return switch (result) {
            case CREATED -> {
                output.println("Pilot bootstrap applied: the exact tester graph was created with order intake paused.");
                yield 0;
            }
            case UNCHANGED -> {
                output.println(
                        "Pilot bootstrap applied: the exact tester graph was already present with order intake paused.");
                yield 0;
            }
            case EXACT -> {
                output.println("Pilot bootstrap status: the exact tester graph is present with order intake paused.");
                yield 0;
            }
            case EMPTY -> {
                output.println("Pilot bootstrap status: the Flyway V14 database is empty.");
                yield EMPTY_STATUS_EXIT;
            }
        };
    }
}
