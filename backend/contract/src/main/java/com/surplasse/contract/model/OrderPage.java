package com.surplasse.contract.model;

import com.surplasse.contract.model.DashboardOrder;
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
 * One cursor-paginated page of operational orders, newest first. nextCursor is present exactly when hasMore is true.
 **/

@JsonTypeName("OrderPage")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class OrderPage   {
  private @Valid List<@Valid DashboardOrder> items = new ArrayList<>();
  private String nextCursor;
  private Boolean hasMore;

  public OrderPage() {
  }

  @JsonCreator
  public OrderPage(
    @JsonProperty(required = true, value = "items") List<@Valid DashboardOrder> items,
    @JsonProperty(required = true, value = "hasMore") Boolean hasMore
  ) {
    this.items = items;
    this.hasMore = hasMore;
  }

  /**
   * Operational orders in this page.
   **/
  public OrderPage items(List<@Valid DashboardOrder> items) {
    this.items = items;
    return this;
  }


  @JsonProperty(required = true, value = "items")
  @NotNull @Valid public List<@Valid DashboardOrder> getItems() {
    return items;
  }

  @JsonProperty(required = true, value = "items")
  public void setItems(List<@Valid DashboardOrder> items) {
    this.items = items;
  }

  public OrderPage addItemsItem(DashboardOrder itemsItem) {
    if (this.items == null) {
      this.items = new ArrayList<>();
    }

    this.items.add(itemsItem);
    return this;
  }

  public OrderPage removeItemsItem(DashboardOrder itemsItem) {
    if (itemsItem != null && this.items != null) {
      this.items.remove(itemsItem);
    }

    return this;
  }
  /**
   * Opaque cursor to request the following page.
   **/
  public OrderPage nextCursor(String nextCursor) {
    this.nextCursor = nextCursor;
    return this;
  }


  @JsonProperty("nextCursor")
   @Size(min=1,max=512)public String getNextCursor() {
    return nextCursor;
  }

  @JsonProperty("nextCursor")
  public void setNextCursor(String nextCursor) {
    this.nextCursor = nextCursor;
  }

  /**
   * Whether another page exists.
   **/
  public OrderPage hasMore(Boolean hasMore) {
    this.hasMore = hasMore;
    return this;
  }


  @JsonProperty(required = true, value = "hasMore")
  @NotNull public Boolean getHasMore() {
    return hasMore;
  }

  @JsonProperty(required = true, value = "hasMore")
  public void setHasMore(Boolean hasMore) {
    this.hasMore = hasMore;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    OrderPage orderPage = (OrderPage) o;
    return Objects.equals(this.items, orderPage.items) &&
        Objects.equals(this.nextCursor, orderPage.nextCursor) &&
        Objects.equals(this.hasMore, orderPage.hasMore);
  }

  @Override
  public int hashCode() {
    return Objects.hash(items, nextCursor, hasMore);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class OrderPage {\n");

    sb.append("    items: ").append(toIndentedString(items)).append("\n");
    sb.append("    nextCursor: ").append(toIndentedString(nextCursor)).append("\n");
    sb.append("    hasMore: ").append(toIndentedString(hasMore)).append("\n");
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
