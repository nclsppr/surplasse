package com.surplasse.common.error;

/**
 * Unknown resource, or resource outside the caller's scope: both yield a 404
 * without distinction, so that existence is never confirmed to an outsider.
 */
public class NotFoundException extends DomainException {

    public NotFoundException(String message) {
        super("resource-not-found", "Resource not found", 404, message);
    }
}
