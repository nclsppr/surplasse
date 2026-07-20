package com.surplasse.contract.model;

import com.surplasse.contract.model.MenuOption;
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
 * A set of options of a product (doneness, size, extras) with its choice rules. &#x60;minChoices&#x60; of 1 or more makes the group mandatory.
 **/

@JsonTypeName("MenuOptionGroup")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class MenuOptionGroup   {
  private UUID id;
  private String name;
  private Integer minChoices;
  private Integer maxChoices;
  private @Valid List<@Valid MenuOption> options = new ArrayList<>();

  public MenuOptionGroup() {
  }

  @JsonCreator
  public MenuOptionGroup(
    @JsonProperty(required = true, value = "id") UUID id,
    @JsonProperty(required = true, value = "name") String name,
    @JsonProperty(required = true, value = "minChoices") Integer minChoices,
    @JsonProperty(required = true, value = "maxChoices") Integer maxChoices,
    @JsonProperty(required = true, value = "options") List<@Valid MenuOption> options
  ) {
    this.id = id;
    this.name = name;
    this.minChoices = minChoices;
    this.maxChoices = maxChoices;
    this.options = options;
  }

  /**
   * Identifier of the option group.
   **/
  public MenuOptionGroup id(UUID id) {
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
   * Display name of the group.
   **/
  public MenuOptionGroup name(String name) {
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
   * Minimum number of options to pick in the group.
   * minimum: 0
   **/
  public MenuOptionGroup minChoices(Integer minChoices) {
    this.minChoices = minChoices;
    return this;
  }


  @JsonProperty(required = true, value = "minChoices")
  @NotNull  @Min(0)public Integer getMinChoices() {
    return minChoices;
  }

  @JsonProperty(required = true, value = "minChoices")
  public void setMinChoices(Integer minChoices) {
    this.minChoices = minChoices;
  }

  /**
   * Maximum number of options to pick in the group. Always greater than or equal to &#x60;minChoices&#x60;.
   * minimum: 1
   **/
  public MenuOptionGroup maxChoices(Integer maxChoices) {
    this.maxChoices = maxChoices;
    return this;
  }


  @JsonProperty(required = true, value = "maxChoices")
  @NotNull  @Min(1)public Integer getMaxChoices() {
    return maxChoices;
  }

  @JsonProperty(required = true, value = "maxChoices")
  public void setMaxChoices(Integer maxChoices) {
    this.maxChoices = maxChoices;
  }

  /**
   * Options of the group, in display order.
   **/
  public MenuOptionGroup options(List<@Valid MenuOption> options) {
    this.options = options;
    return this;
  }


  @JsonProperty(required = true, value = "options")
  @NotNull @Valid public List<@Valid MenuOption> getOptions() {
    return options;
  }

  @JsonProperty(required = true, value = "options")
  public void setOptions(List<@Valid MenuOption> options) {
    this.options = options;
  }

  public MenuOptionGroup addOptionsItem(MenuOption optionsItem) {
    if (this.options == null) {
      this.options = new ArrayList<>();
    }

    this.options.add(optionsItem);
    return this;
  }

  public MenuOptionGroup removeOptionsItem(MenuOption optionsItem) {
    if (optionsItem != null && this.options != null) {
      this.options.remove(optionsItem);
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
    MenuOptionGroup menuOptionGroup = (MenuOptionGroup) o;
    return Objects.equals(this.id, menuOptionGroup.id) &&
        Objects.equals(this.name, menuOptionGroup.name) &&
        Objects.equals(this.minChoices, menuOptionGroup.minChoices) &&
        Objects.equals(this.maxChoices, menuOptionGroup.maxChoices) &&
        Objects.equals(this.options, menuOptionGroup.options);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, name, minChoices, maxChoices, options);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class MenuOptionGroup {\n");

    sb.append("    id: ").append(toIndentedString(id)).append("\n");
    sb.append("    name: ").append(toIndentedString(name)).append("\n");
    sb.append("    minChoices: ").append(toIndentedString(minChoices)).append("\n");
    sb.append("    maxChoices: ").append(toIndentedString(maxChoices)).append("\n");
    sb.append("    options: ").append(toIndentedString(options)).append("\n");
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

