import { describe, expect, it } from "vitest";

import { Configuration, EstablishmentApi, IdentityApi, OrderApi, PaymentApi } from "./generated";
import {
  createEstablishmentApi,
  createIdentityApi,
  createRestaurateurPaymentApi,
  createRestaurateurOrderApi,
} from "./client";

function configurationOf(api: EstablishmentApi | IdentityApi | OrderApi | PaymentApi): Configuration {
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

  it("creates an establishment client that includes session cookies", () => {
    const api = createEstablishmentApi("https://api.example.test");
    const configuration = configurationOf(api);

    expect(api).toBeInstanceOf(EstablishmentApi);
    expect(configuration.basePath).toBe("https://api.example.test");
    expect(configuration.credentials).toBe("include");
  });

  it("creates a payment client that includes restaurateur session cookies", () => {
    const api = createRestaurateurPaymentApi("https://api.example.test");
    const configuration = configurationOf(api);

    expect(api).toBeInstanceOf(PaymentApi);
    expect(configuration.basePath).toBe("https://api.example.test");
    expect(configuration.credentials).toBe("include");
  });
});
