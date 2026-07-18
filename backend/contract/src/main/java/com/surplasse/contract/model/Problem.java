package com.surplasse.contract.model;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonTypeName;

/**
 * RFC 9457 Problem Details document, the single error format of the API. The &#x60;type&#x60; URI is stable and identifies the applicative error. 
 **/

@JsonTypeName("Problem")
@jakarta.annotation.Generated(value = "org.openapitools.codegen.languages.JavaJAXRSSpecServerCodegen", comments = "Generator version: 7.15.0")
public class Problem   {
  private String type = "about:blank";
  private String title;
  private Integer status;
  private String detail;
  private String instance;

  public Problem() {
  }

  @JsonCreator
  public Problem(
    @JsonProperty(required = true, value = "title") String title,
    @JsonProperty(required = true, value = "status") Integer status
  ) {
    this.title = title;
    this.status = status;
  }

  /**
   * Stable URI identifying the applicative error type.
   **/
  public Problem type(String type) {
    this.type = type;
    return this;
  }

  
  @JsonProperty("type")
  public String getType() {
    return type;
  }

  @JsonProperty("type")
  public void setType(String type) {
    this.type = type;
  }

  /**
   * Short, human-readable summary of the error type.
   **/
  public Problem title(String title) {
    this.title = title;
    return this;
  }

  
  @JsonProperty(required = true, value = "title")
  @NotNull public String getTitle() {
    return title;
  }

  @JsonProperty(required = true, value = "title")
  public void setTitle(String title) {
    this.title = title;
  }

  /**
   * HTTP status code of this occurrence.
   * minimum: 100
   * maximum: 599
   **/
  public Problem status(Integer status) {
    this.status = status;
    return this;
  }

  
  @JsonProperty(required = true, value = "status")
  @NotNull  @Min(100) @Max(599)public Integer getStatus() {
    return status;
  }

  @JsonProperty(required = true, value = "status")
  public void setStatus(Integer status) {
    this.status = status;
  }

  /**
   * Human-readable explanation specific to this occurrence.
   **/
  public Problem detail(String detail) {
    this.detail = detail;
    return this;
  }

  
  @JsonProperty("detail")
  public String getDetail() {
    return detail;
  }

  @JsonProperty("detail")
  public void setDetail(String detail) {
    this.detail = detail;
  }

  /**
   * URI reference of the request that produced the error.
   **/
  public Problem instance(String instance) {
    this.instance = instance;
    return this;
  }

  
  @JsonProperty("instance")
  public String getInstance() {
    return instance;
  }

  @JsonProperty("instance")
  public void setInstance(String instance) {
    this.instance = instance;
  }


  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    Problem problem = (Problem) o;
    return Objects.equals(this.type, problem.type) &&
        Objects.equals(this.title, problem.title) &&
        Objects.equals(this.status, problem.status) &&
        Objects.equals(this.detail, problem.detail) &&
        Objects.equals(this.instance, problem.instance);
  }

  @Override
  public int hashCode() {
    return Objects.hash(type, title, status, detail, instance);
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append("class Problem {\n");
    
    sb.append("    type: ").append(toIndentedString(type)).append("\n");
    sb.append("    title: ").append(toIndentedString(title)).append("\n");
    sb.append("    status: ").append(toIndentedString(status)).append("\n");
    sb.append("    detail: ").append(toIndentedString(detail)).append("\n");
    sb.append("    instance: ").append(toIndentedString(instance)).append("\n");
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

