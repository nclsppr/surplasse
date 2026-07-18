package com.surplasse.contract.model;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonTypeName;

/**
 * An option picked on a line, snapshot at creation time.
 **/

@JsonTypeName("OrderLineOption")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class OrderLineOption   {
  private String group;
  private String option;
  private Integer extraCostCents;

  public OrderLineOption() {
  }

  @JsonCreator
  public OrderLineOption(
    @JsonProperty(required = true, value = "group") String group,
    @JsonProperty(required = true, value = "option") String option,
    @JsonProperty(required = true, value = "extraCostCents") Integer extraCostCents
  ) {
    this.group = group;
    this.option = option;
    this.extraCostCents = extraCostCents;
  }

  /**
   * Name of the option group, frozen at creation.
   **/
  public OrderLineOption group(String group) {
    this.group = group;
    return this;
  }

  
  @JsonProperty(required = true, value = "group")
  @NotNull public String getGroup() {
    return group;
  }

  @JsonProperty(required = true, value = "group")
  public void setGroup(String group) {
    this.group = group;
  }

  /**
   * Name of the option, frozen at creation.
   **/
  public OrderLineOption option(String option) {
    this.option = option;
    return this;
  }

  
  @JsonProperty(required = true, value = "option")
  @NotNull public String getOption() {
    return option;
  }

  @JsonProperty(required = true, value = "option")
  public void setOption(String option) {
    this.option = option;
  }

  /**
   * Extra cost of the option in cents, frozen at creation.
   * minimum: 0
   **/
  public OrderLineOption extraCostCents(Integer extraCostCents) {
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


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    OrderLineOption orderLineOption = (OrderLineOption) o;
    return Objects.equals(this.group, orderLineOption.group) &&
        Objects.equals(this.option, orderLineOption.option) &&
        Objects.equals(this.extraCostCents, orderLineOption.extraCostCents);
  }

  @Override
  public int hashCode() {
    return Objects.hash(group, option, extraCostCents);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class OrderLineOption {\n");
    
    sb.append("    group: ").append(toIndentedString(group)).append("\n");
    sb.append("    option: ").append(toIndentedString(option)).append("\n");
    sb.append("    extraCostCents: ").append(toIndentedString(extraCostCents)).append("\n");
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

