package com.surplasse.common.error;

/** A resource exists but is outside the authenticated restaurateur's establishment scope. */
public class AccessDeniedException extends DomainException {

    public AccessDeniedException(String message) {
        super("resource-not-found", "Resource not found", 404, message);
    }
}
