package com.surplasse.catalog.mapping;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.surplasse.contract.model.OrderIntakeState;

/** Contract state with optional properties omitted instead of serialized as null. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public final class OrderIntakeResponse extends OrderIntakeState {}
