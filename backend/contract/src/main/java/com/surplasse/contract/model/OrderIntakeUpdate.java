package com.surplasse.contract.model;

import com.surplasse.contract.model.OrderIntakeStatus;
import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonTypeName;

/**
 * Desired operational state of new orders for one establishment.
 **/

@JsonTypeName("OrderIntakeUpdate")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class OrderIntakeUpdate   {
  private OrderIntakeStatus status;

  public OrderIntakeUpdate() {
  }

  @JsonCreator
  public OrderIntakeUpdate(
    @JsonProperty(required = true, value = "status") OrderIntakeStatus status
  ) {
    this.status = status;
  }

  /**
   **/
  public OrderIntakeUpdate status(OrderIntakeStatus status) {
    this.status = status;
    return this;
  }


  @JsonProperty(required = true, value = "status")
  @NotNull public OrderIntakeStatus getStatus() {
    return status;
  }

  @JsonProperty(required = true, value = "status")
  public void setStatus(OrderIntakeStatus status) {
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
    OrderIntakeUpdate orderIntakeUpdate = (OrderIntakeUpdate) o;
    return Objects.equals(this.status, orderIntakeUpdate.status);
  }

  @Override
  public int hashCode() {
    return Objects.hash(status);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class OrderIntakeUpdate {\n");

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
