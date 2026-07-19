package com.surplasse.common.error;

/** Missing, unknown or expired credential. Carries its precise problem type. */
public class UnauthenticatedException extends DomainException {

    public UnauthenticatedException(String problemType, String title, String message) {
        super(problemType, title, 401, message);
    }

    public static UnauthenticatedException tableSessionExpired() {
        return new UnauthenticatedException(
                "table-session-expired", "Table session expired", "The table session token is expired or unknown.");
    }

    public static UnauthenticatedException magicLinkExpired() {
        return new UnauthenticatedException(
                "magic-link-expired", "Magic link expired", "This magic link is expired, unknown or already used.");
    }

    public static UnauthenticatedException restaurateurSessionExpired() {
        return new UnauthenticatedException(
                "session-expired", "Session expired", "The restaurateur session is expired or missing.");
    }
}
