import { loadStripe } from "@stripe/stripe-js/pure";

/** Initializes Stripe.js in the same connected account used by the Backend. */
export function loadStripeForConnectedAccount(key: string, connectedAccountId: string) {
  return loadStripe(key, { stripeAccount: connectedAccountId });
}
