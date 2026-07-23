import { Badge, Button } from "@surplasse/design-system2";
import { ArrowRight } from "lucide-react";

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
          className="checkout-notice checkout-notice-warning"
          role="status"
        >
          <Badge tone="warning">{fr.menu.orderIntakeTitle}</Badge>
          <span>{fr.cart.orderIntakePausedNotice}</span>
        </p>
      )}
      {availability === "unknown" && (
        <p
          id="cart-order-intake-status"
          className="checkout-notice checkout-notice-neutral"
          role="status"
        >
          {fr.cart.orderIntakeRefreshError}
        </p>
      )}

      {!hasSession ? (
        <p className="checkout-notice checkout-notice-warning">{fr.cart.noSession}</p>
      ) : (
        <div className="checkout-action" aria-busy={checking || undefined}>
          <Button
            className="checkout-button"
            size="lg"
            isLoading={submitting}
            isDisabled={paused || checking}
            iconTrailing={<ArrowRight aria-hidden="true" />}
            aria-describedby={
              paused || availability === "unknown" ? "cart-order-intake-status" : undefined
            }
            onPress={onCheckout}
          >
            {checking
              ? fr.cart.checkingOrderIntake
              : paused
                ? fr.cart.checkoutPaused
                : fr.cart.checkout}
          </Button>
        </div>
      )}
      {error !== undefined && (
        <p
          id={paused ? "cart-order-intake-status" : undefined}
          className="checkout-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </>
  );
}
