import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatPriceCents } from "@surplasse/shared";
import { ResponseError } from "@surplasse/shared";
import { Button } from "@surplasse/design-system2";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";

import { orderApi } from "../../app/api";
import { storedTableSession } from "../../app/tableSession";
import { SiteHeader } from "../../components/SiteHeader";
import { fr } from "../../i18n/fr";
import { useEstablishment } from "../menu/hooks/useEstablishment";
import { isOrderIntakePausedProblem } from "../orderIntakeProblem";
import { CartCheckoutAction } from "./CartCheckoutAction";
import type { CartCheckoutAvailability } from "./CartCheckoutAction";
import { cartTotalCents, lineTotalCents, useCart } from "./hooks/useCart";

type Props = {
  slug: string;
};

/** The validated cart becomes an order here; the backend recomputes every amount. */
export function CartPage({ slug }: Props) {
  const { lines, removeLine, setQuantity, clear } = useCart();
  const establishment = useEstablishment(slug);
  const navigate = useNavigate();
  const session = storedTableSession();
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [intakeRejectedAt, setIntakeRejectedAt] = useState<number | undefined>();
  const intakeRejected =
    intakeRejectedAt !== undefined && intakeRejectedAt >= establishment.dataUpdatedAt;
  // One intention, one idempotency key: an unstable connection can never create two orders.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const checkoutAvailability: CartCheckoutAvailability = intakeRejected
    ? "paused"
    : establishment.data
      ? establishment.data.acceptingOrders
        ? "open"
        : "paused"
      : establishment.isPending
        ? "checking"
        : "unknown";

  const checkout = async () => {
    if (checkoutAvailability === "paused" || checkoutAvailability === "checking") {
      return;
    }
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
      if (await isOrderIntakePausedProblem(caught)) {
        setIntakeRejectedAt(Date.now());
        setError(fr.cart.orderIntakePaused);
        void establishment.refetch();
      } else if (caught instanceof ResponseError && caught.response.status === 409) {
        setError(fr.cart.adjust);
      } else {
        setError(fr.cart.error);
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="commande-page">
      <SiteHeader />
      <main className="state-page cart-page">
        <div className="page-heading">
          <Link to="/" className="back-link">
            <ArrowLeft aria-hidden="true" size={18} />
            {fr.cart.backToMenu}
          </Link>
          <h1>{fr.cart.title}</h1>
        </div>

        {lines.length === 0 ? (
          <div className="empty-state">
            <p>{fr.cart.empty}</p>
            <Link to="/" className="text-link">{fr.cart.backToMenu}</Link>
          </div>
        ) : (
          <ul className="cart-lines">
            {lines.map((line) => (
              <li key={line.lineId} className="cart-line">
                <div className="cart-line-heading">
                  <p>{line.productName}</p>
                  <p>{formatPriceCents(lineTotalCents(line), "EUR")}</p>
                </div>
                {line.options.length > 0 ? (
                  <p className="cart-line-meta">{line.options.map((option) => option.option).join(", ")}</p>
                ) : null}
                {line.note !== undefined ? <p className="cart-line-note">{line.note}</p> : null}
                <div className="quantity-row">
                  <Button
                    aria-label={fr.cart.decreaseQuantity(line.productName)}
                    className="quantity-button"
                    color="secondary"
                    size="sm"
                    onPress={() => setQuantity(line.lineId, line.quantity - 1)}
                  >
                    <Minus aria-hidden="true" size={18} />
                  </Button>
                  <span className="quantity-value">{line.quantity}</span>
                  <Button
                    aria-label={fr.cart.increaseQuantity(line.productName)}
                    className="quantity-button"
                    color="secondary"
                    size="sm"
                    onPress={() => setQuantity(line.lineId, line.quantity + 1)}
                  >
                    <Plus aria-hidden="true" size={18} />
                  </Button>
                  <Button
                    className="remove-button"
                    color="tertiary"
                    size="sm"
                    iconLeading={<Trash2 aria-hidden="true" />}
                    onPress={() => removeLine(line.lineId)}
                  >
                    {fr.cart.remove}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <section className="cart-summary" aria-label={fr.cart.total}>
            <div className="cart-total">
              <span>{fr.cart.total}</span>
              <span>{formatPriceCents(cartTotalCents(lines), "EUR")}</span>
            </div>

            <CartCheckoutAction
              availability={checkoutAvailability}
              hasSession={session !== undefined}
              submitting={submitting}
              error={error}
              onCheckout={() => void checkout()}
            />
          </section>
        )}

      </main>
    </div>
  );
}
