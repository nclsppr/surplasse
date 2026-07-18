import { useCallback, useSyncExternalStore } from "react";

/**
 * The cart is a purely client-side state, persisted locally so that a
 * network cut loses nothing (parcours client): it only becomes an order at
 * validation. Amounts kept here are display hints; the backend recomputes
 * everything from the catalog.
 */
export type CartOption = {
  optionId: string;
  group: string;
  option: string;
  extraCostCents: number;
};

export type CartLine = {
  lineId: string;
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  options: CartOption[];
  note?: string;
};

const STORAGE_KEY = "surplasse.cart";
const listeners = new Set<() => void>();
let snapshot: CartLine[] | undefined;

function readCart(): CartLine[] {
  if (snapshot === undefined) {
    const raw = localStorage.getItem(STORAGE_KEY);
    snapshot = raw ? (JSON.parse(raw) as CartLine[]) : [];
  }
  return snapshot;
}

function writeCart(lines: CartLine[]): void {
  snapshot = lines;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function lineTotalCents(line: CartLine): number {
  const extras = line.options.reduce((sum, option) => sum + option.extraCostCents, 0);
  return (line.unitPriceCents + extras) * line.quantity;
}

export function cartTotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
}

export function useCart() {
  const lines = useSyncExternalStore(subscribe, readCart);

  const addLine = useCallback((line: Omit<CartLine, "lineId">) => {
    writeCart([...readCart(), { ...line, lineId: crypto.randomUUID() }]);
  }, []);

  const removeLine = useCallback((lineId: string) => {
    writeCart(readCart().filter((line) => line.lineId !== lineId));
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    if (quantity < 1) {
      writeCart(readCart().filter((line) => line.lineId !== lineId));
      return;
    }
    writeCart(readCart().map((line) => (line.lineId === lineId ? { ...line, quantity } : line)));
  }, []);

  const clear = useCallback(() => writeCart([]), []);

  return { lines, addLine, removeLine, setQuantity, clear };
}
