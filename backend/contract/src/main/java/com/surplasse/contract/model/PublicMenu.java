package com.surplasse.contract.model;

import com.surplasse.contract.model.MenuCategory;
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
 * The published menu of an establishment, as a complete read model in display order. Array order is the display order. 
 **/

@JsonTypeName("PublicMenu")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class PublicMenu   {
  private UUID id;
  private String name;
  private String currency;
  private @Valid List<@Valid MenuCategory> categories = new ArrayList<>();

  public PublicMenu() {
  }

  @JsonCreator
  public PublicMenu(
    @JsonProperty(required = true, value = "id") UUID id,
    @JsonProperty(required = true, value = "name") String name,
    @JsonProperty(required = true, value = "currency") String currency,
    @JsonProperty(required = true, value = "categories") List<@Valid MenuCategory> categories
  ) {
    this.id = id;
    this.name = name;
    this.currency = currency;
    this.categories = categories;
  }

  /**
   * Identifier of the menu.
   **/
  public PublicMenu id(UUID id) {
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
   * Name of the menu, chosen by the restaurateur.
   **/
  public PublicMenu name(String name) {
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
   * ISO 4217 currency code of every amount in the menu.
   **/
  public PublicMenu currency(String currency) {
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
   * Categories of the menu, in display order.
   **/
  public PublicMenu categories(List<@Valid MenuCategory> categories) {
    this.categories = categories;
    return this;
  }

  
  @JsonProperty(required = true, value = "categories")
  @NotNull @Valid public List<@Valid MenuCategory> getCategories() {
    return categories;
  }

  @JsonProperty(required = true, value = "categories")
  public void setCategories(List<@Valid MenuCategory> categories) {
    this.categories = categories;
  }

  public PublicMenu addCategoriesItem(MenuCategory categoriesItem) {
    if (this.categories == null) {
      this.categories = new ArrayList<>();
    }

    this.categories.add(categoriesItem);
    return this;
  }

  public PublicMenu removeCategoriesItem(MenuCategory categoriesItem) {
    if (categoriesItem != null && this.categories != null) {
      this.categories.remove(categoriesItem);
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
    PublicMenu publicMenu = (PublicMenu) o;
    return Objects.equals(this.id, publicMenu.id) &&
        Objects.equals(this.name, publicMenu.name) &&
        Objects.equals(this.currency, publicMenu.currency) &&
        Objects.equals(this.categories, publicMenu.categories);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, name, currency, categories);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class PublicMenu {\n");
    
    sb.append("    id: ").append(toIndentedString(id)).append("\n");
    sb.append("    name: ").append(toIndentedString(name)).append("\n");
    sb.append("    currency: ").append(toIndentedString(currency)).append("\n");
    sb.append("    categories: ").append(toIndentedString(categories)).append("\n");
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

