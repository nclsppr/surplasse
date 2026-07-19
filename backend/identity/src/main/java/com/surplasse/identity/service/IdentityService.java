package com.surplasse.identity.service;

import com.surplasse.common.catalog.EstablishmentAccessGateway;
import com.surplasse.common.error.UnauthenticatedException;
import com.surplasse.contract.model.RestaurateurEstablishment;
import com.surplasse.contract.model.RestaurateurSession;
import com.surplasse.identity.entity.Restaurateur;
import com.surplasse.identity.repository.RestaurateurRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/** Coordinates the passwordless identity use cases exposed by the HTTP resource. */
@ApplicationScoped
public class IdentityService {

    private final MagicLinkRateLimiter rateLimiter;
    private final MagicLinkIssuer magicLinks;
    private final MagicLinkDispatcher dispatcher;
    private final SessionManager sessions;
    private final JwtTokenService jwtTokens;
    private final RestaurateurRepository restaurateurs;
    private final EstablishmentAccessGateway establishmentAccess;
    private final Clock clock;

    IdentityService(
            MagicLinkRateLimiter rateLimiter,
            MagicLinkIssuer magicLinks,
            MagicLinkDispatcher dispatcher,
            SessionManager sessions,
            JwtTokenService jwtTokens,
            RestaurateurRepository restaurateurs,
            EstablishmentAccessGateway establishmentAccess,
            Clock clock) {
        this.rateLimiter = rateLimiter;
        this.magicLinks = magicLinks;
        this.dispatcher = dispatcher;
        this.sessions = sessions;
        this.jwtTokens = jwtTokens;
        this.restaurateurs = restaurateurs;
        this.establishmentAccess = establishmentAccess;
        this.clock = clock;
    }

    public void requestMagicLink(String email, String sourceIp) {
        String normalizedEmail = EmailAddresses.normalize(email);
        Instant now = clock.instant();
        rateLimiter.check(normalizedEmail, sourceIp, now);
        dispatcher.dispatch(magicLinks.issue(normalizedEmail, now));
    }

    public CreatedSession exchangeMagicLink(String token) {
        return createdSession(sessions.exchange(token, clock.instant()));
    }

    public CreatedSession refresh(String refreshToken) {
        return createdSession(sessions.refresh(validRefreshToken(refreshToken), clock.instant()));
    }

    public RestaurateurSession current(String accessToken) {
        UUID restaurateurId = jwtTokens.authenticate(accessToken);
        Restaurateur restaurateur = restaurateurs
                .findByIdOptional(restaurateurId)
                .orElseThrow(UnauthenticatedException::restaurateurSessionExpired);
        return view(restaurateur);
    }

    public void logout(String refreshToken) {
        sessions.logout(refreshToken, clock.instant());
    }

    private CreatedSession createdSession(SessionMaterial material) {
        return new CreatedSession(
                view(material.restaurateur()),
                material.accessToken(),
                material.refreshToken(),
                material.accessExpiresAt(),
                material.refreshExpiresAt());
    }

    private RestaurateurSession view(Restaurateur restaurateur) {
        return new RestaurateurSession(
                restaurateur.getId(),
                restaurateur.getEmail(),
                restaurateur.getFullName(),
                establishmentAccess.listAccessibleEstablishments(restaurateur.getId()).stream()
                        .map(establishment -> new RestaurateurEstablishment(
                                establishment.id(), establishment.name(), establishment.slug()))
                        .toList());
    }

    private static String validRefreshToken(String token) {
        if (token == null || token.length() < 43 || token.length() > 128 || !token.matches("^[A-Za-z0-9_-]+$")) {
            throw UnauthenticatedException.restaurateurSessionExpired();
        }
        return token;
    }

    public record CreatedSession(
            RestaurateurSession view,
            String accessToken,
            String refreshToken,
            Instant accessExpiresAt,
            Instant refreshExpiresAt) {}
}
