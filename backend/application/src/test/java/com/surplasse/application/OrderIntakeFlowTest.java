package com.surplasse.application;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;

import com.surplasse.common.config.PlatformConfig;
import com.surplasse.identity.config.IdentityConfig;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import io.smallrye.jwt.build.Jwt;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** End-to-end operational pause, including customer and restaurateur continuity. */
@QuarkusTest
class OrderIntakeFlowTest {

    private static final String ESTABLISHMENT = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    private static final String RESTAURATEUR = "a1b2c3d4-e5f6-4789-8abc-def012345678";
    private static final String ACCESS_COOKIE = "surplasse_session";
    private static final String PROBLEM_JSON = "application/problem+json";
    private static final String TABLE_4_CODE = "tbl_2f8e6a4c0b9d7e1f";

    @Inject
    IdentityConfig identityConfig;

    @Inject
    PlatformConfig platformConfig;

    @Inject
    EntityManager entityManager;

    @Test
    void pause_blocksEveryNewAdmissionButPreservesExistingOrderOperations() {
        String accessToken = pilotAccessToken();
        given().filter(ContractValidation.FILTER)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .when()
                .get("/v1/establishments/{establishmentId}/order-intake", ESTABLISHMENT)
                .then()
                .statusCode(200)
                .body("status", equalTo("open"))
                .body("acceptingOrders", is(true));
        String tableSession = OrderFlowTest.openSession();
        UUID orderKey = UUID.randomUUID();
        Response createdOrder = createOrder(tableSession, orderKey)
                .then()
                .statusCode(201)
                .extract()
                .response();
        String orderId = createdOrder.path("id");
        String trackingToken = createdOrder.path("trackingToken");
        UUID paymentKey = UUID.randomUUID();

        createPayment(tableSession, orderId, paymentKey).then().statusCode(201);

        try {
            Response firstPause = updateIntake(accessToken, "paused")
                    .then()
                    .statusCode(200)
                    .body("status", equalTo("paused"))
                    .body("acceptingOrders", is(false))
                    .body("blockedReason", equalTo("paused"))
                    .extract()
                    .response();
            String pausedAt = firstPause.path("updatedAt");

            updateIntake(accessToken, "paused").then().statusCode(200).body("updatedAt", equalTo(pausedAt));

            given().filter(ContractValidation.FILTER)
                    .when()
                    .get("/v1/establishments/le-cormoran/public")
                    .then()
                    .statusCode(200)
                    .body("acceptingOrders", is(false));
            given().filter(ContractValidation.FILTER)
                    .when()
                    .get("/v1/establishments/le-cormoran/menu")
                    .then()
                    .statusCode(200);

            given().filter(ContractValidation.FILTER)
                    .contentType(ContentType.JSON)
                    .body("{\"establishmentSlug\":\"le-cormoran\",\"tableCode\":\"%s\"}".formatted(TABLE_4_CODE))
                    .when()
                    .post("/v1/table-sessions")
                    .then()
                    .statusCode(404);

            createOrder(tableSession, orderKey).then().statusCode(201).body("id", equalTo(orderId));

            given().filter(ContractValidation.FILTER)
                    .contentType(ContentType.JSON)
                    .header("X-Table-Session", tableSession)
                    .header("Idempotency-Key", UUID.randomUUID().toString())
                    .body(OrderFlowTest.burgerAndPanissesCart())
                    .when()
                    .post("/v1/orders")
                    .then()
                    .statusCode(409)
                    .contentType(PROBLEM_JSON)
                    .body("type", containsString("order-intake-paused"));

            createPayment(tableSession, orderId, paymentKey)
                    .then()
                    .statusCode(409)
                    .contentType(PROBLEM_JSON)
                    .body("type", containsString("order-intake-paused"));
            createPayment(tableSession, orderId, UUID.randomUUID())
                    .then()
                    .statusCode(409)
                    .contentType(PROBLEM_JSON)
                    .body("type", containsString("order-intake-paused"));

            reconcilePayment(orderId);

            given().filter(ContractValidation.FILTER)
                    .queryParam("trackingToken", trackingToken)
                    .when()
                    .get("/v1/orders/{orderId}", orderId)
                    .then()
                    .statusCode(200)
                    .body("status", equalTo("paid"));

            given().filter(ContractValidation.FILTER)
                    .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                    .queryParam("establishmentId", ESTABLISHMENT)
                    .when()
                    .get("/v1/orders")
                    .then()
                    .statusCode(200)
                    .body("items.id", hasItem(orderId));

            given().filter(ContractValidation.FILTER)
                    .contentType(ContentType.JSON)
                    .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                    .body("{\"status\":\"accepted\"}")
                    .when()
                    .patch("/v1/orders/{orderId}/status", orderId)
                    .then()
                    .statusCode(200)
                    .body("status", equalTo("accepted"));
        } finally {
            updateIntake(accessToken, "open").then().statusCode(200).body("acceptingOrders", is(true));
        }
    }

