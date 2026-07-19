package com.surplasse.common.error;

import com.fasterxml.jackson.annotation.JsonInclude;

/** RFC 9457 Problem Details body, serialized as application/problem+json. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProblemPayload(String type, String title, int status, String detail, String instance) {

    public static ProblemPayload of(
            String typeBase, String problemType, String title, int status, String detail, String instance) {
        String normalizedBase = typeBase.endsWith("/") ? typeBase : typeBase + "/";
        return new ProblemPayload(normalizedBase + problemType, title, status, detail, instance);
    }
}
