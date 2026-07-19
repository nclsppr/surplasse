package com.surplasse.identity.service;

import com.surplasse.identity.config.IdentityConfig;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/** Builds the two host-only session cookies with identical attributes in every response. */
@ApplicationScoped
public class SessionCookies {

    public static final String ACCESS_COOKIE = "surplasse_session";
    public static final String REFRESH_COOKIE = "surplasse_refresh";

    private static final String ACCESS_PATH = "/";
    private static final String REFRESH_PATH = "/v1/auth/sessions";

    private final IdentityConfig config;
    private final Clock clock;

    SessionCookies(IdentityConfig config, Clock clock) {
        this.config = config;
        this.clock = clock;
    }

    public String access(String value, Instant expiresAt) {
        return value(ACCESS_COOKIE, value, ACCESS_PATH, expiresAt);
    }

    public String refresh(String value, Instant expiresAt) {
        return value(REFRESH_COOKIE, value, REFRESH_PATH, expiresAt);
    }

    public String clearAccess() {
        return cleared(ACCESS_COOKIE, ACCESS_PATH);
    }

    public String clearRefresh() {
        return cleared(REFRESH_COOKIE, REFRESH_PATH);
    }

    private String value(String name, String value, String path, Instant expiresAt) {
        long maxAge = secondsUntil(expiresAt, clock.instant());
        return attributes(name + "=" + value, path, maxAge);
    }

    private String cleared(String name, String path) {
        return attributes(name + "=", path, 0);
    }

    private String attributes(String pair, String path, long maxAge) {
        return pair + "; Path=" + path + "; Max-Age=" + maxAge + "; HttpOnly; SameSite=Lax"
                + (config.secureCookies() ? "; Secure" : "");
    }

    private static long secondsUntil(Instant expiresAt, Instant now) {
        long millis = Math.max(0, Duration.between(now, expiresAt).toMillis());
        return (millis + 999) / 1000;
    }
}
