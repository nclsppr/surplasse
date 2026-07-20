package com.surplasse.common.error;

import com.surplasse.common.config.PlatformConfig;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;

final class ValidationProblemResponses {

    private ValidationProblemResponses() {}

    static Response badRequest(PlatformConfig platformConfig, UriInfo uriInfo, String detail) {
        ProblemPayload payload = ProblemPayload.of(
                platformConfig.problemTypeBase().toString(),
                "validation-error",
                "Validation error",
                400,
                detail,
                DomainExceptionMapper.instancePath(uriInfo));
        return Response.status(400)
                .type(DomainExceptionMapper.PROBLEM_JSON)
                .entity(payload)
                .build();
    }
}
