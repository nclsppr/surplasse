import type { RestaurateurEstablishment } from "@surplasse/shared";

export const establishmentQueryParameter = "establishment";
export const establishmentStorageKey = "surplasse.dashboard.establishment";

export function chooseAuthorizedEstablishmentId(
  establishments: ReadonlyArray<RestaurateurEstablishment>,
  queryId: string | null,
  storedId: string | null,
): string | null {
  const authorizedIds = new Set(establishments.map((establishment) => establishment.id));

  if (queryId && authorizedIds.has(queryId)) {
    return queryId;
  }
  if (storedId && authorizedIds.has(storedId)) {
    return storedId;
  }
  return establishments[0]?.id ?? null;
}

export function canonicalEstablishmentSearch(
  currentSearch: URLSearchParams,
  establishmentId: string | null,
): URLSearchParams {
  const canonical = new URLSearchParams(currentSearch);
  if (establishmentId) {
    canonical.set(establishmentQueryParameter, establishmentId);
  } else {
    canonical.delete(establishmentQueryParameter);
  }
  return canonical;
}
