package com.surplasse.contract.model;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonTypeName;

/**
 * The context carried by a scanned table QR code.
 **/

@JsonTypeName("TableSessionRequest")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class TableSessionRequest   {
  private String establishmentSlug;
  private String tableCode;

  public TableSessionRequest() {
  }

  @JsonCreator
  public TableSessionRequest(
    @JsonProperty(required = true, value = "establishmentSlug") String establishmentSlug,
    @JsonProperty(required = true, value = "tableCode") String tableCode
  ) {
    this.establishmentSlug = establishmentSlug;
    this.tableCode = tableCode;
  }

  /**
   * Slug of the establishment, from the mini-site subdomain.
   **/
  public TableSessionRequest establishmentSlug(String establishmentSlug) {
    this.establishmentSlug = establishmentSlug;
    return this;
  }


  @JsonProperty(required = true, value = "establishmentSlug")
  @NotNull  @Pattern(regexp="^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")public String getEstablishmentSlug() {
    return establishmentSlug;
  }

  @JsonProperty(required = true, value = "establishmentSlug")
  public void setEstablishmentSlug(String establishmentSlug) {
    this.establishmentSlug = establishmentSlug;
  }

  /**
   * Non-guessable table code carried by the QR URL, never a sequential number.
   **/
  public TableSessionRequest tableCode(String tableCode) {
    this.tableCode = tableCode;
    return this;
  }


  @JsonProperty(required = true, value = "tableCode")
  @NotNull  @Size(min=1)public String getTableCode() {
    return tableCode;
  }

  @JsonProperty(required = true, value = "tableCode")
  public void setTableCode(String tableCode) {
    this.tableCode = tableCode;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    TableSessionRequest tableSessionRequest = (TableSessionRequest) o;
    return Objects.equals(this.establishmentSlug, tableSessionRequest.establishmentSlug) &&
        Objects.equals(this.tableCode, tableSessionRequest.tableCode);
  }

  @Override
  public int hashCode() {
    return Objects.hash(establishmentSlug, tableCode);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class TableSessionRequest {\n");

    sb.append("    establishmentSlug: ").append(toIndentedString(establishmentSlug)).append("\n");
    sb.append("    tableCode: ").append(toIndentedString(tableCode)).append("\n");
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

