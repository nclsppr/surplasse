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
 * A variant or extra inside an option group.
 **/

@JsonTypeName("MenuOption")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class MenuOption   {
  private UUID id;
  private String name;
  private Integer extraCostCents;
  private Boolean available;

  public MenuOption() {
  }

  @JsonCreator
  public MenuOption(
    @JsonProperty(required = true, value = "id") UUID id,
    @JsonProperty(required = true, value = "name") String name,
    @JsonProperty(required = true, value = "extraCostCents") Integer extraCostCents,
    @JsonProperty(required = true, value = "available") Boolean available
  ) {
    this.id = id;
    this.name = name;
    this.extraCostCents = extraCostCents;
    this.available = available;
  }

  /**
   * Identifier of the option.
   **/
  public MenuOption id(UUID id) {
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
   * Display name of the option.
   **/
  public MenuOption name(String name) {
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
   * Extra cost of the option, in cents. Zero for free variants.
   * minimum: 0
   **/
  public MenuOption extraCostCents(Integer extraCostCents) {
    this.extraCostCents = extraCostCents;
    return this;
  }


  @JsonProperty(required = true, value = "extraCostCents")
  @NotNull  @Min(0)public Integer getExtraCostCents() {
    return extraCostCents;
  }

  @JsonProperty(required = true, value = "extraCostCents")
  public void setExtraCostCents(Integer extraCostCents) {
    this.extraCostCents = extraCostCents;
  }

  /**
   * Whether the option can currently be picked.
   **/
  public MenuOption available(Boolean available) {
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


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    MenuOption menuOption = (MenuOption) o;
    return Objects.equals(this.id, menuOption.id) &&
        Objects.equals(this.name, menuOption.name) &&
        Objects.equals(this.extraCostCents, menuOption.extraCostCents) &&
        Objects.equals(this.available, menuOption.available);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, name, extraCostCents, available);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class MenuOption {\n");

    sb.append("    id: ").append(toIndentedString(id)).append("\n");
    sb.append("    name: ").append(toIndentedString(name)).append("\n");
    sb.append("    extraCostCents: ").append(toIndentedString(extraCostCents)).append("\n");
    sb.append("    available: ").append(toIndentedString(available)).append("\n");
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

