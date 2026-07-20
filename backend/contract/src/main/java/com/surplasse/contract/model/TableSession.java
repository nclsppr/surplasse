package com.surplasse.contract.model;

import java.time.OffsetDateTime;
import java.util.UUID;
import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonTypeName;

/**
 * An anonymous table session. The token is opaque (a server-side reference, not a JWT) and carries no personal data.
 **/

@JsonTypeName("TableSession")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class TableSession   {
  private String token;
  private UUID establishmentId;
  private String tableLabel;
  private OffsetDateTime expiresAt;

  public TableSession() {
  }

  @JsonCreator
  public TableSession(
    @JsonProperty(required = true, value = "token") String token,
    @JsonProperty(required = true, value = "establishmentId") UUID establishmentId,
    @JsonProperty(required = true, value = "tableLabel") String tableLabel,
    @JsonProperty(required = true, value = "expiresAt") OffsetDateTime expiresAt
  ) {
    this.token = token;
    this.establishmentId = establishmentId;
    this.tableLabel = tableLabel;
    this.expiresAt = expiresAt;
  }

  /**
   * Opaque session token, sent back in the X-Table-Session header.
   **/
  public TableSession token(String token) {
    this.token = token;
    return this;
  }


  @JsonProperty(required = true, value = "token")
  @NotNull public String getToken() {
    return token;
  }

  @JsonProperty(required = true, value = "token")
  public void setToken(String token) {
    this.token = token;
  }

  /**
   * Establishment the session is bound to.
   **/
  public TableSession establishmentId(UUID establishmentId) {
    this.establishmentId = establishmentId;
    return this;
  }


  @JsonProperty(required = true, value = "establishmentId")
  @NotNull public UUID getEstablishmentId() {
    return establishmentId;
  }

  @JsonProperty(required = true, value = "establishmentId")
  public void setEstablishmentId(UUID establishmentId) {
    this.establishmentId = establishmentId;
  }

  /**
   * Human label of the table, resolved server side from the scanned code.
   **/
  public TableSession tableLabel(String tableLabel) {
    this.tableLabel = tableLabel;
    return this;
  }


  @JsonProperty(required = true, value = "tableLabel")
  @NotNull public String getTableLabel() {
    return tableLabel;
  }

  @JsonProperty(required = true, value = "tableLabel")
  public void setTableLabel(String tableLabel) {
    this.tableLabel = tableLabel;
  }

  /**
   * Expiry of the session, sliding while the session is active.
   **/
  public TableSession expiresAt(OffsetDateTime expiresAt) {
    this.expiresAt = expiresAt;
    return this;
  }


  @JsonProperty(required = true, value = "expiresAt")
  @NotNull public OffsetDateTime getExpiresAt() {
    return expiresAt;
  }

  @JsonProperty(required = true, value = "expiresAt")
  public void setExpiresAt(OffsetDateTime expiresAt) {
    this.expiresAt = expiresAt;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    TableSession tableSession = (TableSession) o;
    return Objects.equals(this.token, tableSession.token) &&
        Objects.equals(this.establishmentId, tableSession.establishmentId) &&
        Objects.equals(this.tableLabel, tableSession.tableLabel) &&
        Objects.equals(this.expiresAt, tableSession.expiresAt);
  }

  @Override
  public int hashCode() {
    return Objects.hash(token, establishmentId, tableLabel, expiresAt);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class TableSession {\n");

    sb.append("    token: ").append(toIndentedString(token)).append("\n");
    sb.append("    establishmentId: ").append(toIndentedString(establishmentId)).append("\n");
    sb.append("    tableLabel: ").append(toIndentedString(tableLabel)).append("\n");
    sb.append("    expiresAt: ").append(toIndentedString(expiresAt)).append("\n");
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

