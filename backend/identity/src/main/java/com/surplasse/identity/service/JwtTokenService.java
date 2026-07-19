package com.surplasse.identity.service;

import com.surplasse.common.error.UnauthenticatedException;
import com.surplasse.identity.config.IdentityConfig;
import io.smallrye.jwt.auth.principal.JWTParser;
import io.smallrye.jwt.auth.principal.ParseException;
import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Instant;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@ApplicationScoped
public class JwtTokenService {

    private final JWTParser parser;
    private final IdentityConfig config;

    JwtTokenService(JWTParser parser, IdentityConfig config) {
        this.parser = parser;
        this.config = config;
    }

    String issue(UUID restaurateurId, UUID familyId, Instant now) {
        return Jwt.subject(restaurateurId.toString())
                .issuer(config.jwtIssuer())
                .audience(config.jwtAudience())
                .issuedAt(now.getEpochSecond())
                .expiresAt(now.plus(config.accessTokenTtl()).getEpochSecond())
                .claim("jti", UUID.randomUUID().toString())
                .claim("sid", familyId.toString())
                .sign();
    }

    UUID authenticate(String token) {
        if (token == null || token.isBlank()) {
            throw UnauthenticatedException.restaurateurSessionExpired();
        }
        try {
            JsonWebToken jwt = parser.parse(token);
            UUID.fromString(jwt.getClaim("sid"));
            return UUID.fromString(jwt.getSubject());
        } catch (ParseException | IllegalArgumentException | NullPointerException exception) {
            throw UnauthenticatedException.restaurateurSessionExpired();
        }
    }
}
