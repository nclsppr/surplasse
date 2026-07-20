package com.surplasse.application;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.MockMailbox;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.locks.LockSupport;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/** End-to-end authenticated and cursor-paginated operational order listing. */
@QuarkusTest
class DashboardOrderFlowTest {

    private static final String ESTABLISHMENT = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    private static final String PILOT_EMAIL = "pilote@le-cormoran.example";
    private static final String ACCESS_COOKIE = "surplasse_session";
    private static final String PROBLEM_JSON = "application/problem+json";
    private static final Pattern MAGIC_LINK_TOKEN = Pattern.compile("[?#&]token=([A-Za-z0-9_-]{43,128})");

    @Inject
    MockMailbox mailbox;

    @Test
    void listOrders_authenticatedPilot_paginatesOperationalOrdersWithoutCustomerCapability() {
        String accessToken = loginPilot();
        String tableSession = OrderFlowTest.openSession();
        CreatedOrder first = createAndPay(tableSession);
        CreatedOrder second = createAndPay(tableSession);
        CreatedOrder third = createAndPay(tableSession);
        CreatedOrder pending = createOrder(tableSession);

        Response firstPage = given().filter(ContractValidation.FILTER)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .queryParam("establishmentId", ESTABLISHMENT)
                .queryParam("limit", 2)
                .when()
                .get("/v1/orders");

        firstPage
                .then()
                .statusCode(200)
                .body("items", hasSize(2))
                .body("items[0].id", equalTo(third.id()))
                .body("items[1].id", equalTo(second.id()))
                .body("items[0].status", equalTo("paid"))
                .body("items[0].tableLabel", equalTo("Table 4"))
                .body("items[0].lines[0].productName", equalTo("Burger du Vieux-Port"))
                .body("hasMore", equalTo(true));

        List<Map<String, Object>> firstPageItems = firstPage.jsonPath().getList("items");
        assertTrue(firstPageItems.stream().noneMatch(item -> item.containsKey("trackingToken")));
        String cursor = firstPage.jsonPath().getString("nextCursor");

        Response secondPage = given().filter(ContractValidation.FILTER)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .queryParam("establishmentId", ESTABLISHMENT)
                .queryParam("limit", 2)
                .queryParam("cursor", cursor)
                .when()
                .get("/v1/orders");

        secondPage.then().statusCode(200).body("items[0].id", equalTo(first.id()));
        List<String> followingIds = secondPage.jsonPath().getList("items.id");
        assertFalse(followingIds.contains(second.id()));
        assertFalse(followingIds.contains(third.id()));

        List<String> allOperationalIds = given().filter(ContractValidation.FILTER)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .queryParam("establishmentId", ESTABLISHMENT)
                .queryParam("limit", 100)
                .when()
                .get("/v1/orders")
                .then()
                .statusCode(200)
                .extract()
                .path("items.id");
        assertTrue(allOperationalIds.containsAll(List.of(first.id(), second.id(), third.id())));
        assertFalse(allOperationalIds.contains(pending.id()));

        given().queryParam("establishmentId", ESTABLISHMENT)
                .when()
                .get("/v1/orders")
                .then()
                .statusCode(401)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("session-expired"));

