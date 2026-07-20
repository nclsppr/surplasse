package com.surplasse.contract.api;

import com.surplasse.contract.model.PaymentCreationRequest;
import com.surplasse.contract.model.PaymentSession;
import com.surplasse.contract.model.Problem;
import com.surplasse.contract.model.Refund;
import com.surplasse.contract.model.RefundCreationRequest;
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
@Path("/v1")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public interface PaymentApi {

    /**
     * Creates (or returns, when replayed) the Stripe payment session of a `pending_payment` order: the backend re-checks product availability, recomputes the amount from the catalog, creates a direct-charge PaymentIntent on the establishment's connected account and returns its client secret and account identifier for the Payment Element. The browser confirmation is informative only: the signed Stripe webhook is the single source of truth that marks the order paid. An operational pause rejects new and replayed payment-session requests but never prevents a signed webhook from reconciling a Payment Intent already in flight.
     *
     * @param idempotencyKey Client-generated UUID identifying this intention. Replaying the same request with the same key returns the original response without any duplicate; the same key with a different payload yields a 409 &#x60;idempotency-key-conflict&#x60;.
     * @param paymentCreationRequest
     * @return The payment session, ready for the Payment Element.
     * @return The table session token is missing, unknown or expired.
     * @return Unknown order, or order outside this session.
     * @return Ordering was paused, the order is not payable anymore, or a product became unavailable.
     * @return The establishment has no active Stripe Connect account able to accept charges.
     * @return Stripe is unreachable after retries.
     */
    @POST
    @Path("/payments")
    @Consumes({ "application/json" })
    @Produces({ "application/json", "application/problem+json" })
    Response createPayment(@HeaderParam("Idempotency-Key") @NotNull   UUID idempotencyKey,@Valid @NotNull PaymentCreationRequest paymentCreationRequest);


    /**
     * Creates or replays the full Stripe refund of one order on behalf of authenticated establishment staff. The direct charge is refunded on the connected account frozen on the payment. When Surplasse collected an application fee, the same operation returns it to the restaurant. Partial refunds are outside the MVP.  The request is idempotent. Replaying a key returns the exact refund it previously received, while a new key reuses any refund still in progress or already succeeded. A failed or canceled attempt can be retried with a new key. The order moves to `refunded` only after Stripe reports a successful refund, synchronously or through a signed webhook.
     *
     * @param idempotencyKey Client-generated UUID identifying this intention. Replaying the same request with the same key returns the original response without any duplicate; the same key with a different payload yields a 409 &#x60;idempotency-key-conflict&#x60;.
     * @param refundCreationRequest
     * @return The full refund attempt, newly created or safely replayed.
     * @return The restaurateur session is missing or expired.
     * @return Unknown order, order outside the caller's establishment, or no settled payment.
     * @return The key conflicts, the order cannot be refunded, or a successful refund already exists.
     * @return Stripe rejects the refund for a business reason.
     * @return Stripe is unreachable after retries.
     */
    @POST
    @Path("/refunds")
    @Consumes({ "application/json" })
    @Produces({ "application/json", "application/problem+json" })
    Response createRefund(@HeaderParam("Idempotency-Key") @NotNull   UUID idempotencyKey,@Valid @NotNull RefundCreationRequest refundCreationRequest);

}
