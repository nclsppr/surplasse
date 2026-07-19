package com.surplasse.identity.service;

import com.surplasse.common.error.UnauthenticatedException;
import com.surplasse.identity.config.IdentityConfig;
import com.surplasse.identity.entity.MagicLinkSession;
import com.surplasse.identity.entity.RefreshSession;
import com.surplasse.identity.entity.Restaurateur;
import com.surplasse.identity.repository.MagicLinkSessionRepository;
import com.surplasse.identity.repository.RefreshSessionRepository;
import com.surplasse.identity.repository.RestaurateurRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.UUID;

@ApplicationScoped
public class SessionManager {

    private final RestaurateurRepository restaurateurs;
    private final MagicLinkSessionRepository magicLinks;
    private final RefreshSessionRepository refreshSessions;
    private final JwtTokenService jwtTokens;
    private final IdentityConfig config;

    SessionManager(
            RestaurateurRepository restaurateurs,
            MagicLinkSessionRepository magicLinks,
            RefreshSessionRepository refreshSessions,
            JwtTokenService jwtTokens,
            IdentityConfig config) {
        this.restaurateurs = restaurateurs;
        this.magicLinks = magicLinks;
        this.refreshSessions = refreshSessions;
        this.jwtTokens = jwtTokens;
        this.config = config;
    }

    @Transactional
    public SessionMaterial exchange(String rawMagicLinkToken, Instant now) {
        MagicLinkSession magicLink = magicLinks
                .findByTokenHashForUpdate(Tokens.sha256(rawMagicLinkToken))
                .filter(candidate -> candidate.isExchangeableAt(now))
                .orElseThrow(UnauthenticatedException::magicLinkExpired);

        Restaurateur restaurateur = restaurateurs
                .findByIdOptional(magicLink.getRestaurateurId())
                .orElseThrow(UnauthenticatedException::magicLinkExpired);

        magicLink.consume(now);
        restaurateur.recordLogin(now);

        UUID familyId = UUID.randomUUID();
        Instant refreshExpiresAt = now.plus(config.refreshTokenTtl());
        String rawRefreshToken = Tokens.randomOpaqueToken();
        refreshSessions.persist(new RefreshSession(
                UUID.randomUUID(),
                restaurateur.getId(),
                familyId,
                Tokens.sha256(rawRefreshToken),
                refreshExpiresAt,
                now));

        return material(restaurateur, familyId, rawRefreshToken, now, refreshExpiresAt);
    }

    @Transactional(dontRollbackOn = UnauthenticatedException.class)
    public SessionMaterial refresh(String rawRefreshToken, Instant now) {
        RefreshSession current = refreshSessions
                .findByTokenHashForUpdate(Tokens.sha256(rawRefreshToken))
                .orElseThrow(UnauthenticatedException::restaurateurSessionExpired);

        if (current.wasRotated()) {
            refreshSessions.revokeFamily(current.getFamilyId(), now);
            throw UnauthenticatedException.restaurateurSessionExpired();
        }
        if (!current.isActiveAt(now)) {
            throw UnauthenticatedException.restaurateurSessionExpired();
        }

        Restaurateur restaurateur = restaurateurs
                .findByIdOptional(current.getRestaurateurId())
                .orElseThrow(UnauthenticatedException::restaurateurSessionExpired);

        current.rotate(now);
        refreshSessions.flush();
        String nextRawToken = Tokens.randomOpaqueToken();
        refreshSessions.persist(new RefreshSession(
                UUID.randomUUID(),
                current.getRestaurateurId(),
                current.getFamilyId(),
                Tokens.sha256(nextRawToken),
                current.getExpiresAt(),
                now));

        return material(restaurateur, current.getFamilyId(), nextRawToken, now, current.getExpiresAt());
    }

    @Transactional
    public void logout(String rawRefreshToken, Instant now) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank() || rawRefreshToken.length() > 128) {
            return;
        }
        refreshSessions
                .findByTokenHashForUpdate(Tokens.sha256(rawRefreshToken))
                .ifPresent(session -> refreshSessions.revokeFamily(session.getFamilyId(), now));
    }

    private SessionMaterial material(
            Restaurateur restaurateur, UUID familyId, String rawRefreshToken, Instant now, Instant refreshExpiresAt) {
        return new SessionMaterial(
                restaurateur,
                jwtTokens.issue(restaurateur.getId(), familyId, now),
                rawRefreshToken,
                now.plus(config.accessTokenTtl()),
                refreshExpiresAt);
    }
}
