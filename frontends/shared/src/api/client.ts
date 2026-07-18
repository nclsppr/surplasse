import { CatalogApi, Configuration } from "./generated";

/**
 * Builds the typed catalog client for a given API base URL. The frontends
 * never call fetch outside the generated client (see conventions React).
 */
export function createCatalogApi(baseUrl: string): CatalogApi {
  return new CatalogApi(new Configuration({ basePath: baseUrl }));
}
