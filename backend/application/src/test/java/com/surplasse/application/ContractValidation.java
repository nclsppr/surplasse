package com.surplasse.application;

import com.atlassian.oai.validator.OpenApiInteractionValidator;
import com.atlassian.oai.validator.report.LevelResolver;
import com.atlassian.oai.validator.report.ValidationReport;
import com.atlassian.oai.validator.restassured.OpenApiValidationFilter;
import java.nio.file.Paths;

/**
 * Shared contract validation filter of the end-to-end tests. Same OpenAPI
 * 3.1 accommodation as the catalog module: the validator mishandles
 * plain-string path parameters (it parses them as JSON documents), that
 * single check is ignored, response validation stays complete.
 */
final class ContractValidation {

    static final OpenApiValidationFilter FILTER = new OpenApiValidationFilter(
            OpenApiInteractionValidator.createForSpecificationUrl(Paths.get("../../api/openapi.yaml")
                            .toAbsolutePath()
                            .normalize()
                            .toUri()
                            .toString())
                    .withLevelResolver(LevelResolver.create()
                            .withLevel("validation.request.parameter.schema.invalidJson", ValidationReport.Level.IGNORE)
                            .build())
                    .build());

    private ContractValidation() {}
}
