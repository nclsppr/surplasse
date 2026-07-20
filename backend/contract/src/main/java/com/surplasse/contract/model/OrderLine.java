package com.surplasse.contract.model;

import com.surplasse.contract.model.OrderLineOption;
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
 * A line of an order, snapshot of the product and options at creation time.
 **/

@JsonTypeName("OrderLine")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class OrderLine   {
  private UUID productId;
  private String productName;
  private Integer unitPriceCents;
  private Integer quantity;
  private @Valid List<@Valid OrderLineOption> options = new ArrayList<>();
  private String note;
  private Integer lineTotalCents;

  public OrderLine() {
  }

  @JsonCreator
  public OrderLine(
    @JsonProperty(required = true, value = "productId") UUID productId,
    @JsonProperty(required = true, value = "productName") String productName,
    @JsonProperty(required = true, value = "unitPriceCents") Integer unitPriceCents,
    @JsonProperty(required = true, value = "quantity") Integer quantity,
    @JsonProperty(required = true, value = "options") List<@Valid OrderLineOption> options,
    @JsonProperty(required = true, value = "lineTotalCents") Integer lineTotalCents
  ) {
    this.productId = productId;
    this.productName = productName;
    this.unitPriceCents = unitPriceCents;
    this.quantity = quantity;
    this.options = options;
    this.lineTotalCents = lineTotalCents;
  }

  /**
   * Product reference; may point to a product later removed from the menu.
   **/
  public OrderLine productId(UUID productId) {
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
   * Name of the product, frozen at creation.
   **/
  public OrderLine productName(String productName) {
    this.productName = productName;
    return this;
  }


  @JsonProperty(required = true, value = "productName")
  @NotNull public String getProductName() {
    return productName;
  }

  @JsonProperty(required = true, value = "productName")
  public void setProductName(String productName) {
    this.productName = productName;
  }

  /**
   * Unit price in cents, frozen at creation.
   * minimum: 0
   **/
  public OrderLine unitPriceCents(Integer unitPriceCents) {
    this.unitPriceCents = unitPriceCents;
    return this;
  }


  @JsonProperty(required = true, value = "unitPriceCents")
  @NotNull  @Min(0)public Integer getUnitPriceCents() {
    return unitPriceCents;
  }

  @JsonProperty(required = true, value = "unitPriceCents")
  public void setUnitPriceCents(Integer unitPriceCents) {
    this.unitPriceCents = unitPriceCents;
  }

  /**
   * Quantity ordered.
   * minimum: 1
   **/
  public OrderLine quantity(Integer quantity) {
    this.quantity = quantity;
    return this;
  }


  @JsonProperty(required = true, value = "quantity")
  @NotNull  @Min(1)public Integer getQuantity() {
    return quantity;
  }

  @JsonProperty(required = true, value = "quantity")
  public void setQuantity(Integer quantity) {
    this.quantity = quantity;
  }

  /**
   * Options picked for this line, snapshot with their labels and extra costs.
   **/
  public OrderLine options(List<@Valid OrderLineOption> options) {
    this.options = options;
    return this;
  }


  @JsonProperty(required = true, value = "options")
  @NotNull @Valid public List<@Valid OrderLineOption> getOptions() {
    return options;
  }

  @JsonProperty(required = true, value = "options")
  public void setOptions(List<@Valid OrderLineOption> options) {
    this.options = options;
  }

  public OrderLine addOptionsItem(OrderLineOption optionsItem) {
    if (this.options == null) {
      this.options = new ArrayList<>();
    }

    this.options.add(optionsItem);
    return this;
  }

  public OrderLine removeOptionsItem(OrderLineOption optionsItem) {
    if (optionsItem != null && this.options != null) {
      this.options.remove(optionsItem);
    }

    return this;
  }
  /**
   * Free note for the kitchen. Absent when not provided.
   **/
  public OrderLine note(String note) {
    this.note = note;
    return this;
  }


  @JsonProperty("note")
  public String getNote() {
    return note;
  }

  @JsonProperty("note")
  public void setNote(String note) {
    this.note = note;
  }

  /**
   * (unit price + extra costs) x quantity, in cents.
   * minimum: 0
   **/
  public OrderLine lineTotalCents(Integer lineTotalCents) {
    this.lineTotalCents = lineTotalCents;
    return this;
  }


  @JsonProperty(required = true, value = "lineTotalCents")
  @NotNull  @Min(0)public Integer getLineTotalCents() {
    return lineTotalCents;
  }

  @JsonProperty(required = true, value = "lineTotalCents")
  public void setLineTotalCents(Integer lineTotalCents) {
    this.lineTotalCents = lineTotalCents;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    OrderLine orderLine = (OrderLine) o;
    return Objects.equals(this.productId, orderLine.productId) &&
        Objects.equals(this.productName, orderLine.productName) &&
        Objects.equals(this.unitPriceCents, orderLine.unitPriceCents) &&
        Objects.equals(this.quantity, orderLine.quantity) &&
        Objects.equals(this.options, orderLine.options) &&
        Objects.equals(this.note, orderLine.note) &&
        Objects.equals(this.lineTotalCents, orderLine.lineTotalCents);
  }

  @Override
  public int hashCode() {
    return Objects.hash(productId, productName, unitPriceCents, quantity, options, note, lineTotalCents);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class OrderLine {\n");

    sb.append("    productId: ").append(toIndentedString(productId)).append("\n");
    sb.append("    productName: ").append(toIndentedString(productName)).append("\n");
    sb.append("    unitPriceCents: ").append(toIndentedString(unitPriceCents)).append("\n");
    sb.append("    quantity: ").append(toIndentedString(quantity)).append("\n");
    sb.append("    options: ").append(toIndentedString(options)).append("\n");
    sb.append("    note: ").append(toIndentedString(note)).append("\n");
    sb.append("    lineTotalCents: ").append(toIndentedString(lineTotalCents)).append("\n");
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

