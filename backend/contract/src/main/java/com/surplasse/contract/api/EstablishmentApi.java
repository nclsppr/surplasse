package com.surplasse.contract.api;

import com.surplasse.contract.model.OrderIntakeState;
import com.surplasse.contract.model.OrderIntakeUpdate;
import com.surplasse.contract.model.Problem;
import java.util.UUID;

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
@Path("/v1/establishments/{establishmentId}/order-intake")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public interface EstablishmentApi {

    /**
     * Returns whether the authenticated restaurateur currently accepts new table sessions, orders and payment sessions for this establishment. This operational switch does not hide the public menu and never cuts access to existing orders, their tracking pages or their event streams.  The restaurateur session cookie is required. Unknown establishments and establishments outside the caller's scope yield the same 404. 
     *
     * @param establishmentId Identifier of an establishment.
     * @return The current operational order-intake state.
     * @return The establishment identifier is syntactically invalid.
     * @return The restaurateur session is missing or expired.
     * @return Unknown establishment, or establishment outside the caller's scope.
     */
    @GET
    @Produces({ "application/json", "application/problem+json" })
    Response getOrderIntake(@PathParam("establishmentId") UUID establishmentId);


    /**
     * Idempotently opens or pauses new table sessions, orders and payment sessions for one establishment. Pausing is always allowed. Opening is allowed only while the establishment is active, has a published menu, exposes at least one active table and can create Stripe charges.  Operations already in flight are not cancelled. In particular, a Payment Intent whose client secret was already returned can still succeed and must then be served or refunded. Existing orders, their tracking pages and their event streams remain available in both states.  The restaurateur session cookie is required. Unknown establishments and establishments outside the caller's scope yield the same 404. 
     *
     * @param establishmentId Identifier of an establishment.
     * @param orderIntakeUpdate 
     * @return The state after the idempotent update.
     * @return The identifier or payload is syntactically invalid.
     * @return The restaurateur session is missing or expired.
     * @return Unknown establishment, or establishment outside the caller's scope.
     * @return The establishment is not ready to open order intake.
     */
    @PUT
    @Consumes({ "application/json" })
    @Produces({ "application/json", "application/problem+json" })
    Response updateOrderIntake(@PathParam("establishmentId") UUID establishmentId,@Valid @NotNull OrderIntakeUpdate orderIntakeUpdate);

}
