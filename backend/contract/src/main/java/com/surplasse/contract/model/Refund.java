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
 * A full refund attempt and its latest Stripe status.
 **/

@JsonTypeName("Refund")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class Refund   {
  private UUID id;
  private UUID orderId;
  private Integer amountCents;
  private Integer applicationFeeRefundedCents;
  private String currency;
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
  public enum StatusEnum {

    PENDING(String.valueOf("pending")), REQUIRES_ACTION(String.valueOf("requires_action")), SUCCEEDED(String.valueOf("succeeded")), FAILED(String.valueOf("failed")), CANCELED(String.valueOf("canceled"));


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

  public Refund() {
  }

  @JsonCreator
  public Refund(
    @JsonProperty(required = true, value = "id") UUID id,
    @JsonProperty(required = true, value = "orderId") UUID orderId,
    @JsonProperty(required = true, value = "amountCents") Integer amountCents,
    @JsonProperty(required = true, value = "applicationFeeRefundedCents") Integer applicationFeeRefundedCents,
    @JsonProperty(required = true, value = "currency") String currency,
    @JsonProperty(required = true, value = "reason") ReasonEnum reason,
    @JsonProperty(required = true, value = "status") StatusEnum status
  ) {
    this.id = id;
    this.orderId = orderId;
    this.amountCents = amountCents;
    this.applicationFeeRefundedCents = applicationFeeRefundedCents;
    this.currency = currency;
    this.reason = reason;
    this.status = status;
  }

  /**
   * Surplasse refund identifier.
   **/
  public Refund id(UUID id) {
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
   * Refunded order.
   **/
  public Refund orderId(UUID orderId) {
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
   * Full customer amount refunded in cents.
   * minimum: 1
   **/
  public Refund amountCents(Integer amountCents) {
    this.amountCents = amountCents;
    return this;
  }


  @JsonProperty(required = true, value = "amountCents")
  @NotNull  @Min(1)public Integer getAmountCents() {
    return amountCents;
  }

  @JsonProperty(required = true, value = "amountCents")
  public void setAmountCents(Integer amountCents) {
    this.amountCents = amountCents;
  }

  /**
   * Surplasse application fee returned to the restaurant in cents.
   * minimum: 0
   **/
  public Refund applicationFeeRefundedCents(Integer applicationFeeRefundedCents) {
    this.applicationFeeRefundedCents = applicationFeeRefundedCents;
    return this;
  }


  @JsonProperty(required = true, value = "applicationFeeRefundedCents")
  @NotNull  @Min(0)public Integer getApplicationFeeRefundedCents() {
    return applicationFeeRefundedCents;
  }

  @JsonProperty(required = true, value = "applicationFeeRefundedCents")
  public void setApplicationFeeRefundedCents(Integer applicationFeeRefundedCents) {
    this.applicationFeeRefundedCents = applicationFeeRefundedCents;
  }

  /**
   * ISO 4217 currency code.
   **/
  public Refund currency(String currency) {
    this.currency = currency;
    return this;
  }


  @JsonProperty(required = true, value = "currency")
  @NotNull public String getCurrency() {
    return currency;
  }

  @JsonProperty(required = true, value = "currency")
  public void setCurrency(String currency) {
    this.currency = currency;
  }

  /**
   * Operational reason selected by establishment staff.
   **/
  public Refund reason(ReasonEnum reason) {
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

  /**
   * Latest authoritative Stripe refund status.
   **/
  public Refund status(StatusEnum status) {
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
    Refund refund = (Refund) o;
    return Objects.equals(this.id, refund.id) &&
        Objects.equals(this.orderId, refund.orderId) &&
        Objects.equals(this.amountCents, refund.amountCents) &&
        Objects.equals(this.applicationFeeRefundedCents, refund.applicationFeeRefundedCents) &&
        Objects.equals(this.currency, refund.currency) &&
        Objects.equals(this.reason, refund.reason) &&
        Objects.equals(this.status, refund.status);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, orderId, amountCents, applicationFeeRefundedCents, currency, reason, status);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class Refund {\n");

    sb.append("    id: ").append(toIndentedString(id)).append("\n");
    sb.append("    orderId: ").append(toIndentedString(orderId)).append("\n");
    sb.append("    amountCents: ").append(toIndentedString(amountCents)).append("\n");
    sb.append("    applicationFeeRefundedCents: ").append(toIndentedString(applicationFeeRefundedCents)).append("\n");
    sb.append("    currency: ").append(toIndentedString(currency)).append("\n");
    sb.append("    reason: ").append(toIndentedString(reason)).append("\n");
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
