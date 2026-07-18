package com.surplasse.common.error;

/** An external dependency (Stripe, OpenAI API, ...) is unreachable or not configured. */
public class DependencyUnavailableException extends DomainException {

    public DependencyUnavailableException(String message) {
        super("dependency-unavailable", "Dependency unavailable", 503, message);
    }
}
