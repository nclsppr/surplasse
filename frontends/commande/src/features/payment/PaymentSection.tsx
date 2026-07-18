import { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { formatPriceCents } from "@surplasse/shared";
import type { Order, PaymentSession } from "@surplasse/shared";
import { ResponseError } from "@surplasse/shared";

import { paymentApi } from "../../app/api";
import { fr } from "../../i18n/fr";

type Props = {
  order: Order;
};

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : undefined;

/**
 * Stripe payment of a pending order: the backend creates the PaymentIntent
 * with the recomputed amount, the Payment Element confirms it, and only the
 * signed webhook moves the order to paid (the tracking page then updates by
 * SSE, the browser return is informative only).
 */
export function PaymentSection({ order }: Props) {
  const [session, setSession] = useState<PaymentSession | undefined>();
  const [failure, setFailure] = useState<"unavailable" | "session" | undefined>();
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    paymentApi
      .createPayment({ idempotencyKey, paymentCreationRequest: { orderId: order.id } })
      .then(setSession)
      .catch((caught: unknown) => {
        const expired = caught instanceof ResponseError && caught.response.status === 401;
        setFailure(expired ? "session" : "unavailable");
      });
  }, [order.id, idempotencyKey]);

  if (failure === "session") {
    return <p className="mt-8 rounded-md bg-[var(--accent-tint)] p-4 text-sm">{fr.cart.noSession}</p>;
  }
  if (failure === "unavailable" || (session !== undefined && stripePromise === undefined)) {
    return <p className="mt-8 rounded-md bg-[var(--accent-tint)] p-4 text-sm">{fr.payment.notConfigured}</p>;
  }
  if (session === undefined || stripePromise === undefined) {
    return <p className="mt-8 text-sm text-[var(--text-muted)]">{fr.payment.loading}</p>;
  }

  return (
    <section className="mt-8" aria-label={fr.payment.title}>
      <h2 className="mb-3 text-lg font-bold">{fr.payment.title}</h2>
      <Elements stripe={stripePromise} options={{ clientSecret: session.clientSecret }}>
        <PaymentForm amountLabel={formatPriceCents(session.amountCents, session.currency)} />
      </Elements>
    </section>
  );
}

function PaymentForm({ amountLabel }: { amountLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pay = async () => {
    if (!stripe || !elements) {
      return;
    }
    setSubmitting(true);
    setFailed(false);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (result.error) {
      setFailed(true);
      setSubmitting(false);
    }
    // On success the webhook flips the order to paid; the SSE stream
    // updates the page without any reload.
  };

  return (
    <div>
      <PaymentElement />
      <button
        type="button"
        disabled={!stripe || submitting}
        onClick={() => void pay()}
        className="mt-4 min-h-12 w-full rounded-md bg-[var(--accent)] text-lg font-semibold text-[var(--on-accent)] disabled:opacity-50"
      >
        {fr.payment.pay(amountLabel)}
      </button>
      {failed && <p className="mt-3 text-sm text-[var(--accent)]">{fr.payment.failed}</p>}
    </div>
  );
}
