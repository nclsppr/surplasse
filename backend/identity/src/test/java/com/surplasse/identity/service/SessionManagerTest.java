package com.surplasse.identity.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.error.UnauthenticatedException;
import com.surplasse.identity.config.IdentityConfig;
import com.surplasse.identity.entity.RefreshSession;
import com.surplasse.identity.entity.Restaurateur;
import com.surplasse.identity.repository.MagicLinkSessionRepository;
import com.surplasse.identity.repository.RefreshSessionRepository;
import com.surplasse.identity.repository.RestaurateurRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class SessionManagerTest {

    private static final Instant NOW = Instant.parse("2026-07-19T12:00:00Z");
    private static final String RAW_REFRESH_TOKEN = "r".repeat(43);

    private RestaurateurRepository restaurateurs;
    private RefreshSessionRepository refreshSessions;
    private JwtTokenService jwtTokens;
    private SessionManager manager;

    @BeforeEach
    void setUp() {
        restaurateurs = mock(RestaurateurRepository.class);
        MagicLinkSessionRepository magicLinks = mock(MagicLinkSessionRepository.class);
        refreshSessions = mock(RefreshSessionRepository.class);
        jwtTokens = mock(JwtTokenService.class);
        IdentityConfig config = mock(IdentityConfig.class);
        when(config.accessTokenTtl()).thenReturn(Duration.ofMinutes(15));
        manager = new SessionManager(restaurateurs, magicLinks, refreshSessions, jwtTokens, config);
    }

    @Test
    void refresh_activeToken_rotatesItAndPersistsTheNextTokenInTheSameFamily() {
        UUID restaurateurId = UUID.randomUUID();
        UUID familyId = UUID.randomUUID();
        Instant refreshExpiresAt = NOW.plus(Duration.ofDays(30));
        RefreshSession current = new RefreshSession(
                UUID.randomUUID(),
                restaurateurId,
                familyId,
                Tokens.sha256(RAW_REFRESH_TOKEN),
                refreshExpiresAt,
                NOW.minusSeconds(60));
        Restaurateur restaurateur = new Restaurateur(
                restaurateurId, "camille@example.com", "Camille Martin", null, NOW.minus(Duration.ofDays(1)));
        when(refreshSessions.findByTokenHashForUpdate(Tokens.sha256(RAW_REFRESH_TOKEN)))
                .thenReturn(Optional.of(current));
        when(restaurateurs.findByIdOptional(restaurateurId)).thenReturn(Optional.of(restaurateur));
        when(jwtTokens.issue(restaurateurId, familyId, NOW)).thenReturn("access-token");

        SessionMaterial material = manager.refresh(RAW_REFRESH_TOKEN, NOW);

        assertEquals(NOW, current.getRotatedAt());
        assertEquals("access-token", material.accessToken());
        assertEquals(NOW.plus(Duration.ofMinutes(15)), material.accessExpiresAt());
        assertEquals(refreshExpiresAt, material.refreshExpiresAt());
        assertNotEquals(RAW_REFRESH_TOKEN, material.refreshToken());
        verify(refreshSessions).flush();

        ArgumentCaptor<RefreshSession> persisted = ArgumentCaptor.forClass(RefreshSession.class);
        verify(refreshSessions).persist(persisted.capture());
        assertEquals(restaurateurId, persisted.getValue().getRestaurateurId());
        assertEquals(familyId, persisted.getValue().getFamilyId());
        assertEquals(refreshExpiresAt, persisted.getValue().getExpiresAt());
        assertEquals(
                Tokens.sha256(material.refreshToken()), persisted.getValue().getTokenHash());
        assertNotEquals(current.getTokenHash(), persisted.getValue().getTokenHash());
    }

    @Test
    void refresh_rotatedToken_revokesItsFamilyAndRejectsTheReplay() {
        UUID familyId = UUID.randomUUID();
        RefreshSession replayed = new RefreshSession(
                UUID.randomUUID(),
                UUID.randomUUID(),
                familyId,
                Tokens.sha256(RAW_REFRESH_TOKEN),
                NOW.plus(Duration.ofDays(30)),
                NOW.minusSeconds(60));
        replayed.rotate(NOW.minusSeconds(1));
        when(refreshSessions.findByTokenHashForUpdate(Tokens.sha256(RAW_REFRESH_TOKEN)))
                .thenReturn(Optional.of(replayed));

        UnauthenticatedException exception =
                assertThrows(UnauthenticatedException.class, () -> manager.refresh(RAW_REFRESH_TOKEN, NOW));

        assertEquals(401, exception.status());
        assertEquals("session-expired", exception.problemType());
        verify(refreshSessions).revokeFamily(familyId, NOW);
        verify(refreshSessions, never()).persist(any(RefreshSession.class));
    }
}
