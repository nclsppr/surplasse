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
 * Public profile of an establishment, rendered on its mini-site.
 **/

@JsonTypeName("EstablishmentPublic")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class EstablishmentPublic   {
  private UUID id;
  private String name;
  private String slug;
  private String address;
  private Boolean acceptingOrders;

  public EstablishmentPublic() {
  }

  @JsonCreator
  public EstablishmentPublic(
    @JsonProperty(required = true, value = "id") UUID id,
    @JsonProperty(required = true, value = "name") String name,
    @JsonProperty(required = true, value = "slug") String slug,
    @JsonProperty(required = true, value = "acceptingOrders") Boolean acceptingOrders
  ) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.acceptingOrders = acceptingOrders;
  }

  /**
   * Identifier of the establishment.
   **/
  public EstablishmentPublic id(UUID id) {
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
   * Display name of the establishment.
   **/
  public EstablishmentPublic name(String name) {
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
   * Slug of the establishment, label of its subdomain.
   **/
  public EstablishmentPublic slug(String slug) {
    this.slug = slug;
    return this;
  }


  @JsonProperty(required = true, value = "slug")
  @NotNull public String getSlug() {
    return slug;
  }

  @JsonProperty(required = true, value = "slug")
  public void setSlug(String slug) {
    this.slug = slug;
  }

  /**
   * Postal address, displayed on the mini-site. Absent when not provided.
   **/
  public EstablishmentPublic address(String address) {
    this.address = address;
    return this;
  }


  @JsonProperty("address")
  public String getAddress() {
    return address;
  }

  @JsonProperty("address")
  public void setAddress(String address) {
    this.address = address;
  }

  /**
   * Whether new table sessions, orders and payment sessions are currently accepted.
   **/
  public EstablishmentPublic acceptingOrders(Boolean acceptingOrders) {
    this.acceptingOrders = acceptingOrders;
    return this;
  }


  @JsonProperty(required = true, value = "acceptingOrders")
  @NotNull public Boolean getAcceptingOrders() {
    return acceptingOrders;
  }

  @JsonProperty(required = true, value = "acceptingOrders")
  public void setAcceptingOrders(Boolean acceptingOrders) {
    this.acceptingOrders = acceptingOrders;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    EstablishmentPublic establishmentPublic = (EstablishmentPublic) o;
    return Objects.equals(this.id, establishmentPublic.id) &&
        Objects.equals(this.name, establishmentPublic.name) &&
        Objects.equals(this.slug, establishmentPublic.slug) &&
        Objects.equals(this.address, establishmentPublic.address) &&
        Objects.equals(this.acceptingOrders, establishmentPublic.acceptingOrders);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, name, slug, address, acceptingOrders);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class EstablishmentPublic {\n");

    sb.append("    id: ").append(toIndentedString(id)).append("\n");
    sb.append("    name: ").append(toIndentedString(name)).append("\n");
    sb.append("    slug: ").append(toIndentedString(slug)).append("\n");
    sb.append("    address: ").append(toIndentedString(address)).append("\n");
    sb.append("    acceptingOrders: ").append(toIndentedString(acceptingOrders)).append("\n");
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

