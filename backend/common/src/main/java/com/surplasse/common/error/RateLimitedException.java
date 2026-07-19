package com.surplasse.common.error;

/** A sensitive operation exceeded its configured request window. */
public class RateLimitedException extends DomainException {

    private final long retryAfterSeconds;

    public RateLimitedException(String message, long retryAfterSeconds) {
        super("rate-limited", "Rate limit exceeded", 429, message);
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    public long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
