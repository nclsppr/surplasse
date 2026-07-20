package com.surplasse.contract.model;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonTypeName;

/**
 * One line of the validated cart.
 **/

@JsonTypeName("OrderLineRequest")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class OrderLineRequest   {
  private UUID productId;
  private Integer quantity;
  private @Valid List<UUID> optionIds = new ArrayList<>();
  private String note;

  public OrderLineRequest() {
  }

  @JsonCreator
  public OrderLineRequest(
    @JsonProperty(required = true, value = "productId") UUID productId,
    @JsonProperty(required = true, value = "quantity") Integer quantity
  ) {
    this.productId = productId;
    this.quantity = quantity;
  }

  /**
   * Product being ordered.
   **/
  public OrderLineRequest productId(UUID productId) {
    this.productId = productId;
    return this;
  }


  @JsonProperty(required = true, value = "productId")
  @NotNull public UUID getProductId() {
    return productId;
  }

  @JsonProperty(required = true, value = "productId")
  public void setProductId(UUID productId) {
    this.productId = productId;
  }

  /**
   * Quantity ordered.
   * minimum: 1
   * maximum: 50
   **/
  public OrderLineRequest quantity(Integer quantity) {
    this.quantity = quantity;
    return this;
  }


  @JsonProperty(required = true, value = "quantity")
  @NotNull  @Min(1) @Max(50)public Integer getQuantity() {
    return quantity;
  }

  @JsonProperty(required = true, value = "quantity")
  public void setQuantity(Integer quantity) {
    this.quantity = quantity;
  }

  /**
   * Options picked for this line, one entry per picked option, all groups rules enforced server side.
   **/
  public OrderLineRequest optionIds(List<UUID> optionIds) {
    this.optionIds = optionIds;
    return this;
  }


  @JsonProperty("optionIds")
  public List<UUID> getOptionIds() {
    return optionIds;
  }

  @JsonProperty("optionIds")
  public void setOptionIds(List<UUID> optionIds) {
    this.optionIds = optionIds;
  }

  public OrderLineRequest addOptionIdsItem(UUID optionIdsItem) {
    if (this.optionIds == null) {
      this.optionIds = new ArrayList<>();
    }

    this.optionIds.add(optionIdsItem);
    return this;
  }

  public OrderLineRequest removeOptionIdsItem(UUID optionIdsItem) {
    if (optionIdsItem != null && this.optionIds != null) {
      this.optionIds.remove(optionIdsItem);
    }

    return this;
  }
  /**
   * Free note for the kitchen, passed along verbatim.
   **/
  public OrderLineRequest note(String note) {
    this.note = note;
    return this;
  }


  @JsonProperty("note")
   @Size(max=200)public String getNote() {
    return note;
  }

  @JsonProperty("note")
  public void setNote(String note) {
    this.note = note;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    OrderLineRequest orderLineRequest = (OrderLineRequest) o;
    return Objects.equals(this.productId, orderLineRequest.productId) &&
        Objects.equals(this.quantity, orderLineRequest.quantity) &&
        Objects.equals(this.optionIds, orderLineRequest.optionIds) &&
        Objects.equals(this.note, orderLineRequest.note);
  }

  @Override
  public int hashCode() {
    return Objects.hash(productId, quantity, optionIds, note);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class OrderLineRequest {\n");

    sb.append("    productId: ").append(toIndentedString(productId)).append("\n");
    sb.append("    quantity: ").append(toIndentedString(quantity)).append("\n");
    sb.append("    optionIds: ").append(toIndentedString(optionIds)).append("\n");
    sb.append("    note: ").append(toIndentedString(note)).append("\n");
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

