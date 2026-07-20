package com.surplasse.contract.model;

import com.surplasse.contract.model.OrderIntakeBlockedReason;
import com.surplasse.contract.model.OrderIntakeStatus;
import java.time.OffsetDateTime;
import java.util.UUID;
import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonTypeName;

/**
 * Current operational order-intake state of an establishment.
 **/

@JsonTypeName("OrderIntakeState")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class OrderIntakeState   {
  private UUID establishmentId;
  private OrderIntakeStatus status;
  private Boolean acceptingOrders;
  private OrderIntakeBlockedReason blockedReason;
  private OffsetDateTime updatedAt;

  public OrderIntakeState() {
  }

  @JsonCreator
  public OrderIntakeState(
    @JsonProperty(required = true, value = "establishmentId") UUID establishmentId,
    @JsonProperty(required = true, value = "status") OrderIntakeStatus status,
    @JsonProperty(required = true, value = "acceptingOrders") Boolean acceptingOrders,
    @JsonProperty(required = true, value = "updatedAt") OffsetDateTime updatedAt
  ) {
    this.establishmentId = establishmentId;
    this.status = status;
    this.acceptingOrders = acceptingOrders;
    this.updatedAt = updatedAt;
  }

  /**
   **/
  public OrderIntakeState establishmentId(UUID establishmentId) {
    this.establishmentId = establishmentId;
    return this;
  }

  
  @JsonProperty(required = true, value = "establishmentId")
  @NotNull public UUID getEstablishmentId() {
    return establishmentId;
  }

  @JsonProperty(required = true, value = "establishmentId")
  public void setEstablishmentId(UUID establishmentId) {
    this.establishmentId = establishmentId;
  }

  /**
   **/
  public OrderIntakeState status(OrderIntakeStatus status) {
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

  /**
   * Effective availability after lifecycle and Stripe readiness are applied.
   **/
  public OrderIntakeState acceptingOrders(Boolean acceptingOrders) {
    this.acceptingOrders = acceptingOrders;
    return this;
  }

  
  @JsonProperty(required = true, value = "acceptingOrders")
  @NotNull public Boolean getAcceptingOrders() {
    return acceptingOrders;
  }

  @JsonProperty(required = true, value = "acceptingOrders")
  public void setAcceptingOrders(Boolean acceptingOrders) {
    this.acceptingOrders = acceptingOrders;
  }

  /**
   **/
  public OrderIntakeState blockedReason(OrderIntakeBlockedReason blockedReason) {
    this.blockedReason = blockedReason;
    return this;
  }

  
  @JsonProperty("blockedReason")
  public OrderIntakeBlockedReason getBlockedReason() {
    return blockedReason;
  }

  @JsonProperty("blockedReason")
  public void setBlockedReason(OrderIntakeBlockedReason blockedReason) {
    this.blockedReason = blockedReason;
  }

  /**
   * Instant when the configured status last changed, including an automatic pause caused by Stripe. Readiness changes that only affect acceptingOrders do not move it. Repeated idempotent updates keep it unchanged. 
   **/
  public OrderIntakeState updatedAt(OffsetDateTime updatedAt) {
    this.updatedAt = updatedAt;
    return this;
  }

  
  @JsonProperty(required = true, value = "updatedAt")
  @NotNull public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }

  @JsonProperty(required = true, value = "updatedAt")
  public void setUpdatedAt(OffsetDateTime updatedAt) {
    this.updatedAt = updatedAt;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    OrderIntakeState orderIntakeState = (OrderIntakeState) o;
    return Objects.equals(this.establishmentId, orderIntakeState.establishmentId) &&
        Objects.equals(this.status, orderIntakeState.status) &&
        Objects.equals(this.acceptingOrders, orderIntakeState.acceptingOrders) &&
        Objects.equals(this.blockedReason, orderIntakeState.blockedReason) &&
        Objects.equals(this.updatedAt, orderIntakeState.updatedAt);
  }

  @Override
  public int hashCode() {
    return Objects.hash(establishmentId, status, acceptingOrders, blockedReason, updatedAt);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class OrderIntakeState {\n");
    
    sb.append("    establishmentId: ").append(toIndentedString(establishmentId)).append("\n");
    sb.append("    status: ").append(toIndentedString(status)).append("\n");
    sb.append("    acceptingOrders: ").append(toIndentedString(acceptingOrders)).append("\n");
    sb.append("    blockedReason: ").append(toIndentedString(blockedReason)).append("\n");
    sb.append("    updatedAt: ").append(toIndentedString(updatedAt)).append("\n");
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

