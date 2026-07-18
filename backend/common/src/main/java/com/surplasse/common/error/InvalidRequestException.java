package com.surplasse.common.error;

/** Syntactically invalid request detected by the application (e.g. unverifiable webhook signature). */
public class InvalidRequestException extends DomainException {

    public InvalidRequestException(String message) {
        super("validation-error", "Validation error", 400, message);
    }
}
