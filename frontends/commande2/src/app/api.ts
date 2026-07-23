import { createCatalogApi, createOrderApi, createPaymentApi } from "@surplasse/shared";

import { resolveEstablishmentSlug } from "./establishmentSlug";
import {
  type CatalogReadClient,
  pagesDemoCatalogApi,
  pagesDemoEstablishment,
} from "./pagesDemoCatalog";
import { createCustomerApiClients } from "./pagesDemoMode";
import { tableSessionToken } from "./tableSession";

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
export const pagesDemoEnabled = import.meta.env.VITE_UI2_PAGES_DEMO === "true";

const domainConfig = {
  baseDomain: import.meta.env.VITE_APP_BASE_DOMAIN,
  reservedSubdomains: import.meta.env.VITE_RESERVED_SUBDOMAINS,
};

function startupHostname(): string {
  if (!pagesDemoEnabled) {
    return window.location.hostname;
  }

  const configuredSlug = import.meta.env.VITE_UI2_PAGES_DEMO_SLUG;
  if (!configuredSlug || configuredSlug !== pagesDemoEstablishment.slug) {
    throw new Error("VITE_UI2_PAGES_DEMO_SLUG must select the explicit Pages fixture.");
  }
  return `${configuredSlug}.${domainConfig.baseDomain}`;
}

/** The typed clients, single entry point for every API call. */
export const catalogApi: CatalogReadClient = pagesDemoEnabled
  ? pagesDemoCatalogApi
  : createCatalogApi(apiBaseUrl);
const customerApiClients = createCustomerApiClients({
  pagesDemoEnabled,
  createOrderClient: () => createOrderApi(apiBaseUrl, tableSessionToken),
  createPaymentClient: () => createPaymentApi(apiBaseUrl, tableSessionToken),
});
export const { orderApi, paymentApi } = customerApiClients;

/** The establishment this mini-site serves, resolved once at startup. */
export const establishmentSlug = resolveEstablishmentSlug(
  startupHostname(),
  domainConfig,
);
