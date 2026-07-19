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

    /** Request path with exactly one leading slash, whatever the runtime returns. */
    static String instancePath(UriInfo uriInfo) {
        String path = uriInfo.getPath();
        return path.startsWith("/") ? path : "/" + path;
    }

    @Context
    UriInfo uriInfo;

    @Override
    public Response toResponse(DomainException exception) {
        ProblemPayload payload = ProblemPayload.of(
                exception.problemType(),
                exception.title(),
                exception.status(),
                exception.getMessage(),
                instancePath(uriInfo));
        Response.ResponseBuilder response =
                Response.status(exception.status()).type(PROBLEM_JSON).entity(payload);
        if (exception instanceof RateLimitedException rateLimited) {
            response.header("Retry-After", rateLimited.retryAfterSeconds());
        }
        return response.build();
    }
}
