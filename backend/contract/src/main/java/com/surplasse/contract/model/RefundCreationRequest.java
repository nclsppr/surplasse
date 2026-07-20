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
 * The paid order and operational reason for its full refund.
 **/

@JsonTypeName("RefundCreationRequest")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class RefundCreationRequest   {
  private UUID orderId;
  public enum ReasonEnum {

    RESTAURANT_REFUSAL(String.valueOf("restaurant_refusal")), ITEM_UNAVAILABLE(String.valueOf("item_unavailable")), SERVICE_INCIDENT(String.valueOf("service_incident"));


    private String value;

    ReasonEnum (String v) {
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
    public static ReasonEnum fromString(String s) {
        for (ReasonEnum b : ReasonEnum.values()) {
            // using Objects.toString() to be safe if value type non-object type
            // because types like 'int' etc. will be auto-boxed
            if (java.util.Objects.toString(b.value).equals(s)) {
                return b;
            }
        }
        throw new IllegalArgumentException("Unexpected string value '" + s + "'");
    }

    @JsonCreator
    public static ReasonEnum fromValue(String value) {
        for (ReasonEnum b : ReasonEnum.values()) {
            if (b.value.equals(value)) {
                return b;
            }
        }
        throw new IllegalArgumentException("Unexpected value '" + value + "'");
    }
}

  private ReasonEnum reason;

  public RefundCreationRequest() {
  }

  @JsonCreator
  public RefundCreationRequest(
    @JsonProperty(required = true, value = "orderId") UUID orderId,
    @JsonProperty(required = true, value = "reason") ReasonEnum reason
  ) {
    this.orderId = orderId;
    this.reason = reason;
  }

  /**
   * Paid order owned by the authenticated establishment.
   **/
  public RefundCreationRequest orderId(UUID orderId) {
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

  /**
   * Operational reason recorded by Surplasse and sent to Stripe metadata.
   **/
  public RefundCreationRequest reason(ReasonEnum reason) {
    this.reason = reason;
    return this;
  }


  @JsonProperty(required = true, value = "reason")
  @NotNull public ReasonEnum getReason() {
    return reason;
  }

  @JsonProperty(required = true, value = "reason")
  public void setReason(ReasonEnum reason) {
    this.reason = reason;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    RefundCreationRequest refundCreationRequest = (RefundCreationRequest) o;
    return Objects.equals(this.orderId, refundCreationRequest.orderId) &&
        Objects.equals(this.reason, refundCreationRequest.reason);
  }

  @Override
  public int hashCode() {
    return Objects.hash(orderId, reason);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class RefundCreationRequest {\n");

    sb.append("    orderId: ").append(toIndentedString(orderId)).append("\n");
    sb.append("    reason: ").append(toIndentedString(reason)).append("\n");
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
