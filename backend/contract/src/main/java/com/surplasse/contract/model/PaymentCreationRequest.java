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
 * The order to open a Stripe payment session for.
 **/

@JsonTypeName("PaymentCreationRequest")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class PaymentCreationRequest   {
  private UUID orderId;

  public PaymentCreationRequest() {
  }

  @JsonCreator
  public PaymentCreationRequest(
    @JsonProperty(required = true, value = "orderId") UUID orderId
  ) {
    this.orderId = orderId;
  }

  /**
   * Order to pay, at status pending_payment, inside the caller&#39;s table session.
   **/
  public PaymentCreationRequest orderId(UUID orderId) {
    this.orderId = orderId;
    return this;
  }


  @JsonProperty(required = true, value = "orderId")
  @NotNull public UUID getOrderId() {
    return orderId;
  }

  @JsonProperty(required = true, value = "orderId")
  public void setOrderId(UUID orderId) {
    this.orderId = orderId;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    PaymentCreationRequest paymentCreationRequest = (PaymentCreationRequest) o;
    return Objects.equals(this.orderId, paymentCreationRequest.orderId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(orderId);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class PaymentCreationRequest {\n");

    sb.append("    orderId: ").append(toIndentedString(orderId)).append("\n");
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
