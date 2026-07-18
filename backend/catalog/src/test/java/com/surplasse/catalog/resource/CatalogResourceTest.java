package com.surplasse.catalog.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;

import com.atlassian.oai.validator.OpenApiInteractionValidator;
import com.atlassian.oai.validator.report.LevelResolver;
import com.atlassian.oai.validator.report.ValidationReport;
import com.atlassian.oai.validator.restassured.OpenApiValidationFilter;
import io.quarkus.test.junit.QuarkusTest;
import java.nio.file.Paths;
import org.junit.jupiter.api.Test;

/**
 * Integration tests of the public catalog endpoints against the demo seed,
 * every response validated against api/openapi.yaml (contract test).
 */
@QuarkusTest
class CatalogResourceTest {

    private static final String PROBLEM_JSON = "application/problem+json";

    // The validator mishandles plain-string path parameters under OpenAPI 3.1
    // (it tries to parse them as JSON documents): that single check is
    // ignored, response validation stays complete.
    private static final OpenApiValidationFilter CONTRACT = new OpenApiValidationFilter(
            OpenApiInteractionValidator.createForSpecificationUrl(Paths.get("../../api/openapi.yaml")
                            .toAbsolutePath()
                            .normalize()
                            .toUri()
                            .toString())
                    .withLevelResolver(LevelResolver.create()
                            .withLevel("validation.request.parameter.schema.invalidJson", ValidationReport.Level.IGNORE)
                            .build())
                    .build());

    @Test
    void getEstablishmentPublic_demoSeed_returnsProfile() {
        given().filter(CONTRACT)
                .when()
                .get("/v1/establishments/le-cormoran/public")
                .then()
                .statusCode(200)
                .body("name", equalTo("Le Cormoran"))
                .body("slug", equalTo("le-cormoran"))
                .body("address", equalTo("12 quai des Belges, 13001 Marseille"));
    }

    @Test
    void getPublishedMenu_demoSeed_returnsFullTreeInDisplayOrder() {
        given().filter(CONTRACT)
                .when()
                .get("/v1/establishments/le-cormoran/menu")
                .then()
                .statusCode(200)
                .body("name", equalTo("Carte principale"))
                .body("currency", equalTo("EUR"))
                .body("categories.size()", is(4))
                .body("categories[0].name", equalTo("Entrées"))
                .body("categories[0].products[1].available", is(false))
                .body("categories[1].products[2].name", equalTo("Burger du Vieux-Port"))
                .body("categories[1].products[2].optionGroups[0].name", equalTo("Cuisson"))
                .body("categories[1].products[2].optionGroups[1].options[0].extraCostCents", is(150))
                .body("categories[3].products.size()", is(3));
    }

    @Test
    void getPublishedMenu_unknownSlug_returns404Problem() {
        given().filter(CONTRACT)
                .when()
                .get("/v1/establishments/nulle-part/menu")
                .then()
                .statusCode(404)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("resource-not-found"));
    }

    @Test
    void getPublishedMenu_malformedSlug_returns400Problem() {
        // No contract filter here: the request itself violates the contract on purpose.
        given().when()
                .get("/v1/establishments/Pas-Bon/menu")
                .then()
                .statusCode(400)
                .contentType(PROBLEM_JSON)
                .body("type", containsString("validation-error"));
    }
}
