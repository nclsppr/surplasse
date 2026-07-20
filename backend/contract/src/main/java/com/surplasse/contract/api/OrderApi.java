package com.surplasse.contract.api;

import com.surplasse.contract.model.Order;
import com.surplasse.contract.model.OrderCreationRequest;
import com.surplasse.contract.model.OrderPage;
import com.surplasse.contract.model.OrderStatusResult;
import com.surplasse.contract.model.OrderStatusUpdate;
import com.surplasse.contract.model.Problem;
import com.surplasse.contract.model.TableSession;
import com.surplasse.contract.model.TableSessionRequest;
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
public interface OrderApi {

    /**
     * Creates an order at status `pending_payment` from the cart validated by the customer. The cart itself never exists server side. The establishment and the table come exclusively from the anonymous table session (a customer can only order for the table whose QR was actually scanned). The server recomputes every amount from the catalog; amounts are never accepted from the client. The `Idempotency-Key` header guarantees that an unstable connection can never create the same order twice. Only `on_site` orders are accepted at this stage; `takeaway` is documented for the target and rejected with a business rule error until it opens. An order-intake pause rejects every new intention with `order-intake-paused`, while an exact replay still returns the order created before the pause. 
     *
     * @param idempotencyKey Client-generated UUID identifying this intention. Replaying the same request with the same key returns the original response without any duplicate; the same key with a different payload yields a 409 &#x60;idempotency-key-conflict&#x60;. 
     * @param orderCreationRequest 
     * @return The order was created, waiting for payment.
     * @return The payload is syntactically invalid.
     * @return The table session token is missing, unknown or expired.
     * @return A product or option of the cart does not belong to the published menu.
     * @return Ordering was paused, a product became unavailable, or the idempotency key was reused with a different payload.
     * @return A business rule rejected the cart (invalid option choices, takeaway not open).
     */
    @POST
    @Path("/orders")
    @Consumes({ "application/json" })
    @Produces({ "application/json", "application/problem+json" })
    Response createOrder(@HeaderParam("Idempotency-Key") @NotNull   UUID idempotencyKey,@Valid @NotNull OrderCreationRequest orderCreationRequest);


    /**
     * Exchanges the table code carried by a scanned QR (`{slug}.surplasse.com/?table={code}`) for an opaque anonymous session token, bound to the establishment and to that table. The token authorizes the ordering endpoints (`X-Table-Session` header) for the duration of a meal (2 hours, sliding while active). It carries no personal data. An unknown slug, an unknown or inactive table code, an establishment that is not active or an operational order-intake pause all yield a 404 without distinction. 
     *
     * @param tableSessionRequest 
     * @return The anonymous session, bound to the establishment and the table.
     * @return The payload is syntactically invalid.
     * @return Unknown establishment or table code, or ordering closed.
     */
    @POST
    @Path("/table-sessions")
    @Consumes({ "application/json" })
    @Produces({ "application/json", "application/problem+json" })
    Response createTableSession(@Valid @NotNull TableSessionRequest tableSessionRequest);


    /**
     * Returns an order for the customer tracking page. Access is authorized by the order tracking token (a non-guessable capability returned at creation, carried by the tracking page URL): the customer can close the browser and come back. A wrong token yields a 404 without distinction. 
     *
     * @param orderId Identifier of the order.
     * @param trackingToken Non-guessable tracking capability of the order, returned at creation. Carried by the tracking page URL so the customer can close the browser and come back. 
     * @return The order, with its current status.
     * @return The tracking token is missing or malformed.
     * @return Unknown order, or tracking token mismatch.
     */
    @GET
    @Path("/orders/{orderId}")
    @Produces({ "application/json", "application/problem+json" })
    Response getOrder(@PathParam("orderId") UUID orderId,@QueryParam("trackingToken") @NotNull @Pattern(regexp="^ot_[a-f0-9]{32}$")   String trackingToken);


    /**
     * Cursor-paginated list of the operational orders of one establishment for the Dashboard, sorted by creation timestamp and identifier, both descending. Only `paid`, `accepted`, `preparing` and `ready` orders are returned. Pending payment and terminal orders are deliberately excluded from this phase.  The opaque cursor stays stable while new orders arrive and is never interpreted by the client. The restaurateur session cookie and establishment membership are both required: an unknown establishment and an establishment outside the caller's scope yield the same 404. 
     *
     * @param establishmentId Establishment whose orders are listed.
     * @param cursor Opaque cursor returned by the previous page.
     * @param limit Page size, between 1 and 100.
     * @return One page of orders, newest first.
     * @return The establishment identifier, limit or cursor is invalid.
     * @return The restaurateur session is missing or expired.
     * @return Unknown establishment, or establishment outside the caller's scope.
     */
    @GET
    @Path("/orders")
    @Produces({ "application/json", "application/problem+json" })
    Response listOrders(@QueryParam("establishmentId") @NotNull   UUID establishmentId,@QueryParam("cursor") @Size(min=1,max=512)   String cursor,@QueryParam("limit") @Min(1) @Max(100) @DefaultValue("50")   Integer limit);


    /**
     * Advances one order on behalf of an authenticated restaurateur. The target must be the next state allowed by the order state machine: `paid` to `accepted`, `accepted` to `preparing`, `preparing` to `ready`, then `ready` to `served` for an on-site order or `picked_up` for a takeaway order. Repeating the state already reached is idempotent and returns the current result without emitting another event. Refunds are deliberately excluded: they require a payment operation and cannot be represented by a status-only update.  The restaurateur session cookie is required. Unknown orders and orders outside the caller's establishment scope yield the same 404. 
     *
     * @param orderId Identifier of the order.
     * @param orderStatusUpdate 
     * @return The order status after the idempotent update.
     * @return The order identifier or payload is syntactically invalid.
     * @return The restaurateur session is missing or expired.
     * @return Unknown order, or order outside the caller's establishment scope.
     * @return The requested transition is not allowed from the current order status.
     * @return The terminal status is incompatible with the order type.
     */
    @PATCH
    @Path("/orders/{orderId}/status")
    @Consumes({ "application/json" })
    @Produces({ "application/json", "application/problem+json" })
    Response updateOrderStatus(@PathParam("orderId") UUID orderId,@Valid @NotNull OrderStatusUpdate orderStatusUpdate);

}
