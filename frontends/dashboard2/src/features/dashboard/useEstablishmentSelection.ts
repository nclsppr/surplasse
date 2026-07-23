import { useEffect } from "react";
import type { RestaurateurEstablishment } from "@surplasse/shared";
import { useSearchParams } from "react-router-dom";

import {
  canonicalEstablishmentSearch,
  chooseAuthorizedEstablishmentId,
  establishmentQueryParameter,
  establishmentStorageKey,
} from "./establishmentSelection";

function readStoredEstablishment(): string | null {
  try {
    return window.localStorage.getItem(establishmentStorageKey);
  } catch {
    return null;
  }
}

function persistEstablishment(establishmentId: string | null): void {
  try {
    if (establishmentId) {
      window.localStorage.setItem(establishmentStorageKey, establishmentId);
    } else {
      window.localStorage.removeItem(establishmentStorageKey);
    }
  } catch {
    // The URL remains the canonical source when storage is unavailable.
  }
}

export function useEstablishmentSelection(
  establishments: ReadonlyArray<RestaurateurEstablishment>,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = chooseAuthorizedEstablishmentId(
    establishments,
    searchParams.get(establishmentQueryParameter),
    readStoredEstablishment(),
  );

  useEffect(() => {
    const canonical = canonicalEstablishmentSearch(searchParams, selectedId);
    if (canonical.toString() !== searchParams.toString()) {
      setSearchParams(canonical, { replace: true });
    }
    persistEstablishment(selectedId);
  }, [searchParams, selectedId, setSearchParams]);

  function select(establishmentId: string) {
    const canonical = canonicalEstablishmentSearch(searchParams, establishmentId);
    persistEstablishment(establishmentId);
    setSearchParams(canonical);
  }

  return {
    selectedId,
    select,
  };
}
