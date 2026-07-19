package com.surplasse.identity.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.surplasse.common.error.RateLimitedException;
import com.surplasse.identity.config.IdentityConfig;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class MagicLinkRateLimiterTest {

    private static final Instant NOW = Instant.parse("2026-07-19T12:00:00Z");

    @Test
    void check_emailLimitExceeded_returnsRetryAfterForTheCurrentWindow() {
        MagicLinkRateLimiter limiter = limiter(2, 20, Duration.ofMinutes(1));
        limiter.check("camille@example.com", "192.0.2.1", NOW);
        limiter.check("camille@example.com", "192.0.2.2", NOW);

        RateLimitedException exception = assertThrows(
                RateLimitedException.class, () -> limiter.check("camille@example.com", "192.0.2.3", NOW.plusMillis(1)));

        assertEquals(429, exception.status());
        assertEquals("rate-limited", exception.problemType());
        assertEquals(60, exception.retryAfterSeconds());
    }

    @Test
    void check_ipLimitExceeded_returnsRetryAfterForTheCurrentWindow() {
        MagicLinkRateLimiter limiter = limiter(20, 2, Duration.ofMinutes(1));
        limiter.check("first@example.com", "192.0.2.1", NOW);
        limiter.check("second@example.com", "192.0.2.1", NOW);

        RateLimitedException exception = assertThrows(
                RateLimitedException.class, () -> limiter.check("third@example.com", "192.0.2.1", NOW.plusSeconds(1)));

        assertEquals(59, exception.retryAfterSeconds());
    }

    @Test
    void check_windowReachedItsResetTime_acceptsAnewRequest() {
        MagicLinkRateLimiter limiter = limiter(1, 1, Duration.ofMinutes(1));
        limiter.check("camille@example.com", "192.0.2.1", NOW);

        assertDoesNotThrow(() -> limiter.check("camille@example.com", "192.0.2.1", NOW.plusSeconds(60)));
    }

    private MagicLinkRateLimiter limiter(int maxPerEmail, int maxPerIp, Duration window) {
        IdentityConfig config = mock(IdentityConfig.class);
        IdentityConfig.RateLimit rateLimit = mock(IdentityConfig.RateLimit.class);
        when(config.rateLimit()).thenReturn(rateLimit);
        when(rateLimit.window()).thenReturn(window);
        when(rateLimit.maxPerEmail()).thenReturn(maxPerEmail);
        when(rateLimit.maxPerIp()).thenReturn(maxPerIp);
        MagicLinkRateLimiter limiter = new MagicLinkRateLimiter(config);
        limiter.validateConfiguration();
        return limiter;
    }
}
