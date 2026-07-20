package com.surplasse.contract.model;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonTypeName;

/**
 * The opaque single-use token carried by the magic link.
 **/

@JsonTypeName("MagicLinkExchange")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class MagicLinkExchange   {
  private String token;

  public MagicLinkExchange() {
  }

  @JsonCreator
  public MagicLinkExchange(
    @JsonProperty(required = true, value = "token") String token
  ) {
    this.token = token;
  }

  /**
   * Opaque URL-safe token posted by the intermediate landing page.
   **/
  public MagicLinkExchange token(String token) {
    this.token = token;
    return this;
  }


  @JsonProperty(required = true, value = "token")
  @NotNull  @Pattern(regexp="^[A-Za-z0-9_-]+$") @Size(min=43,max=128)public String getToken() {
    return token;
  }

  @JsonProperty(required = true, value = "token")
  public void setToken(String token) {
    this.token = token;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    MagicLinkExchange magicLinkExchange = (MagicLinkExchange) o;
    return Objects.equals(this.token, magicLinkExchange.token);
  }

  @Override
  public int hashCode() {
    return Objects.hash(token);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class MagicLinkExchange {\n");

    sb.append("    token: ").append(toIndentedString(token)).append("\n");
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
