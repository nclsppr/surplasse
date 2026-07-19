package com.surplasse.identity.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import org.junit.jupiter.api.Test;

class MagicLinkIssuerTest {

    @Test
    void loginUrl_token_staysOutOfTheHttpRequestTarget() {
        URI result = MagicLinkIssuer.loginUrl(
                URI.create("https://dashboard.surplasse.com/auth/magic-link?source=email"), "opaque_token");

        assertEquals("https", result.getScheme());
        assertEquals("dashboard.surplasse.com", result.getHost());
        assertEquals("/auth/magic-link", result.getPath());
        assertEquals("source=email", result.getQuery());
        assertEquals("token=opaque_token", result.getFragment());
        assertFalse(result.getRawQuery().contains("opaque_token"));
    }

    @Test
    void loginUrl_landingUrlHasFragment_rejectsAmbiguousConfiguration() {
        URI landingUrl = URI.create("https://dashboard.surplasse.com/auth/magic-link#unexpected");

        assertThrows(IllegalArgumentException.class, () -> MagicLinkIssuer.loginUrl(landingUrl, "opaque_token"));
    }

    @Test
    void loginUrl_landingUrlHasEncodedQuery_preservesItsRawMeaning() {
        URI landingUrl = URI.create(
                "https://dashboard.surplasse.com/auth/magic-link?return=%2Fservice%3Fa%3Db%26view%3Dcompact");

        URI result = MagicLinkIssuer.loginUrl(landingUrl, "opaque_token");

        assertEquals(
                "https://dashboard.surplasse.com/auth/magic-link?return=%2Fservice%3Fa%3Db%26view%3Dcompact#token=opaque_token",
                result.toASCIIString());
    }
}
