import { fr } from "../../i18n/fr";

export type CartCheckoutAvailability = "checking" | "open" | "paused" | "unknown";

type Props = {
  availability: CartCheckoutAvailability;
  hasSession: boolean;
  submitting: boolean;
  error?: string;
  onCheckout(): void;
};

export function CartCheckoutAction({
  availability,
  hasSession,
  submitting,
  error,
  onCheckout,
}: Props) {
  const paused = availability === "paused";
  const checking = availability === "checking";

  return (
    <>
      {paused && error === undefined && (
        <p
          id="cart-order-intake-status"
          className="mt-4 rounded-md border border-[var(--accent-hover)] bg-[var(--accent-tint)] p-3 text-sm text-[var(--structure)]"
          role="status"
        >
          {fr.cart.orderIntakePausedNotice}
        </p>
      )}
      {availability === "unknown" && (
        <p
          id="cart-order-intake-status"
          className="mt-4 rounded-md border border-[var(--line-2)] bg-[var(--surface-card)] p-3 text-sm text-[var(--text-muted)]"
          role="status"
        >
          {fr.cart.orderIntakeRefreshError}
        </p>
      )}

      {!hasSession ? (
        <p className="mt-4 rounded-md bg-[var(--accent-tint)] p-3 text-sm">{fr.cart.noSession}</p>
      ) : (
        <button
          type="button"
          disabled={submitting || paused || checking}
          aria-describedby={
            paused || availability === "unknown" ? "cart-order-intake-status" : undefined
          }
          aria-busy={checking || undefined}
          onClick={onCheckout}
          className="mt-4 min-h-12 w-full rounded-md bg-[var(--accent)] text-lg font-semibold text-[var(--on-accent)] disabled:opacity-50"
        >
          {checking
            ? fr.cart.checkingOrderIntake
            : paused
              ? fr.cart.checkoutPaused
              : fr.cart.checkout}
        </button>
      )}
      {error !== undefined && (
        <p
          id={paused ? "cart-order-intake-status" : undefined}
          className="mt-3 text-sm text-[var(--accent-hover)]"
          role="alert"
        >
          {error}
        </p>
      )}
    </>
  );
}
