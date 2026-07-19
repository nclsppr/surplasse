package com.surplasse.identity.service;

import com.surplasse.common.error.RateLimitedException;
import com.surplasse.identity.config.IdentityConfig;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@ApplicationScoped
public class MagicLinkRateLimiter {

    private final IdentityConfig config;
    private final Map<String, Window> emailWindows = new ConcurrentHashMap<>();
    private final Map<String, Window> ipWindows = new ConcurrentHashMap<>();

    MagicLinkRateLimiter(IdentityConfig config) {
        this.config = config;
    }

    @PostConstruct
    void validateConfiguration() {
        if (config.rateLimit().window().isZero()
                || config.rateLimit().window().isNegative()
                || config.rateLimit().maxPerEmail() < 1
                || config.rateLimit().maxPerIp() < 1) {
            throw new IllegalStateException("Identity rate-limit configuration must be positive.");
        }
    }

    public void check(String normalizedEmail, String sourceIp, Instant now) {
        String safeIp = sourceIp == null || sourceIp.isBlank() ? "unknown" : sourceIp;
        long ipRetry =
                record(ipWindows, Tokens.sha256(safeIp), config.rateLimit().maxPerIp(), now);
        if (ipRetry > 0) {
            throw limited(ipRetry);
        }

        long emailRetry = record(
                emailWindows, Tokens.sha256(normalizedEmail), config.rateLimit().maxPerEmail(), now);
        if (emailRetry > 0) {
            throw limited(emailRetry);
        }
    }

    void prune(Instant now) {
        emailWindows.values().removeIf(window -> !window.resetAt().isAfter(now));
        ipWindows.values().removeIf(window -> !window.resetAt().isAfter(now));
    }

    private long record(Map<String, Window> windows, String key, int maximum, Instant now) {
        AtomicLong retryAfter = new AtomicLong();
        windows.compute(key, (ignored, current) -> {
            if (current == null || !current.resetAt().isAfter(now)) {
                return new Window(1, now.plus(config.rateLimit().window()));
            }
            if (current.count() >= maximum) {
                retryAfter.set(secondsUntil(current.resetAt(), now));
                return current;
            }
            return new Window(current.count() + 1, current.resetAt());
        });
        return retryAfter.get();
    }

    private static long secondsUntil(Instant resetAt, Instant now) {
        long millis = Math.max(1, Duration.between(now, resetAt).toMillis());
        return Math.max(1, (millis + 999) / 1000);
    }

    private static RateLimitedException limited(long retryAfter) {
        return new RateLimitedException("Too many magic link requests. Try again later.", retryAfter);
    }

    private record Window(int count, Instant resetAt) {}
}
