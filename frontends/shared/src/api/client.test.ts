import { describe, expect, it } from "vitest";

import { Configuration, IdentityApi, OrderApi } from "./generated";
import { createIdentityApi, createRestaurateurOrderApi } from "./client";

function configurationOf(api: IdentityApi | OrderApi): Configuration {
  return (api as unknown as { configuration: Configuration }).configuration;
}

describe("restaurateur API clients", () => {
  it("creates an identity client that includes session cookies", () => {
    const api = createIdentityApi("https://api.example.test");
    const configuration = configurationOf(api);

    expect(api).toBeInstanceOf(IdentityApi);
    expect(configuration.basePath).toBe("https://api.example.test");
    expect(configuration.credentials).toBe("include");
  });

  it("creates an order client that includes session cookies", () => {
    const api = createRestaurateurOrderApi("https://api.example.test");
    const configuration = configurationOf(api);

    expect(api).toBeInstanceOf(OrderApi);
    expect(configuration.basePath).toBe("https://api.example.test");
    expect(configuration.credentials).toBe("include");
  });
});
