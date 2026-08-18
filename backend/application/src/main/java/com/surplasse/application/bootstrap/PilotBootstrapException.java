package com.surplasse.application.bootstrap;

final class PilotBootstrapException extends RuntimeException {

    static final int CONFIGURATION_EXIT = 64;
    static final int DRIFT_EXIT = 65;
    static final int DEPENDENCY_EXIT = 69;
    static final int DATABASE_EXIT = 70;

    private final int exitCode;

    private PilotBootstrapException(int exitCode, String message) {
        super(message);
        this.exitCode = exitCode;
    }

    static PilotBootstrapException configuration(String message) {
        return new PilotBootstrapException(CONFIGURATION_EXIT, message);
    }

    static PilotBootstrapException drift(String message) {
        return new PilotBootstrapException(DRIFT_EXIT, message);
    }

    static PilotBootstrapException dependency(String message) {
        return new PilotBootstrapException(DEPENDENCY_EXIT, message);
    }

    static PilotBootstrapException database() {
        return new PilotBootstrapException(DATABASE_EXIT, "PostgreSQL did not complete the bounded operation.");
    }

    int exitCode() {
        return exitCode;
    }
}
