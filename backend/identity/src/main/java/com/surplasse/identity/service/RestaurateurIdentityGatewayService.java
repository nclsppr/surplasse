package com.surplasse.identity.service;

import com.surplasse.common.catalog.EstablishmentAccessGateway;
import com.surplasse.common.error.AccessDeniedException;
import com.surplasse.common.identity.RestaurateurIdentityGateway;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.UUID;

/** Identity-owned authentication boundary used by the other domain modules. */
@ApplicationScoped
public class RestaurateurIdentityGatewayService implements RestaurateurIdentityGateway {

    private final JwtTokenService jwtTokens;
    private final EstablishmentAccessGateway establishmentAccess;

    RestaurateurIdentityGatewayService(JwtTokenService jwtTokens, EstablishmentAccessGateway establishmentAccess) {
        this.jwtTokens = jwtTokens;
        this.establishmentAccess = establishmentAccess;
    }

    @Override
    public UUID authenticate(String accessToken) {
        return jwtTokens.authenticate(accessToken);
    }

    @Override
    public UUID authorize(String accessToken, UUID establishmentId) {
        UUID restaurateurId = authenticate(accessToken);
        if (!establishmentAccess.canAccess(restaurateurId, establishmentId)) {
            throw new AccessDeniedException("The establishment does not exist or is not accessible.");
        }
        return restaurateurId;
    }
}
