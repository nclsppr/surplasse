import { createOrderApi } from "@surplasse/shared";
import type { TableSession } from "@surplasse/shared";

/**
 * Anonymous table session of this browser tab. Obtained by exchanging the
 * table code of the scanned QR (?table=... in the mini-site URL), kept in
 * sessionStorage for the duration of the visit. Without a scanned table,
 * the customer can browse the menu but not order (phase 2: on-site only).
 */
const STORAGE_KEY = "surplasse.tableSession";

export type StoredTableSession = {
  token: string;
  tableLabel: string;
  expiresAt: string;
};

export function storedTableSession(): StoredTableSession | undefined {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return undefined;
  }
  const session = JSON.parse(raw) as StoredTableSession;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    sessionStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
  return session;
}

export function tableSessionToken(): string | undefined {
  return storedTableSession()?.token;
}

/** Exchanges the scanned table code for a session, then cleans the URL. */
export async function bootstrapTableSession(baseUrl: string, establishmentSlug: string): Promise<void> {
  const url = new URL(window.location.href);
  const tableCode = url.searchParams.get("table");
  if (!tableCode) {
    return;
  }
  const api = createOrderApi(baseUrl);
  const session: TableSession = await api.createTableSession({
    tableSessionRequest: { establishmentSlug, tableCode },
  });
  const stored: StoredTableSession = {
    token: session.token,
    tableLabel: session.tableLabel,
    expiresAt: session.expiresAt,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  url.searchParams.delete("table");
  window.history.replaceState(null, "", url.toString());
}
