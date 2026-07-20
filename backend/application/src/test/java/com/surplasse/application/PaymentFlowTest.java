package com.surplasse.application;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

/**
 * End-to-end payment flow with the Stripe doubles: payment session with
 * recomputed amount, signed webhook as single source of truth, idempotent
 * processing, order moved to paid.
 */
@QuarkusTest
class PaymentFlowTest {

    private static final String PROBLEM_JSON = "application/problem+json";
    private static final String CONNECTED_ACCOUNT = "acct_test_le_cormoran";

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
                .body(
                        "{\"id\":\"evt_%s\",\"type\":\"payment_intent.succeeded\",\"account\":\"%s\",\"livemode\":false,\"data\":{\"object\":{\"id\":\"%s\"}}}"
                                .formatted(UUID.randomUUID(), CONNECTED_ACCOUNT, intent))
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
                .body("clientSecret", equalTo("pi_fake_secret_" + order.id()))
                .body("connectedAccountId", equalTo(CONNECTED_ACCOUNT));
    }

    @Test
    void createPayment_replay_returnsTheSameAttempt() {
        CreatedOrder order = createOrder();
        String idempotencyKey = UUID.randomUUID().toString();

        String firstPaymentId = given().contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", idempotencyKey)
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .post("/v1/payments")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", idempotencyKey)
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .when()
                .post("/v1/payments")
                .then()
                .statusCode(201)
                .body("id", equalTo(firstPaymentId));
    }

    @Test
    void createPayment_newKeyWhilePending_linksToTheSameAttempt() {
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
    void createPayment_concurrentKeys_areSerializedToOneAttempt() throws Exception {
        CreatedOrder order = createOrder();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService requests = Executors.newFixedThreadPool(2);
        try {
            Future<String> first = requests.submit(() -> createPaymentAfterSignal(order, ready, start));
            Future<String> second = requests.submit(() -> createPaymentAfterSignal(order, ready, start));
            ready.await(5, TimeUnit.SECONDS);
            start.countDown();

            assertEquals(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));
        } finally {
            requests.shutdownNow();
        }
    }

    private String createPaymentAfterSignal(CreatedOrder order, CountDownLatch ready, CountDownLatch start)
            throws InterruptedException {
        ready.countDown();
        start.await();
        return given().contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .post("/v1/payments")
                .then()
                .statusCode(201)
                .extract()
                .path("id");
    }

    @Test
    void createPayment_concurrentSameKeyForDifferentOrders_hasOneConflict() throws Exception {
        CreatedOrder firstOrder = createOrder();
        CreatedOrder secondOrder = createOrder();
        String idempotencyKey = UUID.randomUUID().toString();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService requests = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first =
                    requests.submit(() -> createPaymentStatusAfterSignal(firstOrder, idempotencyKey, ready, start));
            Future<Integer> second =
                    requests.submit(() -> createPaymentStatusAfterSignal(secondOrder, idempotencyKey, ready, start));
            ready.await(5, TimeUnit.SECONDS);
            start.countDown();

            assertEquals(
                    List.of(201, 409),
                    List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)).stream()
                            .sorted()
                            .toList());
        } finally {
            requests.shutdownNow();
        }
    }

    private int createPaymentStatusAfterSignal(
            CreatedOrder order, String idempotencyKey, CountDownLatch ready, CountDownLatch start)
            throws InterruptedException {
        ready.countDown();
        start.await();
        return given().contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", idempotencyKey)
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .post("/v1/payments")
                .statusCode();
    }

    @Test
    void createPayment_sameKeyWithAnotherOrder_returns409Problem() {
        CreatedOrder firstOrder = createOrder();
        CreatedOrder secondOrder = createOrder();
        String idempotencyKey = UUID.randomUUID().toString();

        given().contentType(ContentType.JSON)
                .header("X-Table-Session", firstOrder.sessionToken())
                .header("Idempotency-Key", idempotencyKey)
                .body("{\"orderId\":\"%s\"}".formatted(firstOrder.id()))
                .post("/v1/payments")
                .then()
                .statusCode(201);

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", secondOrder.sessionToken())
                .header("Idempotency-Key", idempotencyKey)
                .body("{\"orderId\":\"%s\"}".formatted(secondOrder.id()))
                .when()
                .post("/v1/payments")
                .then()
                .statusCode(409)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("idempotency-key-conflict"));
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
    void createPayment_orderFromAnotherTableSession_returns404Problem() {
        CreatedOrder order = createOrder();
        String otherTableSession = OrderFlowTest.openSession();

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", otherTableSession)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
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
    void webhook_failedAttempt_canStillSucceedOnTheSamePaymentIntent() {
        CreatedOrder order = createOrder();
        given().contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .post("/v1/payments")
                .then()
                .statusCode(201);

        String intent = "pi_fake_" + order.id();
        given().contentType(ContentType.JSON)
                .header("Stripe-Signature", FakeStripeEventVerifier.VALID_SIGNATURE)
                .body(
                        "{\"id\":\"evt_failed_%s\",\"type\":\"payment_intent.payment_failed\",\"account\":\"%s\",\"livemode\":false,\"data\":{\"object\":{\"id\":\"%s\"}}}"
                                .formatted(order.id(), CONNECTED_ACCOUNT, intent))
                .post("/v1/webhooks/stripe")
                .then()
                .statusCode(200);

        given().when()
                .get("/v1/orders/{orderId}?trackingToken={t}", order.id(), order.trackingToken())
                .then()
                .statusCode(200)
                .body("status", equalTo("pending_payment"));

        payViaWebhook(order);

        given().when()
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
                "{\"id\":\"evt_replay_%s\",\"type\":\"payment_intent.succeeded\",\"account\":\"%s\",\"livemode\":false,\"data\":{\"object\":{\"id\":\"%s\"}}}"
                        .formatted(order.id(), CONNECTED_ACCOUNT, intent);
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
    void webhook_sameIntentFromAnotherConnectedAccount_hasNoPaymentEffect() {
        CreatedOrder order = createOrder();
        given().contentType(ContentType.JSON)
                .header("X-Table-Session", order.sessionToken())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .post("/v1/payments")
                .then()
                .statusCode(201);

        String intent = "pi_fake_" + order.id();
        given().contentType(ContentType.JSON)
                .header("Stripe-Signature", FakeStripeEventVerifier.VALID_SIGNATURE)
                .body(
                        "{\"id\":\"evt_wrong_%s\",\"type\":\"payment_intent.succeeded\",\"account\":\"acct_test_other\",\"livemode\":false,\"data\":{\"object\":{\"id\":\"%s\"}}}"
                                .formatted(order.id(), intent))
                .post("/v1/webhooks/stripe")
                .then()
                .statusCode(200);

        given().when()
                .get("/v1/orders/{orderId}?trackingToken={t}", order.id(), order.trackingToken())
                .then()
                .statusCode(200)
                .body("status", equalTo("pending_payment"));

        payViaWebhook(order);

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
                        "{\"id\":\"evt_forged\",\"type\":\"payment_intent.succeeded\",\"account\":\"acct_test_le_cormoran\",\"livemode\":false,\"data\":{\"object\":{\"id\":\"pi_x\"}}}")
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
