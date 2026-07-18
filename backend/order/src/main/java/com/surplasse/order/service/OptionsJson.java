package com.surplasse.order.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;

/**
 * Serialization of the denormalized option snapshot of an order line
 * (docs/architecture/donnees.md, options_json): labels and extra costs are
 * copied at creation time, because a paid order is an accounting archive
 * while the menu keeps evolving.
 */
public final class OptionsJson {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<OptionSnapshot>> LIST_TYPE = new TypeReference<>() {};

    private OptionsJson() {}

    public static String write(List<OptionSnapshot> options) {
        try {
            return MAPPER.writeValueAsString(options);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Option snapshot serialization failed", e);
        }
    }

    public static List<OptionSnapshot> read(String json) {
        try {
            return MAPPER.readValue(json, LIST_TYPE);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Option snapshot deserialization failed", e);
        }
    }

    public record OptionSnapshot(String group, String option, int extraCostCents) {}
}
