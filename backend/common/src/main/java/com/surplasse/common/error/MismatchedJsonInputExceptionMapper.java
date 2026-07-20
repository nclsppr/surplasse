package com.surplasse.common.error;

import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import com.surplasse.common.config.PlatformConfig;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/** Replaces Quarkus' development-only mismatch payload with the API Problem format. */
@Provider
@Priority(Priorities.USER)
public class MismatchedJsonInputExceptionMapper implements ExceptionMapper<MismatchedInputException> {

    @Context
    UriInfo uriInfo;

    @Inject
    PlatformConfig platformConfig;

    @Override
    public Response toResponse(MismatchedInputException exception) {
        return ValidationProblemResponses.badRequest(
                platformConfig, uriInfo, "The JSON request body does not match the expected schema.");
    }
}
