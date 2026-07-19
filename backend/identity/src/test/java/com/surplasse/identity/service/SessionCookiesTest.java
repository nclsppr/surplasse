package com.surplasse.identity.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.surplasse.identity.config.IdentityConfig;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class SessionCookiesTest {

    private static final Instant NOW = Instant.parse("2026-07-19T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void access_developmentCookie_isHostOnlyHttpOnlyAndNotSecure() {
        String cookie = cookies(false).access("access-token", NOW.plusSeconds(60));

        assertEquals("surplasse_session=access-token; Path=/; Max-Age=60; HttpOnly; SameSite=Lax", cookie);
        assertFalse(cookie.contains("Domain="));
        assertFalse(cookie.contains("; Secure"));
    }

    @Test
    void refresh_productionCookie_usesRestrictedPathSecureAndRoundedMaxAge() {
        String cookie = cookies(true).refresh("refresh-token", NOW.plusMillis(60_001));

        assertEquals(
                "surplasse_refresh=refresh-token; Path=/v1/auth/sessions; Max-Age=61; HttpOnly; SameSite=Lax; Secure",
                cookie);
        assertFalse(cookie.contains("Domain="));
    }

    @Test
    void access_alreadyExpiredCookie_hasZeroMaxAge() {
        String cookie = cookies(false).access("expired-token", NOW.minusSeconds(1));

        assertTrue(cookie.contains("Max-Age=0"));
    }

    @Test
    void clearCookies_useTheirOriginalPathsAndZeroMaxAge() {
        SessionCookies cookies = cookies(true);

        assertEquals("surplasse_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure", cookies.clearAccess());
        assertEquals(
                "surplasse_refresh=; Path=/v1/auth/sessions; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
                cookies.clearRefresh());
    }

    private SessionCookies cookies(boolean secure) {
        IdentityConfig config = mock(IdentityConfig.class);
        when(config.secureCookies()).thenReturn(secure);
        return new SessionCookies(config, CLOCK);
    }
}
