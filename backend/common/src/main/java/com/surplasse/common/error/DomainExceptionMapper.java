package com.surplasse.common.error;

import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/** Converts every domain exception to its Problem Details response. */
@Provider
public class DomainExceptionMapper implements ExceptionMapper<DomainException> {

    static final String PROBLEM_JSON = "application/problem+json";

    @Context
    UriInfo uriInfo;

    @Override
    public Response toResponse(DomainException exception) {
        ProblemPayload payload = ProblemPayload.of(
                exception.problemType(),
                exception.title(),
                exception.status(),
                exception.getMessage(),
                "/" + uriInfo.getPath());
        return Response.status(exception.status())
                .type(PROBLEM_JSON)
                .entity(payload)
                .build();
    }
}
