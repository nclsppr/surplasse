package com.surplasse.order.resource;

import com.surplasse.common.identity.RestaurateurIdentityGateway;
import com.surplasse.order.service.OrderEventStreamer;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Multi;
import jakarta.enterprise.context.RequestScoped;
import jakarta.ws.rs.CookieParam;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import java.util.UUID;

/** Handwritten SSE endpoint, excluded from generated interfaces by x-sse. */
@Path("/v1/establishments/{establishmentId}/order-events")
@RequestScoped
public class EstablishmentOrderEventResource {

    private final OrderEventStreamer orderEventStreamer;

    @CookieParam(RestaurateurIdentityGateway.ACCESS_COOKIE)
    String accessToken;

    @Context
    Sse sse;

    EstablishmentOrderEventResource(OrderEventStreamer orderEventStreamer) {
        this.orderEventStreamer = orderEventStreamer;
    }

    @GET
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @Blocking
    public Multi<OutboundSseEvent> stream(
            @PathParam("establishmentId") UUID establishmentId, @HeaderParam("Last-Event-ID") String lastEventId) {
        return orderEventStreamer.streamEstablishment(establishmentId, accessToken, lastEventId, sse);
    }
}
