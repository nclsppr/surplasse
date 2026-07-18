package com.surplasse.contract.api;

import com.surplasse.contract.model.PaymentCreationRequest;
import com.surplasse.contract.model.PaymentSession;
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
@Path("/v1/payments")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public interface PaymentApi {

    /**
     * Creates (or returns, when replayed) the Stripe payment session of a `pending_payment` order: the backend re-checks product availability, recomputes the amount from the catalog, creates the PaymentIntent and returns its client secret for the Payment Element. The browser confirmation is informative only: the signed Stripe webhook is the single source of truth that marks the order paid. 
     *
     * @param idempotencyKey Client-generated UUID identifying this intention. Replaying the same request with the same key returns the original response without any duplicate; the same key with a different payload yields a 409 &#x60;idempotency-key-conflict&#x60;. 
     * @param paymentCreationRequest 
     * @return The payment session, ready for the Payment Element.
     * @return The table session token is missing, unknown or expired.
     * @return Unknown order, or order outside this session.
     * @return The order is not payable anymore, or a product became unavailable.
     * @return Stripe is unreachable after retries.
     */
    @POST
    @Consumes({ "application/json" })
    @Produces({ "application/json", "application/problem+json" })
    PaymentSession createPayment(@HeaderParam("Idempotency-Key") @NotNull   UUID idempotencyKey,@Valid @NotNull PaymentCreationRequest paymentCreationRequest);

}
