import { createCatalogApi, createOrderApi, createPaymentApi } from "@surplasse/shared";

import { resolveEstablishmentSlug } from "./establishmentSlug";
import { tableSessionToken } from "./tableSession";

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

/** The typed clients, single entry point for every API call. */
export const catalogApi = createCatalogApi(apiBaseUrl);
export const orderApi = createOrderApi(apiBaseUrl, tableSessionToken);
export const paymentApi = createPaymentApi(apiBaseUrl, tableSessionToken);

/** The establishment this mini-site serves, resolved once at startup. */
export const establishmentSlug = resolveEstablishmentSlug(
  window.location.hostname,
  import.meta.env.VITE_ESTABLISHMENT_SLUG,
);
