package com.surplasse.common.error;

import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/**
 * Converts the JAX-RS 404 (unknown route) to the same Problem Details shape
 * as the domain one: the contract knows a single error format.
 */
@Provider
public class RouteNotFoundMapper implements ExceptionMapper<NotFoundException> {

    @Context
    UriInfo uriInfo;

    @Override
    public Response toResponse(NotFoundException exception) {
        ProblemPayload payload = ProblemPayload.of(
                "resource-not-found",
                "Resource not found",
                404,
                "No resource matches this path.",
                "/" + uriInfo.getPath());
        return Response.status(404)
                .type(DomainExceptionMapper.PROBLEM_JSON)
                .entity(payload)
                .build();
    }
}
