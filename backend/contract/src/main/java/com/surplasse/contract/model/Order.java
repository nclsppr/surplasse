package com.surplasse.contract.model;

import com.surplasse.contract.model.OrderLine;
import java.time.OffsetDateTime;
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
 * An order as seen by the customer: lines frozen at creation (names, prices and options copied from the catalog at that instant), status driven by the kitchen.
 **/

@JsonTypeName("Order")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class Order   {
  private UUID id;
  private String displayNumber;
  public enum StatusEnum {

    PENDING_PAYMENT(String.valueOf("pending_payment")), PAID(String.valueOf("paid")), ACCEPTED(String.valueOf("accepted")), PREPARING(String.valueOf("preparing")), READY(String.valueOf("ready")), SERVED(String.valueOf("served")), PICKED_UP(String.valueOf("picked_up")), CANCELLED(String.valueOf("cancelled")), REFUNDED(String.valueOf("refunded"));


    private String value;

    StatusEnum (String v) {
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
    public static StatusEnum fromString(String s) {
        for (StatusEnum b : StatusEnum.values()) {
            // using Objects.toString() to be safe if value type non-object type
            // because types like 'int' etc. will be auto-boxed
            if (java.util.Objects.toString(b.value).equals(s)) {
                return b;
            }
        }
        throw new IllegalArgumentException("Unexpected string value '" + s + "'");
    }

    @JsonCreator
    public static StatusEnum fromValue(String value) {
        for (StatusEnum b : StatusEnum.values()) {
            if (b.value.equals(value)) {
                return b;
            }
        }
        throw new IllegalArgumentException("Unexpected value '" + value + "'");
    }
}

  private StatusEnum status;
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
  private String tableLabel;
  private @Valid List<@Valid OrderLine> lines = new ArrayList<>();
  private Integer totalCents;
  private String currency;
  private String trackingToken;
  private OffsetDateTime createdAt;

  public Order() {
  }

  @JsonCreator
  public Order(
    @JsonProperty(required = true, value = "id") UUID id,
    @JsonProperty(required = true, value = "displayNumber") String displayNumber,
    @JsonProperty(required = true, value = "status") StatusEnum status,
    @JsonProperty(required = true, value = "type") TypeEnum type,
    @JsonProperty(required = true, value = "lines") List<@Valid OrderLine> lines,
    @JsonProperty(required = true, value = "totalCents") Integer totalCents,
    @JsonProperty(required = true, value = "currency") String currency,
    @JsonProperty(required = true, value = "trackingToken") String trackingToken,
    @JsonProperty(required = true, value = "createdAt") OffsetDateTime createdAt
  ) {
    this.id = id;
    this.displayNumber = displayNumber;
    this.status = status;
    this.type = type;
    this.lines = lines;
    this.totalCents = totalCents;
    this.currency = currency;
    this.trackingToken = trackingToken;
    this.createdAt = createdAt;
  }

  /**
   * Identifier of the order.
   **/
  public Order id(UUID id) {
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
   * Short number displayed to the customer and the staff, unique per establishment and day.
   **/
  public Order displayNumber(String displayNumber) {
    this.displayNumber = displayNumber;
    return this;
  }


  @JsonProperty(required = true, value = "displayNumber")
  @NotNull public String getDisplayNumber() {
    return displayNumber;
  }

  @JsonProperty(required = true, value = "displayNumber")
  public void setDisplayNumber(String displayNumber) {
    this.displayNumber = displayNumber;
  }

  /**
   * Current status of the order.
   **/
  public Order status(StatusEnum status) {
    this.status = status;
    return this;
  }


  @JsonProperty(required = true, value = "status")
  @NotNull public StatusEnum getStatus() {
    return status;
  }

  @JsonProperty(required = true, value = "status")
  public void setStatus(StatusEnum status) {
    this.status = status;
  }

  /**
   * Type of the order.
   **/
  public Order type(TypeEnum type) {
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
   * Label of the table for on-site orders. Absent for takeaway.
   **/
  public Order tableLabel(String tableLabel) {
    this.tableLabel = tableLabel;
    return this;
  }


  @JsonProperty("tableLabel")
  public String getTableLabel() {
    return tableLabel;
  }

  @JsonProperty("tableLabel")
  public void setTableLabel(String tableLabel) {
    this.tableLabel = tableLabel;
  }

  /**
   * Lines of the order, frozen at creation.
   **/
  public Order lines(List<@Valid OrderLine> lines) {
    this.lines = lines;
    return this;
  }


  @JsonProperty(required = true, value = "lines")
  @NotNull @Valid public List<@Valid OrderLine> getLines() {
    return lines;
  }

  @JsonProperty(required = true, value = "lines")
  public void setLines(List<@Valid OrderLine> lines) {
    this.lines = lines;
  }

  public Order addLinesItem(OrderLine linesItem) {
    if (this.lines == null) {
      this.lines = new ArrayList<>();
    }

    this.lines.add(linesItem);
    return this;
  }

  public Order removeLinesItem(OrderLine linesItem) {
    if (linesItem != null && this.lines != null) {
      this.lines.remove(linesItem);
    }

    return this;
  }
  /**
   * Total of the order in cents, sum of the line totals.
   * minimum: 0
   **/
  public Order totalCents(Integer totalCents) {
    this.totalCents = totalCents;
    return this;
  }


  @JsonProperty(required = true, value = "totalCents")
  @NotNull  @Min(0)public Integer getTotalCents() {
    return totalCents;
  }

  @JsonProperty(required = true, value = "totalCents")
  public void setTotalCents(Integer totalCents) {
    this.totalCents = totalCents;
  }

  /**
   * ISO 4217 currency code.
   **/
  public Order currency(String currency) {
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
   * Non-guessable capability giving access to the tracking page and stream.
   **/
  public Order trackingToken(String trackingToken) {
    this.trackingToken = trackingToken;
    return this;
  }


  @JsonProperty(required = true, value = "trackingToken")
  @NotNull public String getTrackingToken() {
    return trackingToken;
  }

  @JsonProperty(required = true, value = "trackingToken")
  public void setTrackingToken(String trackingToken) {
    this.trackingToken = trackingToken;
  }

  /**
   * Creation timestamp, ISO 8601 UTC.
   **/
  public Order createdAt(OffsetDateTime createdAt) {
    this.createdAt = createdAt;
    return this;
  }


  @JsonProperty(required = true, value = "createdAt")
  @NotNull public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  @JsonProperty(required = true, value = "createdAt")
  public void setCreatedAt(OffsetDateTime createdAt) {
    this.createdAt = createdAt;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    Order order = (Order) o;
    return Objects.equals(this.id, order.id) &&
        Objects.equals(this.displayNumber, order.displayNumber) &&
        Objects.equals(this.status, order.status) &&
        Objects.equals(this.type, order.type) &&
        Objects.equals(this.tableLabel, order.tableLabel) &&
        Objects.equals(this.lines, order.lines) &&
        Objects.equals(this.totalCents, order.totalCents) &&
        Objects.equals(this.currency, order.currency) &&
        Objects.equals(this.trackingToken, order.trackingToken) &&
        Objects.equals(this.createdAt, order.createdAt);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, displayNumber, status, type, tableLabel, lines, totalCents, currency, trackingToken, createdAt);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class Order {\n");

    sb.append("    id: ").append(toIndentedString(id)).append("\n");
    sb.append("    displayNumber: ").append(toIndentedString(displayNumber)).append("\n");
    sb.append("    status: ").append(toIndentedString(status)).append("\n");
    sb.append("    type: ").append(toIndentedString(type)).append("\n");
    sb.append("    tableLabel: ").append(toIndentedString(tableLabel)).append("\n");
    sb.append("    lines: ").append(toIndentedString(lines)).append("\n");
    sb.append("    totalCents: ").append(toIndentedString(totalCents)).append("\n");
    sb.append("    currency: ").append(toIndentedString(currency)).append("\n");
    sb.append("    trackingToken: ").append(toIndentedString(trackingToken)).append("\n");
    sb.append("    createdAt: ").append(toIndentedString(createdAt)).append("\n");
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

