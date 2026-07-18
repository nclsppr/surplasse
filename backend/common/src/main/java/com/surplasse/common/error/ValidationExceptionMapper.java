package com.surplasse.common.error;

import jakarta.annotation.Priority;
import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import java.util.stream.Collectors;

/**
 * Converts Bean Validation failures (malformed path parameters, invalid
 * request bodies) to a 400 Problem Details, ahead of the default mapper.
 */
@Provider
@Priority(Priorities.USER)
public class ValidationExceptionMapper implements ExceptionMapper<ConstraintViolationException> {

    @Context
    UriInfo uriInfo;

    @Override
    public Response toResponse(ConstraintViolationException exception) {
        String detail = exception.getConstraintViolations().stream()
                .map(violation -> violation.getPropertyPath() + " " + violation.getMessage())
                .sorted()
                .collect(Collectors.joining("; "));
        ProblemPayload payload = ProblemPayload.of(
                "validation-error", "Validation error", 400, detail, DomainExceptionMapper.instancePath(uriInfo));
        return Response.status(400)
                .type(DomainExceptionMapper.PROBLEM_JSON)
                .entity(payload)
                .build();
    }
}
