import { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { formatPriceCents } from "@surplasse/shared";
import type { Order, PaymentSession } from "@surplasse/shared";
import { ResponseError } from "@surplasse/shared";
import { Button } from "@surplasse/design-system2";
import { CreditCard } from "lucide-react";

import { paymentApi } from "../../app/api";
import { fr } from "../../i18n/fr";
import { isOrderIntakePausedProblem } from "../orderIntakeProblem";
import { PausedPaymentNotice } from "./PausedPaymentNotice";
import { loadStripeForConnectedAccount } from "./stripe";

type Props = {
  order: Order;
};

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

/**
 * Stripe payment of a pending order: the backend creates the PaymentIntent
 * with the recomputed amount, the Payment Element confirms it, and only the
 * signed webhook moves the order to paid (the tracking page then updates by
 * SSE, the browser return is informative only).
 */
export function PaymentSection({ order }: Props) {
  const [session, setSession] = useState<PaymentSession | undefined>();
  const [failure, setFailure] = useState<
    "paused" | "unavailable" | "session" | undefined
  >();
  const [attempt, setAttempt] = useState(0);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const connectedAccountId = session?.connectedAccountId;
  const stripePromise = useMemo(
    () =>
      publishableKey && connectedAccountId
        ? loadStripeForConnectedAccount(publishableKey, connectedAccountId)
        : undefined,
    [connectedAccountId],
  );

  useEffect(() => {
    let active = true;

    async function createPaymentSession() {
      try {
        const nextSession = await paymentApi.createPayment({
          idempotencyKey,
          paymentCreationRequest: { orderId: order.id },
        });
        if (active) {
          setSession(nextSession);
        }
      } catch (caught) {
        const paused = await isOrderIntakePausedProblem(caught);
        if (!active) {
          return;
        }
        const expired = caught instanceof ResponseError && caught.response.status === 401;
        setFailure(paused ? "paused" : expired ? "session" : "unavailable");
      }
    }

    void createPaymentSession();
    return () => {
      active = false;
    };
  }, [order.id, idempotencyKey, attempt]);

  function retryPaymentSession() {
    setFailure(undefined);
    setSession(undefined);
    setAttempt((current) => current + 1);
  }

  if (failure === "paused") {
    return <PausedPaymentNotice onRetry={retryPaymentSession} />;
  }
  if (failure === "session") {
    return (
      <p className="payment-error" role="alert">
        {fr.cart.noSession}
      </p>
    );
  }
  if (failure === "unavailable" || (session !== undefined && stripePromise === undefined)) {
    return (
      <p className="payment-error" role="alert">
        {fr.payment.notConfigured}
      </p>
    );
  }
  if (session === undefined || stripePromise === undefined) {
    return (
      <p className="payment-loading" role="status">
        {fr.payment.loading}
      </p>
    );
  }

  return (
    <section className="payment-section" aria-label={fr.payment.title}>
      <h2>{fr.payment.title}</h2>
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
    <div className="payment-form">
      <PaymentElement />
      <Button
        className="payment-button"
        size="lg"
        isDisabled={!stripe}
        isLoading={submitting}
        iconLeading={<CreditCard aria-hidden="true" />}
        onPress={() => void pay()}
      >
        {fr.payment.pay(amountLabel)}
      </Button>
      {failed && <p className="payment-failure" role="alert">{fr.payment.failed}</p>}
    </div>
  );
}
