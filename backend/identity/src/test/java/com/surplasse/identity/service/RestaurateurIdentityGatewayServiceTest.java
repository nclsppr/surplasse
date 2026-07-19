package com.surplasse.identity.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.surplasse.common.catalog.EstablishmentAccessGateway;
import com.surplasse.common.error.AccessDeniedException;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RestaurateurIdentityGatewayServiceTest {

    private JwtTokenService jwtTokens;
    private EstablishmentAccessGateway establishmentAccess;
    private RestaurateurIdentityGatewayService gateway;

    @BeforeEach
    void setUp() {
        jwtTokens = mock(JwtTokenService.class);
        establishmentAccess = mock(EstablishmentAccessGateway.class);
        gateway = new RestaurateurIdentityGatewayService(jwtTokens, establishmentAccess);
    }

    @Test
    void authorize_accessibleEstablishment_returnsAuthenticatedRestaurateur() {
        UUID restaurateurId = UUID.randomUUID();
        UUID establishmentId = UUID.randomUUID();
        when(jwtTokens.authenticate("access-token")).thenReturn(restaurateurId);
        when(establishmentAccess.canAccess(restaurateurId, establishmentId)).thenReturn(true);

        assertEquals(restaurateurId, gateway.authorize("access-token", establishmentId));
        verify(establishmentAccess).canAccess(restaurateurId, establishmentId);
    }

    @Test
    void authorize_inaccessibleEstablishment_masksTheMissingPermissionAsNotFound() {
        UUID restaurateurId = UUID.randomUUID();
        UUID establishmentId = UUID.randomUUID();
        when(jwtTokens.authenticate("access-token")).thenReturn(restaurateurId);

        AccessDeniedException exception =
                assertThrows(AccessDeniedException.class, () -> gateway.authorize("access-token", establishmentId));

        assertEquals(404, exception.status());
        assertEquals("resource-not-found", exception.problemType());
        verify(establishmentAccess).canAccess(restaurateurId, establishmentId);
    }
}
