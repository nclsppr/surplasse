package com.surplasse.application;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

/**
 * Smoke test of the assembled application: it boots with every module,
 * migrations apply, and the health endpoint reports UP.
 */
@QuarkusTest
class ApplicationHealthTest {

    @Test
    void health_assembledApplication_reportsUp() {
        given().when().get("/q/health").then().statusCode(200).body("status", equalTo("UP"));
    }
}
