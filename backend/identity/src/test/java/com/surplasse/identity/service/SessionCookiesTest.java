package com.surplasse.identity.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.surplasse.identity.config.IdentityConfig;
import jakarta.ws.rs.core.NewCookie;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class SessionCookiesTest {

    private static final Instant NOW = Instant.parse("2026-07-19T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void access_developmentCookie_isHostOnlyHttpOnlyAndNotSecure() {
        NewCookie cookie = cookies(false).access("access-token", NOW.plusSeconds(60));

        assertEquals(SessionCookies.ACCESS_COOKIE, cookie.getName());
        assertEquals("access-token", cookie.getValue());
        assertEquals("/", cookie.getPath());
        assertEquals(60, cookie.getMaxAge());
        assertTrue(cookie.isHttpOnly());
        assertEquals(NewCookie.SameSite.LAX, cookie.getSameSite());
        assertNull(cookie.getDomain());
        assertFalse(cookie.isSecure());
    }

    @Test
    void refresh_productionCookie_usesRestrictedPathSecureAndRoundedMaxAge() {
        NewCookie cookie = cookies(true).refresh("refresh-token", NOW.plusMillis(60_001));

        assertEquals(SessionCookies.REFRESH_COOKIE, cookie.getName());
        assertEquals("refresh-token", cookie.getValue());
        assertEquals("/v1/auth/sessions", cookie.getPath());
        assertEquals(61, cookie.getMaxAge());
        assertTrue(cookie.isHttpOnly());
        assertEquals(NewCookie.SameSite.LAX, cookie.getSameSite());
        assertNull(cookie.getDomain());
        assertTrue(cookie.isSecure());
    }

    @Test
    void access_alreadyExpiredCookie_hasZeroMaxAge() {
        NewCookie cookie = cookies(false).access("expired-token", NOW.minusSeconds(1));

        assertEquals(0, cookie.getMaxAge());
    }

    @Test
    void clearCookies_useTheirOriginalPathsAndZeroMaxAge() {
        SessionCookies cookies = cookies(true);

        NewCookie access = cookies.clearAccess();
        NewCookie refresh = cookies.clearRefresh();

        assertEquals("", access.getValue());
        assertEquals("/", access.getPath());
        assertEquals(0, access.getMaxAge());
        assertTrue(access.isSecure());
        assertEquals("", refresh.getValue());
        assertEquals("/v1/auth/sessions", refresh.getPath());
        assertEquals(0, refresh.getMaxAge());
        assertTrue(refresh.isSecure());
    }

    private SessionCookies cookies(boolean secure) {
        IdentityConfig config = mock(IdentityConfig.class);
        when(config.secureCookies()).thenReturn(secure);
        return new SessionCookies(config, CLOCK);
    }
}
