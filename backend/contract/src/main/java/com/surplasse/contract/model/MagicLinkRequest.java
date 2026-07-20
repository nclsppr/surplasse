package com.surplasse.contract.model;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonTypeName;

/**
 * The restaurateur email that should receive a login link.
 **/

@JsonTypeName("MagicLinkRequest")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class MagicLinkRequest   {
  private String email;

  public MagicLinkRequest() {
  }

  @JsonCreator
  public MagicLinkRequest(
    @JsonProperty(required = true, value = "email") String email
  ) {
    this.email = email;
  }

  /**
   * Email normalized case-insensitively by the server.
   **/
  public MagicLinkRequest email(String email) {
    this.email = email;
    return this;
  }


  @JsonProperty(required = true, value = "email")
  @NotNull  @Size(min=3,max=320)public String getEmail() {
    return email;
  }

  @JsonProperty(required = true, value = "email")
  public void setEmail(String email) {
    this.email = email;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    MagicLinkRequest magicLinkRequest = (MagicLinkRequest) o;
    return Objects.equals(this.email, magicLinkRequest.email);
  }

  @Override
  public int hashCode() {
    return Objects.hash(email);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class MagicLinkRequest {\n");

    sb.append("    email: ").append(toIndentedString(email)).append("\n");
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
