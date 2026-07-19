import { CatalogApi, Configuration, IdentityApi, OrderApi, PaymentApi } from "./generated";

/**
 * Builds the typed clients. The frontends never call fetch outside the
 * generated clients (see conventions React); the anonymous table session
 * token feeds the X-Table-Session security scheme of the contract.
 */
export function createCatalogApi(baseUrl: string): CatalogApi {
  return new CatalogApi(new Configuration({ basePath: baseUrl }));
}

export function createOrderApi(baseUrl: string, tableSessionToken?: () => string | undefined): OrderApi {
  return new OrderApi(configurationWithSession(baseUrl, tableSessionToken));
}

export function createPaymentApi(baseUrl: string, tableSessionToken?: () => string | undefined): PaymentApi {
  return new PaymentApi(configurationWithSession(baseUrl, tableSessionToken));
}

export function createIdentityApi(baseUrl: string): IdentityApi {
  return new IdentityApi(configurationWithRestaurateurSession(baseUrl));
}

export function createRestaurateurOrderApi(baseUrl: string): OrderApi {
  return new OrderApi(configurationWithRestaurateurSession(baseUrl));
}

function configurationWithSession(baseUrl: string, tableSessionToken?: () => string | undefined): Configuration {
  return new Configuration({
    basePath: baseUrl,
    apiKey: tableSessionToken ? () => tableSessionToken() ?? "" : undefined,
  });
}

function configurationWithRestaurateurSession(baseUrl: string): Configuration {
  return new Configuration({ basePath: baseUrl, credentials: "include" });
}
