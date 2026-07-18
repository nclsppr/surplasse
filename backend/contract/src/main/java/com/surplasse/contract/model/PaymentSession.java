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
 * A Stripe payment session for one order. The client secret feeds the Payment Element; the amount is recomputed server side. 
 **/

@JsonTypeName("PaymentSession")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class PaymentSession   {
  private UUID id;
  private UUID orderId;
  private Integer amountCents;
  private String currency;
  private String clientSecret;

  public PaymentSession() {
  }

  @JsonCreator
  public PaymentSession(
    @JsonProperty(required = true, value = "id") UUID id,
    @JsonProperty(required = true, value = "orderId") UUID orderId,
    @JsonProperty(required = true, value = "amountCents") Integer amountCents,
    @JsonProperty(required = true, value = "currency") String currency,
    @JsonProperty(required = true, value = "clientSecret") String clientSecret
  ) {
    this.id = id;
    this.orderId = orderId;
    this.amountCents = amountCents;
    this.currency = currency;
    this.clientSecret = clientSecret;
  }

  /**
   * Identifier of the payment attempt.
   **/
  public PaymentSession id(UUID id) {
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
   * Order being paid.
   **/
  public PaymentSession orderId(UUID orderId) {
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
   * Amount to pay in cents, recomputed server side.
   * minimum: 1
   **/
  public PaymentSession amountCents(Integer amountCents) {
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
   * ISO 4217 currency code.
   **/
  public PaymentSession currency(String currency) {
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
   * Stripe PaymentIntent client secret, consumed by the Payment Element.
   **/
  public PaymentSession clientSecret(String clientSecret) {
    this.clientSecret = clientSecret;
    return this;
  }

  
  @JsonProperty(required = true, value = "clientSecret")
  @NotNull public String getClientSecret() {
    return clientSecret;
  }

  @JsonProperty(required = true, value = "clientSecret")
  public void setClientSecret(String clientSecret) {
    this.clientSecret = clientSecret;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    PaymentSession paymentSession = (PaymentSession) o;
    return Objects.equals(this.id, paymentSession.id) &&
        Objects.equals(this.orderId, paymentSession.orderId) &&
        Objects.equals(this.amountCents, paymentSession.amountCents) &&
        Objects.equals(this.currency, paymentSession.currency) &&
        Objects.equals(this.clientSecret, paymentSession.clientSecret);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, orderId, amountCents, currency, clientSecret);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class PaymentSession {\n");
    
    sb.append("    id: ").append(toIndentedString(id)).append("\n");
    sb.append("    orderId: ").append(toIndentedString(orderId)).append("\n");
    sb.append("    amountCents: ").append(toIndentedString(amountCents)).append("\n");
    sb.append("    currency: ").append(toIndentedString(currency)).append("\n");
    sb.append("    clientSecret: ").append(toIndentedString(clientSecret)).append("\n");
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