    @Test
    void getOrderIntake_requiresAuthenticationAndHidesUnknownScope() {
        given().when()
                .get("/v1/establishments/{establishmentId}/order-intake", ESTABLISHMENT)
                .then()
                .statusCode(401)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("session-expired"));

        given().contentType(ContentType.JSON)
                .body("{\"status\":\"paused\"}")
                .when()
                .put("/v1/establishments/{establishmentId}/order-intake", ESTABLISHMENT)
                .then()
                .statusCode(401)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("session-expired"));

        String accessToken = pilotAccessToken();
        given().filter(ContractValidation.FILTER)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .when()
                .get("/v1/establishments/{establishmentId}/order-intake", UUID.randomUUID())
                .then()
                .statusCode(404)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("resource-not-found"));

        given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .body("{\"status\":\"paused\"}")
                .when()
                .put("/v1/establishments/{establishmentId}/order-intake", UUID.randomUUID())
                .then()
                .statusCode(404)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("resource-not-found"));
    }

    @Test
    void updateOrderIntake_invalidJsonUsesTheApiProblemFormat() {
        String accessToken = pilotAccessToken();

        given().contentType(ContentType.JSON)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .body("{\"status\":\"invalid\"}")
                .when()
                .put("/v1/establishments/{establishmentId}/order-intake", ESTABLISHMENT)
                .then()
                .statusCode(400)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("validation-error"))
                .body("title", equalTo("Validation error"))
                .body("status", is(400))
                .body("detail", equalTo("The JSON request body does not match the expected schema."))
                .body("instance", equalTo("/v1/establishments/%s/order-intake".formatted(ESTABLISHMENT)));

        given().contentType(ContentType.JSON)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .body("{\"status\":{}}")
                .when()
                .put("/v1/establishments/{establishmentId}/order-intake", ESTABLISHMENT)
                .then()
                .statusCode(400)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("validation-error"))
                .body("title", equalTo("Validation error"))
                .body("status", is(400))
                .body("detail", equalTo("The JSON request body does not match the expected schema."))
                .body("instance", equalTo("/v1/establishments/%s/order-intake".formatted(ESTABLISHMENT)));

        given().contentType(ContentType.JSON)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .body("{\"status\":\"paused\",\"unexpected\":true}")
                .when()
                .put("/v1/establishments/{establishmentId}/order-intake", ESTABLISHMENT)
                .then()
                .statusCode(400)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("validation-error"))
                .body("title", equalTo("Validation error"))
                .body("status", is(400))
                .body("detail", equalTo("The JSON request body does not match the expected schema."))
                .body("instance", equalTo("/v1/establishments/%s/order-intake".formatted(ESTABLISHMENT)));

        given().contentType(ContentType.JSON)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .body("{\"status\":\"paused\"")
                .when()
                .put("/v1/establishments/{establishmentId}/order-intake", ESTABLISHMENT)
                .then()
                .statusCode(400)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("validation-error"))
                .body("title", equalTo("Validation error"))
                .body("status", is(400))
                .body("detail", equalTo("The JSON request body is malformed."))
                .body("instance", equalTo("/v1/establishments/%s/order-intake".formatted(ESTABLISHMENT)));

        given().filter(ContractValidation.FILTER)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .when()
                .get("/v1/establishments/{establishmentId}/order-intake", ESTABLISHMENT)
                .then()
                .statusCode(200)
                .body("status", equalTo("open"));
    }

    @Test
    void openOrderIntake_exposesStableProblemTypesForEveryUnavailablePrerequisite() {
        String accessToken = pilotAccessToken();
        try {
            setEstablishmentStatus("suspended");
            assertOpenRejectedWith(accessToken, "order-intake-establishment-not-active");

            setEstablishmentStatus("active");
            setMenuStatus("draft");
            assertOpenRejectedWith(accessToken, "order-intake-configuration-unavailable");

            setMenuStatus("published");
            setStripeCardPaymentsActive(false);
            assertOpenRejectedWith(accessToken, "order-intake-payments-unavailable");
        } finally {
            restoreOrderIntakePrerequisites();
            updateIntake(accessToken, "open").then().statusCode(200).body("acceptingOrders", is(true));
        }
    }

    private static Response createOrder(String tableSession, UUID idempotencyKey) {
        return given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", tableSession)
                .header("Idempotency-Key", idempotencyKey.toString())
                .body(OrderFlowTest.burgerAndPanissesCart())
                .when()
                .post("/v1/orders");
    }

    private static Response createPayment(String tableSession, String orderId, UUID idempotencyKey) {
        return given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("X-Table-Session", tableSession)
                .header("Idempotency-Key", idempotencyKey.toString())
                .body("{\"orderId\":\"%s\"}".formatted(orderId))
                .when()
                .post("/v1/payments");
    }

    private static void reconcilePayment(String orderId) {
        given().contentType(ContentType.JSON)
                .header("Stripe-Signature", FakeStripeEventVerifier.VALID_SIGNATURE)
                .body(
                        "{\"id\":\"evt_%s\",\"type\":\"payment_intent.succeeded\",\"account\":\"acct_test_le_cormoran\",\"livemode\":false,\"data\":{\"object\":{\"id\":\"pi_fake_%s\"}}}"
                                .formatted(UUID.randomUUID(), orderId))
                .post("/v1/webhooks/stripe")
                .then()
                .statusCode(200);
    }

    private static Response updateIntake(String accessToken, String status) {
        return given().filter(ContractValidation.FILTER)
                .contentType(ContentType.JSON)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .body("{\"status\":\"%s\"}".formatted(status))
                .when()
                .put("/v1/establishments/{establishmentId}/order-intake", ESTABLISHMENT);
    }

    private void assertOpenRejectedWith(String accessToken, String problemType) {
        given().contentType(ContentType.JSON)
                .header("Cookie", ACCESS_COOKIE + "=" + accessToken)
                .body("{\"status\":\"open\"}")
                .when()
                .put("/v1/establishments/{establishmentId}/order-intake", ESTABLISHMENT)
                .then()
                .statusCode(422)
                .contentType(PROBLEM_JSON)
                .body(
                        "type",
                        equalTo(platformConfig
                                .problemTypeBase()
                                .resolve(problemType)
                                .toString()))
                .body("title", equalTo("Order intake unavailable"))
                .body("status", is(422));
    }

    private void setEstablishmentStatus(String status) {
        inNewTransaction(() -> entityManager
                .createNativeQuery("update establishment set status = :status where id = :id")
                .setParameter("status", status)
                .setParameter("id", UUID.fromString(ESTABLISHMENT))
                .executeUpdate());
    }

    private void setMenuStatus(String status) {
        inNewTransaction(() -> entityManager
                .createNativeQuery("update menu set status = :status where establishment_id = :id")
                .setParameter("status", status)
                .setParameter("id", UUID.fromString(ESTABLISHMENT))
                .executeUpdate());
    }

    private void setStripeCardPaymentsActive(boolean active) {
        inNewTransaction(() -> entityManager
                .createNativeQuery("update establishment set stripe_card_payments_active = :active where id = :id")
                .setParameter("active", active)
                .setParameter("id", UUID.fromString(ESTABLISHMENT))
                .executeUpdate());
    }

    private void restoreOrderIntakePrerequisites() {
        inNewTransaction(() -> {
            entityManager
                    .createNativeQuery(
                            "update establishment set status = 'active', stripe_card_payments_active = true where id = :id")
                    .setParameter("id", UUID.fromString(ESTABLISHMENT))
                    .executeUpdate();
            entityManager
                    .createNativeQuery("update menu set status = 'published' where establishment_id = :id")
                    .setParameter("id", UUID.fromString(ESTABLISHMENT))
                    .executeUpdate();
        });
    }

    private void inNewTransaction(Runnable mutation) {
        QuarkusTransaction.requiringNew().run(() -> {
            mutation.run();
            entityManager.clear();
        });
    }

    private String pilotAccessToken() {
        Instant now = Instant.now();
        return Jwt.subject(RESTAURATEUR)
                .issuer(identityConfig.jwtIssuer())
                .audience(identityConfig.jwtAudience())
                .issuedAt(now.getEpochSecond())
                .expiresAt(now.plusSeconds(900).getEpochSecond())
                .claim("jti", UUID.randomUUID().toString())
                .claim("sid", UUID.randomUUID().toString())
                .sign();
    }
}
