package com.surplasse.application;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * End-to-end order flow against the demo seed: table session, cart
 * validation with server-side pricing, idempotency, tracking capability.
 * Every response is validated against the contract.
 */
@QuarkusTest
class OrderFlowTest {

    private static final String PROBLEM_JSON = "application/problem+json";
    private static final String TABLE_4_CODE = "tbl_2f8e6a4c0b9d7e1f";
    private static final String BURGER = "d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d405";
    private static final String PANISSES = "d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d401";
    private static final String SOUP = "d0e1f2a3-b4c5-46d7-88e9-f0a1b2c3d402";
    private static final String RARE = "f0a1b2c3-d4e5-46f7-88a9-b0c1d2e3f404";
    private static final String GOAT_CHEESE = "f0a1b2c3-d4e5-46f7-88a9-b0c1d2e3f407";

    static String openSession() {
        return given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .body("{\"establishmentSlug\":\"le-cormoran\",\"tableCode\":\"%s\"}".formatted(TABLE_4_CODE))
                .when()
                .post("/v1/table-sessions")
                .then()
                .statusCode(201)
                .body("tableLabel", equalTo("Table 4"))
                .extract()
                .path("token");
    }

    static String burgerAndPanissesCart() {
        return """
                {"type":"on_site","lines":[
                  {"productId":"%s","quantity":2,"optionIds":["%s","%s"],"note":"Sauce à part."},
                  {"productId":"%s","quantity":1}
                ]}""".formatted(BURGER, RARE, GOAT_CHEESE, PANISSES);
    }

    @Test
    void createTableSession_unknownCode_returns404Problem() {
        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .body("{\"establishmentSlug\":\"le-cormoran\",\"tableCode\":\"tbl_ffffffffffffffff\"}")
                .when()
                .post("/v1/table-sessions")
                .then()
                .statusCode(404)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("resource-not-found"));
    }

    @Test
    void createTableSession_inactiveTable_returns404Problem() {
        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .body("{\"establishmentSlug\":\"le-cormoran\",\"tableCode\":\"tbl_0d4f2b6e8a3c5d7f\"}")
                .when()
                .post("/v1/table-sessions")
                .then()
                .statusCode(404);
    }

    @Test
    void createOrder_demoCart_recomputesEveryAmountServerSide() {
        String token = openSession();

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", token)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body(burgerAndPanissesCart())
                .when()
                .post("/v1/orders")
                .then()
                .statusCode(201)
                .body("status", equalTo("pending_payment"))
                .body("type", equalTo("on_site"))
                .body("tableLabel", equalTo("Table 4"))
                .body("totalCents", is((1600 + 150) * 2 + 650))
                .body("lines[0].lineTotalCents", is(3500))
                .body("lines[0].options.size()", is(2))
                .body("lines[0].note", equalTo("Sauce à part."))
                .body("lines[1].productName", equalTo("Panisses croustillantes"))
                .body("displayNumber", notNullValue())
                .body("trackingToken", matchesPattern("^ot_[a-f0-9]{32}$"));
    }

    @Test
    void createOrder_replaySameIdempotencyKey_returnsTheSameOrder() {
        String token = openSession();
        String key = UUID.randomUUID().toString();

        String firstId = given().contentType(ContentType.JSON)
                .header("X-Table-Session", token)
                .header("Idempotency-Key", key)
                .body(burgerAndPanissesCart())
                .post("/v1/orders")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", token)
                .header("Idempotency-Key", key)
                .body(burgerAndPanissesCart())
                .when()
                .post("/v1/orders")
                .then()
                .statusCode(201)
                .body("id", equalTo(firstId));
    }

    @Test
    void createOrder_sameKeyDifferentPayload_returns409Problem() {
        String token = openSession();
        String key = UUID.randomUUID().toString();

        given().contentType(ContentType.JSON)
                .header("X-Table-Session", token)
                .header("Idempotency-Key", key)
                .body(burgerAndPanissesCart())
                .post("/v1/orders")
                .then()
                .statusCode(201);

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", token)
                .header("Idempotency-Key", key)
                .body("{\"type\":\"on_site\",\"lines\":[{\"productId\":\"%s\",\"quantity\":1}]}".formatted(PANISSES))
                .when()
                .post("/v1/orders")
                .then()
                .statusCode(409)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("idempotency-key-conflict"));
    }

    @Test
    void createOrder_withoutSession_returns401Problem() {
        // No contract filter: the request violates the security requirement on purpose.
        given().contentType(ContentType.JSON)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"type\":\"on_site\",\"lines\":[{\"productId\":\"%s\",\"quantity\":1}]}".formatted(PANISSES))
                .when()
                .post("/v1/orders")
                .then()
                .statusCode(401)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("table-session-expired"));
    }

    @Test
    void createOrder_unavailableProduct_returns409Problem() {
        String token = openSession();

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", token)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"type\":\"on_site\",\"lines\":[{\"productId\":\"%s\",\"quantity\":1}]}".formatted(SOUP))
                .when()
                .post("/v1/orders")
                .then()
                .statusCode(409)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("product-unavailable"));
    }

    @Test
    void createOrder_burgerWithoutDoneness_returns422Problem() {
        String token = openSession();

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", token)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body("{\"type\":\"on_site\",\"lines\":[{\"productId\":\"%s\",\"quantity\":1}]}".formatted(BURGER))
                .when()
                .post("/v1/orders")
                .then()
                .statusCode(422)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("business-rule-violation"));
    }

    @Test
    void getOrder_rightTrackingToken_returnsTheOrder() {
        String token = openSession();
        var created = given().contentType(ContentType.JSON)
                .header("X-Table-Session", token)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body(burgerAndPanissesCart())
                .post("/v1/orders")
                .then()
                .statusCode(201)
                .extract();
        String orderId = created.path("id");
        String trackingToken = created.path("trackingToken");

        given().filter(ContractValidation.FILTER)
                .when()
                .get("/v1/orders/{orderId}?trackingToken={t}", orderId, trackingToken)
                .then()
                .statusCode(200)
                .body("id", equalTo(orderId))
                .body("status", equalTo("pending_payment"));
    }

    @Test
    void getOrder_wrongTrackingToken_returns404Problem() {
        String token = openSession();
        String orderId = given().contentType(ContentType.JSON)
                .header("X-Table-Session", token)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .body(burgerAndPanissesCart())
                .post("/v1/orders")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

        given().filter(ContractValidation.FILTER)
                .when()
                .get("/v1/orders/{orderId}?trackingToken=ot_ffffffffffffffffffffffffffffffff", orderId)
                .then()
                .statusCode(404)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("resource-not-found"));
    }
}
