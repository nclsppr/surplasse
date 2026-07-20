package com.surplasse.payment.resource;

import com.surplasse.payment.provider.StripeEventVerifier;
import com.surplasse.payment.service.WebhookService;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/**
 * Stripe webhook endpoints. Written by hand: the endpoints are contractual
 * (x-raw-body in api/openapi.yaml) but excluded from generation, signature
 * verification needs the raw request body that a generated deserializing
 * interface cannot provide.
 */
@Path("/v1/webhooks/stripe")
public class StripeWebhookResource {

    private final WebhookService webhookService;

    StripeWebhookResource(WebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public WebhookAckPayload receive(@HeaderParam("Stripe-Signature") String signature, String rawBody) {
        webhookService.process(rawBody, signature, StripeEventVerifier.Destination.PAYMENT_SNAPSHOT);
        return new WebhookAckPayload(true);
    }

    @POST
    @Path("/accounts")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public WebhookAckPayload receiveAccountEvent(@HeaderParam("Stripe-Signature") String signature, String rawBody) {
        webhookService.process(rawBody, signature, StripeEventVerifier.Destination.ACCOUNT_THIN);
        return new WebhookAckPayload(true);
    }

    /** Shape of the WebhookAck schema of the contract; local because x-raw-body blocks are not generated. */
    public record WebhookAckPayload(boolean received) {}
}
