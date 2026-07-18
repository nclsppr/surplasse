package com.surplasse.contract.model;

import com.surplasse.contract.model.MenuOptionGroup;
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
 * A product as displayed on the menu. Unavailable products are included with &#x60;available: false&#x60; so the frontend renders them greyed out. 
 **/

@JsonTypeName("MenuProduct")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class MenuProduct   {
  private UUID id;
  private String name;
  private String description;
  private Integer priceCents;
  private Boolean available;
  private @Valid List<@Valid MenuOptionGroup> optionGroups = new ArrayList<>();

  public MenuProduct() {
  }

  @JsonCreator
  public MenuProduct(
    @JsonProperty(required = true, value = "id") UUID id,
    @JsonProperty(required = true, value = "name") String name,
    @JsonProperty(required = true, value = "priceCents") Integer priceCents,
    @JsonProperty(required = true, value = "available") Boolean available,
    @JsonProperty(required = true, value = "optionGroups") List<@Valid MenuOptionGroup> optionGroups
  ) {
    this.id = id;
    this.name = name;
    this.priceCents = priceCents;
    this.available = available;
    this.optionGroups = optionGroups;
  }

  /**
   * Identifier of the product.
   **/
  public MenuProduct id(UUID id) {
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
   * Display name of the product.
   **/
  public MenuProduct name(String name) {
    this.name = name;
    return this;
  }

  
  @JsonProperty(required = true, value = "name")
  @NotNull public String getName() {
    return name;
  }

  @JsonProperty(required = true, value = "name")
  public void setName(String name) {
    this.name = name;
  }

  /**
   * Short description of the product. Absent when not provided.
   **/
  public MenuProduct description(String description) {
    this.description = description;
    return this;
  }

  
  @JsonProperty("description")
  public String getDescription() {
    return description;
  }

  @JsonProperty("description")
  public void setDescription(String description) {
    this.description = description;
  }

  /**
   * Base price of the product, in cents.
   * minimum: 0
   **/
  public MenuProduct priceCents(Integer priceCents) {
    this.priceCents = priceCents;
    return this;
  }

  
  @JsonProperty(required = true, value = "priceCents")
  @NotNull  @Min(0)public Integer getPriceCents() {
    return priceCents;
  }

  @JsonProperty(required = true, value = "priceCents")
  public void setPriceCents(Integer priceCents) {
    this.priceCents = priceCents;
  }

  /**
   * Whether the product can currently be ordered.
   **/
  public MenuProduct available(Boolean available) {
    this.available = available;
    return this;
  }

  
  @JsonProperty(required = true, value = "available")
  @NotNull public Boolean getAvailable() {
    return available;
  }

  @JsonProperty(required = true, value = "available")
  public void setAvailable(Boolean available) {
    this.available = available;
  }

  /**
   * Option groups of the product, in display order. Empty when the product has no options.
   **/
  public MenuProduct optionGroups(List<@Valid MenuOptionGroup> optionGroups) {
    this.optionGroups = optionGroups;
    return this;
  }

  
  @JsonProperty(required = true, value = "optionGroups")
  @NotNull @Valid public List<@Valid MenuOptionGroup> getOptionGroups() {
    return optionGroups;
  }

  @JsonProperty(required = true, value = "optionGroups")
  public void setOptionGroups(List<@Valid MenuOptionGroup> optionGroups) {
    this.optionGroups = optionGroups;
  }

  public MenuProduct addOptionGroupsItem(MenuOptionGroup optionGroupsItem) {
    if (this.optionGroups == null) {
      this.optionGroups = new ArrayList<>();
    }

    this.optionGroups.add(optionGroupsItem);
    return this;
  }

  public MenuProduct removeOptionGroupsItem(MenuOptionGroup optionGroupsItem) {
    if (optionGroupsItem != null && this.optionGroups != null) {
      this.optionGroups.remove(optionGroupsItem);
    }

    return this;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    MenuProduct menuProduct = (MenuProduct) o;
    return Objects.equals(this.id, menuProduct.id) &&
        Objects.equals(this.name, menuProduct.name) &&
        Objects.equals(this.description, menuProduct.description) &&
        Objects.equals(this.priceCents, menuProduct.priceCents) &&
        Objects.equals(this.available, menuProduct.available) &&
        Objects.equals(this.optionGroups, menuProduct.optionGroups);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, name, description, priceCents, available, optionGroups);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class MenuProduct {\n");
    
    sb.append("    id: ").append(toIndentedString(id)).append("\n");
    sb.append("    name: ").append(toIndentedString(name)).append("\n");
    sb.append("    description: ").append(toIndentedString(description)).append("\n");
    sb.append("    priceCents: ").append(toIndentedString(priceCents)).append("\n");
    sb.append("    available: ").append(toIndentedString(available)).append("\n");
    sb.append("    optionGroups: ").append(toIndentedString(optionGroups)).append("\n");
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

