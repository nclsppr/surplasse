package com.surplasse.application;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * End-to-end payment flow with the Stripe doubles: payment session with
 * recomputed amount, signed webhook as single source of truth, idempotent
 * processing, order moved to paid.
 */
@QuarkusTest
class PaymentFlowTest {

    private static final String PROBLEM_JSON = "application/problem+json";

    private record CreatedOrder(String id, String trackingToken, int totalCents, String sessionToken) {}

    private CreatedOrder createOrder() {
        String sessionToken = OrderFlowTest.openSession();
        var extract = given().contentType(ContentType.JSON)
                .header("X-Table-Session", sessionToken)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body(OrderFlowTest.burgerAndPanissesCart())
                .post("/v1/orders")
                .then()
                .statusCode(201)
                .extract();
        return new CreatedOrder(
                extract.path("id"), extract.path("trackingToken"), extract.path("totalCents"), sessionToken);
    }

    private void payViaWebhook(CreatedOrder order) {
        String intent = "pi_fake_" + order.id();
        given().contentType(ContentType.JSON)
                .header("Stripe-Signature", FakeStripeEventVerifier.VALID_SIGNATURE)
                .body("{\"id\":\"evt_%s\",\"type\":\"payment_intent.succeeded\",\"data\":{\"object\":{\"id\":\"%s\"}}}"
                        .formatted(UUID.randomUUID(), intent))
                .post("/v1/webhooks/stripe")
                .then()
                .statusCode(200);
    }

    @Test
    void createPayment_pendingOrder_returnsTheSessionWithTheRecomputedAmount() {
        CreatedOrder order = createOrder();

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .when()
                .post("/v1/payments")
                .then()
                .statusCode(201)
                .body("orderId", equalTo(order.id()))
                .body("amountCents", is(order.totalCents()))
                .body("clientSecret", equalTo("pi_fake_secret_" + order.id()));
    }

    @Test
    void createPayment_replay_returnsTheSameAttempt() {
        CreatedOrder order = createOrder();

        String firstPaymentId = given().contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .post("/v1/payments")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .when()
                .post("/v1/payments")
                .then()
                .statusCode(201)
                .body("id", equalTo(firstPaymentId));
    }

    @Test
    void createPayment_unknownOrder_returns404Problem() {
        CreatedOrder order = createOrder();

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(UUID.randomUUID()))
                .when()
                .post("/v1/payments")
                .then()
                .statusCode(404)
                .contentType(PROBLEM_JSON);
    }

    @Test
    void webhook_succeededIntent_movesTheOrderToPaid() {
        CreatedOrder order = createOrder();
        given().contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .post("/v1/payments")
                .then()
                .statusCode(201);

        payViaWebhook(order);

        given().filter(ContractValidation.FILTER)
                .when()
                .get("/v1/orders/{orderId}?trackingToken={t}", order.id(), order.trackingToken())
                .then()
                .statusCode(200)
                .body("status", equalTo("paid"));
    }

    @Test
    void webhook_replayedEvent_isAcknowledgedWithoutDoubleProcessing() {
        CreatedOrder order = createOrder();
        given().contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .post("/v1/payments")
                .then()
                .statusCode(201);

        String intent = "pi_fake_" + order.id();
        String event =
                "{\"id\":\"evt_replay_%s\",\"type\":\"payment_intent.succeeded\",\"data\":{\"object\":{\"id\":\"%s\"}}}"
                        .formatted(order.id(), intent);
        for (int delivery = 0; delivery < 2; delivery++) {
            given().contentType(ContentType.JSON)
                    .header("Stripe-Signature", FakeStripeEventVerifier.VALID_SIGNATURE)
                    .body(event)
                    .post("/v1/webhooks/stripe")
                    .then()
                    .statusCode(200)
                    .body("received", is(true));
        }

        given().when()
                .get("/v1/orders/{orderId}?trackingToken={t}", order.id(), order.trackingToken())
                .then()
                .statusCode(200)
                .body("status", equalTo("paid"));
    }

    @Test
    void webhook_invalidSignature_returns400Problem() {
        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("Stripe-Signature", "forged")
                .body(
                        "{\"id\":\"evt_forged\",\"type\":\"payment_intent.succeeded\",\"data\":{\"object\":{\"id\":\"pi_x\"}}}")
                .when()
                .post("/v1/webhooks/stripe")
                .then()
                .statusCode(400)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("validation-error"));
    }

    @Test
    void createPayment_paidOrder_returns409Problem() {
        CreatedOrder order = createOrder();
        given().contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .post("/v1/payments")
                .then()
                .statusCode(201);
        payViaWebhook(order);

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .when()
                .post("/v1/payments")
                .then()
                .statusCode(409)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("order-not-modifiable"));
    }
}
