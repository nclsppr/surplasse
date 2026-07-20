package com.surplasse.common.error;

import com.fasterxml.jackson.core.exc.StreamReadException;
import com.fasterxml.jackson.databind.exc.ValueInstantiationException;
import com.surplasse.common.config.PlatformConfig;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/** Handles Jackson read failures wrapped by the Quarkus request body reader. */
@Provider
@Priority(Priorities.USER)
public class MalformedJsonExceptionMapper implements ExceptionMapper<WebApplicationException> {

    @Context
    UriInfo uriInfo;

    @Inject
    PlatformConfig platformConfig;

    @Override
    public Response toResponse(WebApplicationException exception) {
        if (exception.getResponse().getStatus() != 400) {
            return exception.getResponse();
        }
        if (exception.getCause() instanceof StreamReadException) {
            return ValidationProblemResponses.badRequest(
                    platformConfig, uriInfo, "The JSON request body is malformed.");
        }
        if (exception.getCause() instanceof ValueInstantiationException) {
            return ValidationProblemResponses.badRequest(
                    platformConfig, uriInfo, "The JSON request body does not match the expected schema.");
        }
        return exception.getResponse();
    }
}
