package com.surplasse.contract.model;

import com.surplasse.contract.model.MenuProduct;
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
 * A section of the menu (starters, mains, drinks).
 **/

@JsonTypeName("MenuCategory")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class MenuCategory   {
  private UUID id;
  private String name;
  private @Valid List<@Valid MenuProduct> products = new ArrayList<>();

  public MenuCategory() {
  }

  @JsonCreator
  public MenuCategory(
    @JsonProperty(required = true, value = "id") UUID id,
    @JsonProperty(required = true, value = "name") String name,
    @JsonProperty(required = true, value = "products") List<@Valid MenuProduct> products
  ) {
    this.id = id;
    this.name = name;
    this.products = products;
  }

  /**
   * Identifier of the category.
   **/
  public MenuCategory id(UUID id) {
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
   * Display name of the category.
   **/
  public MenuCategory name(String name) {
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
   * Products of the category, in display order.
   **/
  public MenuCategory products(List<@Valid MenuProduct> products) {
    this.products = products;
    return this;
  }


  @JsonProperty(required = true, value = "products")
  @NotNull @Valid public List<@Valid MenuProduct> getProducts() {
    return products;
  }

  @JsonProperty(required = true, value = "products")
  public void setProducts(List<@Valid MenuProduct> products) {
    this.products = products;
  }

  public MenuCategory addProductsItem(MenuProduct productsItem) {
    if (this.products == null) {
      this.products = new ArrayList<>();
    }

    this.products.add(productsItem);
    return this;
  }

  public MenuCategory removeProductsItem(MenuProduct productsItem) {
    if (productsItem != null && this.products != null) {
      this.products.remove(productsItem);
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
    MenuCategory menuCategory = (MenuCategory) o;
    return Objects.equals(this.id, menuCategory.id) &&
        Objects.equals(this.name, menuCategory.name) &&
        Objects.equals(this.products, menuCategory.products);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, name, products);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class MenuCategory {\n");

    sb.append("    id: ").append(toIndentedString(id)).append("\n");
    sb.append("    name: ").append(toIndentedString(name)).append("\n");
    sb.append("    products: ").append(toIndentedString(products)).append("\n");
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