        given().filter(ContractValidation.FILTER)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .queryParam("establishmentId", UUID.randomUUID().toString())
                .when()
                .get("/v1/orders")
                .then()
                .statusCode(404)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("resource-not-found"));

        given().filter(ContractValidation.FILTER)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .queryParam("establishmentId", ESTABLISHMENT)
                .queryParam("cursor", "not-a-valid-cursor")
                .when()
                .get("/v1/orders")
                .then()
                .statusCode(400)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("validation-error"));
    }

    @Test
    void updateOrderStatus_authenticatedPilot_advancesTheOrderAndRemovesItAfterService() {
        String accessToken = loginPilot();
        CreatedOrder order = createAndPay(OrderFlowTest.openSession());

        updateStatus(null, order.id(), "accepted")
                .then()
                .statusCode(401)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("session-expired"));

        updateStatus(accessToken, UUID.randomUUID().toString(), "accepted")
                .then()
                .statusCode(404)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("resource-not-found"));

        updateStatus(accessToken, order.id(), "ready")
                .then()
                .statusCode(409)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("order-not-modifiable"));

        updateStatus(accessToken, order.id(), "accepted")
                .then()
                .statusCode(200)
                .body("id", equalTo(order.id()))
                .body("status", equalTo("accepted"));
        updateStatus(accessToken, order.id(), "accepted").then().statusCode(200).body("status", equalTo("accepted"));
        updateStatus(accessToken, order.id(), "preparing")
                .then()
                .statusCode(200)
                .body("status", equalTo("preparing"));
        updateStatus(accessToken, order.id(), "ready").then().statusCode(200).body("status", equalTo("ready"));

        updateStatus(accessToken, order.id(), "picked_up")
                .then()
                .statusCode(422)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("business-rule-violation"));

        updateStatus(accessToken, order.id(), "served").then().statusCode(200).body("status", equalTo("served"));

        List<String> operationalIds = given().filter(ContractValidation.FILTER)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .queryParam("establishmentId", ESTABLISHMENT)
                .when()
                .get("/v1/orders")
                .then()
                .statusCode(200)
                .extract()
                .path("items.id");
        assertFalse(operationalIds.contains(order.id()));

        given().filter(ContractValidation.FILTER)
                .queryParam("trackingToken", order.trackingToken())
                .when()
                .get("/v1/orders/{orderId}", order.id())
                .then()
                .statusCode(200)
                .body("status", equalTo("served"));
    }

    @Test
    void refundPaidOrder_authenticatedPilot_returnsMoneyAndRemovesItFromOperations() {
        String accessToken = loginPilot();
        CreatedOrder order = createAndPay(OrderFlowTest.openSession());
        String idempotencyKey = UUID.randomUUID().toString();

        Response first = given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .header("Idempotency-Key", idempotencyKey)
                .body("{\"orderId\":\"%s\",\"reason\":\"restaurant_refusal\"}".formatted(order.id()))
                .when()
                .post("/v1/refunds");

        first.then()
                .statusCode(201)
                .body("orderId", equalTo(order.id()))
                .body("status", equalTo("succeeded"))
                .body("reason", equalTo("restaurant_refusal"));
        String refundId = first.jsonPath().getString("id");

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .header("Idempotency-Key", idempotencyKey)
                .body("{\"orderId\":\"%s\",\"reason\":\"restaurant_refusal\"}".formatted(order.id()))
                .when()
                .post("/v1/refunds")
                .then()
                .statusCode(201)
                .body("id", equalTo(refundId));

        given().filter(ContractValidation.FILTER)
                .queryParam("trackingToken", order.trackingToken())
                .when()
                .get("/v1/orders/{orderId}", order.id())
                .then()
                .statusCode(200)
                .body("status", equalTo("refunded"));

        List<String> operationalIds = given().filter(ContractValidation.FILTER)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .queryParam("establishmentId", ESTABLISHMENT)
                .when()
                .get("/v1/orders")
                .then()
                .statusCode(200)
                .extract()
                .path("items.id");
        assertFalse(operationalIds.contains(order.id()));
    }

    @Test
    void streamEstablishmentOrderEvents_authenticatedPilot_replaysMissedActivity() throws Exception {
        String accessToken = loginPilot();
        CreatedOrder order = createAndPay(OrderFlowTest.openSession());

        SseEvent paid = readOrderEvent(accessToken, null, order.id());
        assertEquals("order-status", paid.name());
        assertEquals("paid", JsonPath.from(paid.data()).getString("status"));

        updateStatus(accessToken, order.id(), "accepted").then().statusCode(200);

        SseEvent accepted = readOrderEvent(accessToken, paid.id(), order.id());
        assertTrue(Long.parseLong(accepted.id()) > Long.parseLong(paid.id()));
        assertEquals("accepted", JsonPath.from(accepted.data()).getString("status"));

        given().when()
                .get("/v1/establishments/{establishmentId}/order-events", ESTABLISHMENT)
                .then()
                .statusCode(401)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("session-expired"));

        given().header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .when()
                .get("/v1/establishments/{establishmentId}/order-events", UUID.randomUUID())
                .then()
                .statusCode(404)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("resource-not-found"));
    }

    private CreatedOrder createAndPay(String tableSession) {
        CreatedOrder order = createOrder(tableSession);
        given().contentType(ContentType.JSON)
                .header("X-Table-Session", tableSession)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"orderId\":\"%s\"}".formatted(order.id()))
                .post("/v1/payments")
                .then()
                .statusCode(201);

        String intent = "pi_fake_" + order.id();
        given().contentType(ContentType.JSON)
                .header("Stripe-Signature", FakeStripeEventVerifier.VALID_SIGNATURE)
                .body(
                        "{\"id\":\"evt_%s\",\"type\":\"payment_intent.succeeded\",\"account\":\"acct_test_le_cormoran\",\"livemode\":false,\"data\":{\"object\":{\"id\":\"%s\"}}}"
                                .formatted(UUID.randomUUID(), intent))
                .post("/v1/webhooks/stripe")
                .then()
                .statusCode(200);
        return order;
    }

    private static CreatedOrder createOrder(String tableSession) {
        Response response = given().contentType(ContentType.JSON)
                .header("X-Table-Session", tableSession)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body(OrderFlowTest.burgerAndPanissesCart())
                .post("/v1/orders")
                .then()
                .statusCode(201)
                .extract()
                .response();
        return new CreatedOrder(response.path("id"), response.path("trackingToken"));
    }

    private static Response updateStatus(String accessToken, String orderId, String status) {
        var request = given().contentType(ContentType.JSON);
        if (accessToken != null) {
            request.filter(ContractValidation.FILTER).header("Cookie", ACCESS_COOKIE + "=" + accessToken);
        }
        return request.body("{\"status\":\"%s\"}".formatted(status))
                .when()
                .patch("/v1/orders/{orderId}/status", orderId);
    }

    private static SseEvent readOrderEvent(String accessToken, String lastEventId, String orderId) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:%d/v1/establishments/%s/order-events"
                        .formatted(RestAssured.port, ESTABLISHMENT)))
                .timeout(Duration.ofSeconds(5))
                .header("Accept", "text/event-stream")
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .GET();
        if (lastEventId != null) {
            request.header("Last-Event-ID", lastEventId);
        }

        HttpResponse<InputStream> response = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .build()
                .send(request.build(), HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() != 200) {
            throw new AssertionError("Expected SSE response 200, got %d: %s"
                    .formatted(
                            response.statusCode(), new String(response.body().readAllBytes(), StandardCharsets.UTF_8)));
        }
        assertTrue(response.headers().firstValue("Content-Type").orElse("").startsWith("text/event-stream"));

        try (BufferedReader reader =
                new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
            for (int eventIndex = 0; eventIndex < 100; eventIndex++) {
                SseEvent event = readSseEvent(reader);
                if (event.data().contains(orderId)) {
                    return event;
                }
            }
        }
        throw new AssertionError("No SSE event matched order " + orderId);
    }

    private static SseEvent readSseEvent(BufferedReader reader) throws Exception {
        String id = null;
        String name = null;
        String data = null;
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.isEmpty() && id != null) {
                return new SseEvent(id, name, data == null ? "" : data);
            }
            if (line.startsWith("id:")) {
                id = line.substring(3).strip();
            } else if (line.startsWith("event:")) {
                name = line.substring(6).strip();
            } else if (line.startsWith("data:")) {
                data = line.substring(5).strip();
            }
        }
        throw new AssertionError("The SSE stream ended before a complete event was received.");
    }

    private String loginPilot() {
        mailbox.clear();
        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .body("{\"email\":\"%s\"}".formatted(PILOT_EMAIL))
                .post("/v1/auth/magic-links")
                .then()
                .statusCode(202);

        Matcher matcher = MAGIC_LINK_TOKEN.matcher(awaitMail().getText());
        assertTrue(matcher.find(), "The email must contain an opaque magic link token.");
        return given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .body("{\"token\":\"%s\"}".formatted(matcher.group(1)))
                .post("/v1/auth/sessions")
                .then()
                .statusCode(200)
                .extract()
                .cookie(ACCESS_COOKIE);
    }

    private Mail awaitMail() {
        long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
        while (System.nanoTime() < deadline) {
            List<Mail> messages = mailbox.getMailsSentTo(PILOT_EMAIL);
            if (!messages.isEmpty()) {
                return messages.getLast();
            }
            LockSupport.parkNanos(Duration.ofMillis(10).toNanos());
        }
        throw new AssertionError("The magic link email was not captured.");
    }

    private record CreatedOrder(String id, String trackingToken) {}

    private record SseEvent(String id, String name, String data) {}
}
