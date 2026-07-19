package com.surplasse.application;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.MockMailbox;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import jakarta.inject.Inject;
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
                .body("{\"id\":\"evt_%s\",\"type\":\"payment_intent.succeeded\",\"data\":{\"object\":{\"id\":\"%s\"}}}"
                        .formatted(UUID.randomUUID(), intent))
                .post("/v1/webhooks/stripe")
                .then()
                .statusCode(200);
        return order;
    }

    private static CreatedOrder createOrder(String tableSession) {
        String id = given().contentType(ContentType.JSON)
                .header("X-Table-Session", tableSession)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body(OrderFlowTest.burgerAndPanissesCart())
                .post("/v1/orders")
                .then()
                .statusCode(201)
                .extract()
                .path("id");
        return new CreatedOrder(id);
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

    private record CreatedOrder(String id) {}
}
