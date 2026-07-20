import { loadStripe } from "@stripe/stripe-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadStripeForConnectedAccount } from "./stripe";

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(),
}));

describe("loadStripeForConnectedAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes Stripe.js in the exact account returned by the backend", () => {
    loadStripeForConnectedAccount("pk_test_example", "acct_test_restaurant");

    expect(loadStripe).toHaveBeenCalledWith("pk_test_example", {
      stripeAccount: "acct_test_restaurant",
    });
  });
});
