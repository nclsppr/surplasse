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
}
