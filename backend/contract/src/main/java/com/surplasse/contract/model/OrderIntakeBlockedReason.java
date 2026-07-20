package com.surplasse.contract.model;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Reason why new orders are not effectively accepted. Absent while accepting orders.
 */
public enum OrderIntakeBlockedReason {

  PAUSED("paused"),

  ESTABLISHMENT_NOT_ACTIVE("establishment_not_active"),

  CONFIGURATION_UNAVAILABLE("configuration_unavailable"),

  PAYMENTS_UNAVAILABLE("payments_unavailable");

  private String value;

  OrderIntakeBlockedReason(String value) {
    this.value = value;
  }

    /**
     * Convert a String into String, as specified in the
     * <a href="https://download.oracle.com/otndocs/jcp/jaxrs-2_0-fr-eval-spec/index.html">See JAX RS 2.0 Specification, section 3.2, p. 12</a>
     */
    public static OrderIntakeBlockedReason fromString(String s) {
      for (OrderIntakeBlockedReason b : OrderIntakeBlockedReason.values()) {
        // using Objects.toString() to be safe if value type non-object type
        // because types like 'int' etc. will be auto-boxed
        if (java.util.Objects.toString(b.value).equals(s)) {
          return b;
        }
      }
      throw new IllegalArgumentException("Unexpected string value '" + s + "'");
    }

  @Override
  @JsonValue
  public String toString() {
    return String.valueOf(value);
  }

  @JsonCreator
  public static OrderIntakeBlockedReason fromValue(String value) {
    for (OrderIntakeBlockedReason b : OrderIntakeBlockedReason.values()) {
      if (b.value.equals(value)) {
        return b;
      }
    }
    throw new IllegalArgumentException("Unexpected value '" + value + "'");
  }
}


