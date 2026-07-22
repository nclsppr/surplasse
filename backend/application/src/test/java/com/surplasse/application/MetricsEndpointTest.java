package com.surplasse.application;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.surplasse.common.event.OrderCreated;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
class MetricsEndpointTest {

    @Inject
    MeterRegistry registry;

    @Inject
    Event<OrderCreated> orderCreated;

    @Test
    void metricsEndpointExposesTechnicalAndBoundedBusinessSeries() {
        given().when().get("/v1/establishments/le-cormoran/public").then().statusCode(200);

        given().header("Accept", "text/plain")
                .when()
                .get("/q/metrics")
                .then()
                .statusCode(200)
                .body(containsString("jvm_"))
                .body(containsString("http_server_requests_seconds"))
                .body(containsString("surplasse_orders_created_total"))
                .body(containsString("surplasse_payment_intent_events_total"))
                .body(containsString("surplasse_sse_connections_active"));
    }

    @Test
    void businessCounterChangesOnlyAfterACommittedTransaction() {
        double before = registry.get("surplasse.orders.created").counter().count();

        QuarkusTransaction.requiringNew().run(() -> orderCreated.fire(signal()));

        assertEquals(
                before + 1, registry.get("surplasse.orders.created").counter().count());

        assertThrows(
                RuntimeException.class, () -> QuarkusTransaction.requiringNew().run(() -> {
                    orderCreated.fire(signal());
                    throw new IllegalStateException("force rollback");
                }));

        assertEquals(
                before + 1, registry.get("surplasse.orders.created").counter().count());
    }

    private static OrderCreated signal() {
        return new OrderCreated(UUID.randomUUID(), UUID.randomUUID());
    }
}
