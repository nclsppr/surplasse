import { createCatalogApi } from "@surplasse/shared";

import { resolveEstablishmentSlug } from "./establishmentSlug";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

/** The typed catalog client, single entry point for every API call. */
export const catalogApi = createCatalogApi(baseUrl);

/** The establishment this mini-site serves, resolved once at startup. */
export const establishmentSlug = resolveEstablishmentSlug(
  window.location.hostname,
  import.meta.env.VITE_ESTABLISHMENT_SLUG,
);
