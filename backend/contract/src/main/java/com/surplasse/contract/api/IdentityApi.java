package com.surplasse.contract.api;

import com.surplasse.contract.model.MagicLinkExchange;
import com.surplasse.contract.model.MagicLinkRequest;
import com.surplasse.contract.model.Problem;
import com.surplasse.contract.model.RestaurateurSession;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;


import java.io.InputStream;
import java.util.Map;
import java.util.List;
import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

/**
* Represents a collection of functions to interact with the API endpoints.
*/
@Path("/v1/auth")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public interface IdentityApi {

    /**
     * Atomically consumes a magic link token posted by the intermediate landing page, never by a bare GET. A successful exchange returns the current restaurateur view and sets two host-only HttpOnly cookies: a 15-minute JWT and a rotating opaque refresh token valid for 30 days. Production cookies are Secure and every environment uses SameSite=Lax. 
     *
     * @param magicLinkExchange 
     * @return The session is created and both cookies are set.
     * @return The token payload is syntactically invalid.
     * @return The magic link is unknown, expired or already consumed.
     */
    @POST
    @Path("/sessions")
    @Consumes({ "application/json" })
    @Produces({ "application/json", "application/problem+json" })
    Response createRestaurateurSession(@Valid @NotNull MagicLinkExchange magicLinkExchange);


    /**
     * Revokes the refresh-token family when the refresh cookie is valid, then expires both cookies. The operation stays idempotent and returns 204 when cookies are absent, invalid or already revoked. 
     *
     * @return The session is revoked when identifiable and both cookies are expired.
     */
    @DELETE
    @Path("/sessions/current")
    Response deleteCurrentRestaurateurSession();


    /**
     * Returns the authenticated restaurateur and the establishments they can access. The Dashboard uses this read model to discover establishment identifiers instead of embedding one in its configuration. 
     *
     * @return The current restaurateur and accessible establishments.
     * @return The access cookie is missing, expired or invalid.
     */
    @GET
    @Path("/sessions/current")
    @Produces({ "application/json", "application/problem+json" })
    Response getCurrentRestaurateurSession();


    /**
     * Exchanges the host-only refresh cookie for a new access JWT and a new opaque refresh token. Rotation is atomic. Reuse of a token that has already been rotated revokes its complete token family. 
     *
     * @return The refresh token is rotated and both cookies are replaced.
     * @return The refresh cookie is missing, expired, revoked or reused.
     */
    @POST
    @Path("/sessions/refresh")
    @Produces({ "application/json", "application/problem+json" })
    Response refreshRestaurateurSession();


    /**
     * Requests a single-use login link valid for 15 minutes. The response is deliberately identical whether the normalized email exists or not, so this endpoint cannot enumerate restaurateur accounts. A new request invalidates every unused link previously issued for that account.  Requests are rate limited independently by target email and source IP. Email delivery happens after the request transaction and its failure is never exposed through this response. 
     *
     * @param magicLinkRequest 
     * @return Accepted; an email is queued only when the account exists.
     * @return The email payload is syntactically invalid.
     * @return Too many requests for this email or source IP.
     */
    @POST
    @Path("/magic-links")
    @Consumes({ "application/json" })
    @Produces({ "application/problem+json" })
    Response requestMagicLink(@Valid @NotNull MagicLinkRequest magicLinkRequest);

}
