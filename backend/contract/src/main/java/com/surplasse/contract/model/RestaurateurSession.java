package com.surplasse.contract.model;

import com.surplasse.contract.model.RestaurateurEstablishment;
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
 * Minimal authenticated restaurateur view used to initialize the Dashboard. It contains no authorization token because credentials stay exclusively in HttpOnly cookies.
 **/

@JsonTypeName("RestaurateurSession")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class RestaurateurSession   {
  private UUID id;
  private String email;
  private String fullName;
  private @Valid List<@Valid RestaurateurEstablishment> establishments = new ArrayList<>();

  public RestaurateurSession() {
  }

  @JsonCreator
  public RestaurateurSession(
    @JsonProperty(required = true, value = "id") UUID id,
    @JsonProperty(required = true, value = "email") String email,
    @JsonProperty(required = true, value = "fullName") String fullName,
    @JsonProperty(required = true, value = "establishments") List<@Valid RestaurateurEstablishment> establishments
  ) {
    this.id = id;
    this.email = email;
    this.fullName = fullName;
    this.establishments = establishments;
  }

  /**
   * Identifier of the authenticated restaurateur.
   **/
  public RestaurateurSession id(UUID id) {
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
   * Restaurateur email used for magic-link authentication.
   **/
  public RestaurateurSession email(String email) {
    this.email = email;
    return this;
  }


  @JsonProperty(required = true, value = "email")
  @NotNull public String getEmail() {
    return email;
  }

  @JsonProperty(required = true, value = "email")
  public void setEmail(String email) {
    this.email = email;
  }

  /**
   * Name displayed in the Dashboard.
   **/
  public RestaurateurSession fullName(String fullName) {
    this.fullName = fullName;
    return this;
  }


  @JsonProperty(required = true, value = "fullName")
  @NotNull  @Size(min=1,max=200)public String getFullName() {
    return fullName;
  }

  @JsonProperty(required = true, value = "fullName")
  public void setFullName(String fullName) {
    this.fullName = fullName;
  }

  /**
   * Establishments this restaurateur can access, sorted by name then identifier.
   **/
  public RestaurateurSession establishments(List<@Valid RestaurateurEstablishment> establishments) {
    this.establishments = establishments;
    return this;
  }


  @JsonProperty(required = true, value = "establishments")
  @NotNull @Valid public List<@Valid RestaurateurEstablishment> getEstablishments() {
    return establishments;
  }

  @JsonProperty(required = true, value = "establishments")
  public void setEstablishments(List<@Valid RestaurateurEstablishment> establishments) {
    this.establishments = establishments;
  }

  public RestaurateurSession addEstablishmentsItem(RestaurateurEstablishment establishmentsItem) {
    if (this.establishments == null) {
      this.establishments = new ArrayList<>();
    }

    this.establishments.add(establishmentsItem);
    return this;
  }

  public RestaurateurSession removeEstablishmentsItem(RestaurateurEstablishment establishmentsItem) {
    if (establishmentsItem != null && this.establishments != null) {
      this.establishments.remove(establishmentsItem);
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
    RestaurateurSession restaurateurSession = (RestaurateurSession) o;
    return Objects.equals(this.id, restaurateurSession.id) &&
        Objects.equals(this.email, restaurateurSession.email) &&
        Objects.equals(this.fullName, restaurateurSession.fullName) &&
        Objects.equals(this.establishments, restaurateurSession.establishments);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, email, fullName, establishments);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class RestaurateurSession {\n");

    sb.append("    id: ").append(toIndentedString(id)).append("\n");
    sb.append("    email: ").append(toIndentedString(email)).append("\n");
    sb.append("    fullName: ").append(toIndentedString(fullName)).append("\n");
    sb.append("    establishments: ").append(toIndentedString(establishments)).append("\n");
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

