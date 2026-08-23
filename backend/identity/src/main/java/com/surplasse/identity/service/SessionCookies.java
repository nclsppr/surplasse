package com.surplasse.identity.service;

import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.identity.config.IdentityConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.NewCookie;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/** Builds the two host-only session cookies with identical attributes in every response. */
@ApplicationScoped
public class SessionCookies {

    public static final String ACCESS_COOKIE = RestaurateurIdentityGateway.ACCESS_COOKIE;
    public static final String REFRESH_COOKIE = "surplasse_refresh";

    private static final String ACCESS_PATH = "/";
    private static final String REFRESH_PATH = "/v1/auth/sessions";

    private final IdentityConfig config;
    private final Clock clock;

    SessionCookies(IdentityConfig config, Clock clock) {
        this.config = config;
        this.clock = clock;
    }

    public NewCookie access(String value, Instant expiresAt) {
        return value(ACCESS_COOKIE, value, ACCESS_PATH, expiresAt);
    }

    public NewCookie refresh(String value, Instant expiresAt) {
        return value(REFRESH_COOKIE, value, REFRESH_PATH, expiresAt);
    }

    public NewCookie clearAccess() {
        return cleared(ACCESS_COOKIE, ACCESS_PATH);
    }

    public NewCookie clearRefresh() {
        return cleared(REFRESH_COOKIE, REFRESH_PATH);
    }

    private NewCookie value(String name, String value, String path, Instant expiresAt) {
        return build(name, value, path, secondsUntil(expiresAt, clock.instant()));
    }

    private NewCookie cleared(String name, String path) {
        return build(name, "", path, 0);
    }

    private NewCookie build(String name, String value, String path, int maxAge) {
        return new NewCookie.Builder(name)
                .value(value)
                .path(path)
                .maxAge(maxAge)
                .httpOnly(true)
                .sameSite(NewCookie.SameSite.LAX)
                .secure(config.secureCookies())
                .build();
    }

    private static int secondsUntil(Instant expiresAt, Instant now) {
        long millis = Math.max(0, Duration.between(now, expiresAt).toMillis());
        return Math.toIntExact(Math.min(Integer.MAX_VALUE, (millis + 999) / 1000));
    }
}
