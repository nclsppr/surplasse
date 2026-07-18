package com.surplasse.contract.model;

import com.surplasse.contract.model.OrderLineRequest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonTypeName;

/**
 * The validated cart sent by the Commande frontend. The establishment and the table come from the table session; amounts are recomputed server side from the catalog and never trusted from the client. 
 **/

@JsonTypeName("OrderCreationRequest")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class OrderCreationRequest   {
  public enum TypeEnum {

    ON_SITE(String.valueOf("on_site")), TAKEAWAY(String.valueOf("takeaway"));


    private String value;

    TypeEnum (String v) {
        value = v;
    }

    public String value() {
        return value;
    }

    @Override
    @JsonValue
    public String toString() {
        return String.valueOf(value);
    }

    /**
     * Convert a String into String, as specified in the
     * <a href="https://download.oracle.com/otndocs/jcp/jaxrs-2_0-fr-eval-spec/index.html">See JAX RS 2.0 Specification, section 3.2, p. 12</a>
     */
    public static TypeEnum fromString(String s) {
        for (TypeEnum b : TypeEnum.values()) {
            // using Objects.toString() to be safe if value type non-object type
            // because types like 'int' etc. will be auto-boxed
            if (java.util.Objects.toString(b.value).equals(s)) {
                return b;
            }
        }
        throw new IllegalArgumentException("Unexpected string value '" + s + "'");
    }

    @JsonCreator
    public static TypeEnum fromValue(String value) {
        for (TypeEnum b : TypeEnum.values()) {
            if (b.value.equals(value)) {
                return b;
            }
        }
        throw new IllegalArgumentException("Unexpected value '" + value + "'");
    }
}

  private TypeEnum type;
  private @Valid List<@Valid OrderLineRequest> lines = new ArrayList<>();

  public OrderCreationRequest() {
  }

  @JsonCreator
  public OrderCreationRequest(
    @JsonProperty(required = true, value = "type") TypeEnum type,
    @JsonProperty(required = true, value = "lines") List<@Valid OrderLineRequest> lines
  ) {
    this.type = type;
    this.lines = lines;
  }

  /**
   * Type of the order. Only &#x60;on_site&#x60; is accepted at this stage.
   **/
  public OrderCreationRequest type(TypeEnum type) {
    this.type = type;
    return this;
  }

  
  @JsonProperty(required = true, value = "type")
  @NotNull public TypeEnum getType() {
    return type;
  }

  @JsonProperty(required = true, value = "type")
  public void setType(TypeEnum type) {
    this.type = type;
  }

  /**
   * Lines of the cart, one per product and option combination.
   **/
  public OrderCreationRequest lines(List<@Valid OrderLineRequest> lines) {
    this.lines = lines;
    return this;
  }

  
  @JsonProperty(required = true, value = "lines")
  @NotNull @Valid  @Size(min=1)public List<@Valid OrderLineRequest> getLines() {
    return lines;
  }

  @JsonProperty(required = true, value = "lines")
  public void setLines(List<@Valid OrderLineRequest> lines) {
    this.lines = lines;
  }

  public OrderCreationRequest addLinesItem(OrderLineRequest linesItem) {
    if (this.lines == null) {
      this.lines = new ArrayList<>();
    }

    this.lines.add(linesItem);
    return this;
  }

  public OrderCreationRequest removeLinesItem(OrderLineRequest linesItem) {
    if (linesItem != null && this.lines != null) {
      this.lines.remove(linesItem);
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
    OrderCreationRequest orderCreationRequest = (OrderCreationRequest) o;
    return Objects.equals(this.type, orderCreationRequest.type) &&
        Objects.equals(this.lines, orderCreationRequest.lines);
  }

  @Override
  public int hashCode() {
    return Objects.hash(type, lines);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class OrderCreationRequest {\n");
    
    sb.append("    type: ").append(toIndentedString(type)).append("\n");
    sb.append("    lines: ").append(toIndentedString(lines)).append("\n");
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

