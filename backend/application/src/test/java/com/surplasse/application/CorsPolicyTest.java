package com.surplasse.application;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class CorsPolicyTest {

    @Test
    void publicOriginsCanReadPublicResponsesWithoutCredentials() {
        assertPublicOrigin("https://surplasse.test");
        assertPublicOrigin("https://dashboard.surplasse.test");
        assertPublicOrigin("https://demo.surplasse.test");
    }

    @Test
    void foreignAndNestedOriginsAreNotAllowed() {
        assertRejectedOrigin("https://attacker.example");
        assertRejectedOrigin("https://table.demo.surplasse.test");
    }

    private static void assertPublicOrigin(String origin) {
        given().header("Origin", origin)
                .when()
                .get("/q/health")
                .then()
                .statusCode(200)
                .header("Access-Control-Allow-Origin", equalTo(origin))
                .header("Access-Control-Allow-Credentials", equalTo("false"));
    }

    private static void assertRejectedOrigin(String origin) {
        given().header("Origin", origin)
                .when()
                .get("/q/health")
                .then()
                .statusCode(403)
                .header("Access-Control-Allow-Origin", nullValue())
                .header("Access-Control-Allow-Credentials", nullValue());
    }
}
