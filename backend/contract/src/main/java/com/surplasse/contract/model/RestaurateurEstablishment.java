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
 * An establishment accessible to the authenticated restaurateur.
 **/

@JsonTypeName("RestaurateurEstablishment")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class RestaurateurEstablishment   {
  private UUID id;
  private String name;
  private String slug;

  public RestaurateurEstablishment() {
  }

  @JsonCreator
  public RestaurateurEstablishment(
    @JsonProperty(required = true, value = "id") UUID id,
    @JsonProperty(required = true, value = "name") String name,
    @JsonProperty(required = true, value = "slug") String slug
  ) {
    this.id = id;
    this.name = name;
    this.slug = slug;
  }

  /**
   * Identifier used by authenticated Dashboard operations.
   **/
  public RestaurateurEstablishment id(UUID id) {
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
  public RestaurateurEstablishment name(String name) {
    this.name = name;
    return this;
  }

  
  @JsonProperty(required = true, value = "name")
  @NotNull  @Size(min=1)public String getName() {
    return name;
  }

  @JsonProperty(required = true, value = "name")
  public void setName(String name) {
    this.name = name;
  }

  /**
   * Subdomain label of the establishment mini-site.
   **/
  public RestaurateurEstablishment slug(String slug) {
    this.slug = slug;
    return this;
  }

  
  @JsonProperty(required = true, value = "slug")
  @NotNull  @Pattern(regexp="^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")public String getSlug() {
    return slug;
  }

  @JsonProperty(required = true, value = "slug")
  public void setSlug(String slug) {
    this.slug = slug;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    RestaurateurEstablishment restaurateurEstablishment = (RestaurateurEstablishment) o;
    return Objects.equals(this.id, restaurateurEstablishment.id) &&
        Objects.equals(this.name, restaurateurEstablishment.name) &&
        Objects.equals(this.slug, restaurateurEstablishment.slug);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, name, slug);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class RestaurateurEstablishment {\n");
    
    sb.append("    id: ").append(toIndentedString(id)).append("\n");
    sb.append("    name: ").append(toIndentedString(name)).append("\n");
    sb.append("    slug: ").append(toIndentedString(slug)).append("\n");
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

