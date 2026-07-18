package com.surplasse.common.error;

import com.fasterxml.jackson.annotation.JsonInclude;

/** RFC 9457 Problem Details body, serialized as application/problem+json. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProblemPayload(String type, String title, int status, String detail, String instance) {

    private static final String TYPE_BASE = "https://surplasse.com/problems/";

    public static ProblemPayload of(String problemType, String title, int status, String detail, String instance) {
        return new ProblemPayload(TYPE_BASE + problemType, title, status, detail, instance);
    }
}
