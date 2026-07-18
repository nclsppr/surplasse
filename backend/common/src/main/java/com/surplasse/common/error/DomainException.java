package com.surplasse.common.error;

/**
 * Base of the domain exception hierarchy. Every domain module throws
 * subclasses of this type; the mappers in this package convert them to RFC
 * 9457 Problem Details responses, the single error format of the contract.
 */
public abstract class DomainException extends RuntimeException {

    private final String problemType;
    private final String title;
    private final int status;

    protected DomainException(String problemType, String title, int status, String message) {
        super(message);
        this.problemType = problemType;
        this.title = title;
        this.status = status;
    }

    /** Stable suffix of the problem type URI, e.g. {@code resource-not-found}. */
    public String problemType() {
        return problemType;
    }

    /** Short human-readable summary of the error type. */
    public String title() {
        return title;
    }

    /** HTTP status code carried by this error. */
    public int status() {
        return status;
    }
}
