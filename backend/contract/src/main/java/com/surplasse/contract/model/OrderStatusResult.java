package com.surplasse.contract.model;

import java.util.UUID;
import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonTypeName;

/**
 * The order identifier and its status after an idempotent operational update.
 **/

@JsonTypeName("OrderStatusResult")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class OrderStatusResult   {
  private UUID id;
  public enum StatusEnum {

    ACCEPTED(String.valueOf("accepted")), PREPARING(String.valueOf("preparing")), READY(String.valueOf("ready")), SERVED(String.valueOf("served")), PICKED_UP(String.valueOf("picked_up"));


    private String value;

    StatusEnum (String v) {
        value = v;
    }

    public String value() {
        return value;
    }

    @Override
    @JsonValue
    public String toString() {
        return String.valueOf(value);
    }

    /**
     * Convert a String into String, as specified in the
     * <a href="https://download.oracle.com/otndocs/jcp/jaxrs-2_0-fr-eval-spec/index.html">See JAX RS 2.0 Specification, section 3.2, p. 12</a>
     */
    public static StatusEnum fromString(String s) {
        for (StatusEnum b : StatusEnum.values()) {
            // using Objects.toString() to be safe if value type non-object type
            // because types like 'int' etc. will be auto-boxed
            if (java.util.Objects.toString(b.value).equals(s)) {
                return b;
            }
        }
        throw new IllegalArgumentException("Unexpected string value '" + s + "'");
    }

    @JsonCreator
    public static StatusEnum fromValue(String value) {
        for (StatusEnum b : StatusEnum.values()) {
            if (b.value.equals(value)) {
                return b;
            }
        }
        throw new IllegalArgumentException("Unexpected value '" + value + "'");
    }
}

  private StatusEnum status;

  public OrderStatusResult() {
  }

  @JsonCreator
  public OrderStatusResult(
    @JsonProperty(required = true, value = "id") UUID id,
    @JsonProperty(required = true, value = "status") StatusEnum status
  ) {
    this.id = id;
    this.status = status;
  }

  /**
   * Identifier of the updated order.
   **/
  public OrderStatusResult id(UUID id) {
    this.id = id;
    return this;
  }

  
  @JsonProperty(required = true, value = "id")
  @NotNull public UUID getId() {
    return id;
  }

  @JsonProperty(required = true, value = "id")
  public void setId(UUID id) {
    this.id = id;
  }

  /**
   * Status reached by the order.
   **/
  public OrderStatusResult status(StatusEnum status) {
    this.status = status;
    return this;
  }

  
  @JsonProperty(required = true, value = "status")
  @NotNull public StatusEnum getStatus() {
    return status;
  }

  @JsonProperty(required = true, value = "status")
  public void setStatus(StatusEnum status) {
    this.status = status;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    OrderStatusResult orderStatusResult = (OrderStatusResult) o;
    return Objects.equals(this.id, orderStatusResult.id) &&
        Objects.equals(this.status, orderStatusResult.status);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, status);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class OrderStatusResult {\n");
    
    sb.append("    id: ").append(toIndentedString(id)).append("\n");
    sb.append("    status: ").append(toIndentedString(status)).append("\n");
    sb.append("}");
    return sb.toString();
  }

  /**
   * Convert the given object to string with each line indented by 4 spaces
   * (except the first line).
   */
  private String toIndentedString(Object o) {
    if (o == null) {
      return "null";
    }
    return o.toString().replace("\n", "\n    ");
  }


}

