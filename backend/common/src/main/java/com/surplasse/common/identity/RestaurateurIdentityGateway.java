package com.surplasse.common.identity;

import java.util.UUID;

/** Authentication and establishment authorization boundary exposed by the identity domain. */
public interface RestaurateurIdentityGateway {

    String ACCESS_COOKIE = "surplasse_session";

    /** Verifies the access JWT carried by the API cookie and returns its restaurateur identifier. */
    UUID authenticate(String accessToken);

    /** Verifies the access JWT and the restaurateur's ownership of the requested establishment. */
    UUID authorize(String accessToken, UUID establishmentId);
}
