import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatPriceCents } from "@surplasse/shared";
import { ResponseError } from "@surplasse/shared";

import { orderApi } from "../../app/api";
import { storedTableSession } from "../../app/tableSession";
import { fr } from "../../i18n/fr";
import { cartTotalCents, lineTotalCents, useCart } from "./hooks/useCart";

/** The validated cart becomes an order here; the backend recomputes every amount. */
export function CartPage() {
  const { lines, removeLine, setQuantity, clear } = useCart();
  const navigate = useNavigate();
  const session = storedTableSession();
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  // One intention, one idempotency key: an unstable connection can never create two orders.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const checkout = async () => {
    setSubmitting(true);
    setError(undefined);
    try {
      const order = await orderApi.createOrder({
        idempotencyKey,
        orderCreationRequest: {
          type: "on_site",
          lines: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            optionIds: line.options.map((option) => option.optionId),
            note: line.note,
          })),
        },
      });
      clear();
      navigate(`/commandes/${order.id}?t=${order.trackingToken}&paiement=1`);
    } catch (caught) {
      if (caught instanceof ResponseError && caught.response.status === 409) {
        setError(fr.cart.adjust);
      } else {
        setError(fr.cart.error);
      }
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-6 text-2xl font-bold text-[var(--structure)]">{fr.cart.title}</h1>

      {lines.length === 0 ? (
        <p className="text-[var(--text-muted)]">{fr.cart.empty}</p>
      ) : (
        <ul className="space-y-3">
          {lines.map((line) => (
            <li key={line.lineId} className="rounded-lg border border-[var(--line-1)] bg-[var(--surface-card)] p-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-semibold">{line.productName}</p>
                <p className="shrink-0 font-semibold text-[var(--structure)]">
                  {formatPriceCents(lineTotalCents(line), "EUR")}
                </p>
              </div>
              {line.options.length > 0 && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {line.options.map((option) => option.option).join(", ")}
                </p>
              )}
              {line.note !== undefined && <p className="mt-1 text-xs italic text-[var(--text-muted)]">{line.note}</p>}
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  aria-label="-"
                  className="min-h-11 min-w-11 rounded-md border border-[var(--line-2)] font-bold"
                  onClick={() => setQuantity(line.lineId, line.quantity - 1)}
                >
                  -
                </button>
                <span className="min-w-6 text-center font-semibold">{line.quantity}</span>
                <button
                  type="button"
                  aria-label="+"
                  className="min-h-11 min-w-11 rounded-md border border-[var(--line-2)] font-bold"
                  onClick={() => setQuantity(line.lineId, line.quantity + 1)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="ml-auto min-h-11 px-3 text-sm text-[var(--text-muted)] underline"
                  onClick={() => removeLine(line.lineId)}
                >
                  {fr.cart.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {lines.length > 0 && (
        <div className="mt-6 border-t border-[var(--line-2)] pt-4">
          <div className="flex items-baseline justify-between text-lg font-bold">
            <span>{fr.cart.total}</span>
            <span className="text-[var(--structure)]">{formatPriceCents(cartTotalCents(lines), "EUR")}</span>
          </div>

          {session === undefined ? (
            <p className="mt-4 rounded-md bg-[var(--accent-tint)] p-3 text-sm">{fr.cart.noSession}</p>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void checkout()}
              className="mt-4 min-h-12 w-full rounded-md bg-[var(--accent)] text-lg font-semibold text-[var(--on-accent)] disabled:opacity-50"
            >
              {fr.cart.checkout}
            </button>
          )}
          {error !== undefined && <p className="mt-3 text-sm text-[var(--accent)]">{error}</p>}
        </div>
      )}

      <p className="mt-8">
        <Link to="/" className="text-sm text-[var(--structure)] underline">
          {fr.cart.backToMenu}
        </Link>
      </p>
    </main>
  );
}
