// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DashboardOrder } from "@surplasse/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderCard } from "./OrderCard";

const refundMutate = vi.hoisted(() => vi.fn());
const refundReset = vi.hoisted(() => vi.fn());
const statusMutate = vi.hoisted(() => vi.fn());

vi.mock("./useRefundMutation", () => ({
  useRefundMutation: () => ({
    data: undefined,
    isError: false,
    isPending: false,
    mutate: refundMutate,
    reset: refundReset,
  }),
}));

vi.mock("./useOrderStatusMutation", () => ({
  useOrderStatusMutation: () => ({
    isError: false,
    isPending: false,
    mutate: statusMutate,
  }),
}));

const paidOrder: DashboardOrder = {
  id: "00000000-0000-4000-8000-000000000047",
  displayNumber: "47",
  status: "paid",
  type: "on_site",
  tableLabel: "Table 4",
  lines: [
    {
      productId: "product-id",
      productName: "Menu du marché",
      unitPriceCents: 3700,
      quantity: 1,
      options: [],
      lineTotalCents: 3700,
    },
  ],
  totalCents: 3700,
  currency: "EUR",
  createdAt: "2026-07-20T12:00:00Z",
};

describe("OrderCard refund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("confirms the exact total before refusing a newly paid order", () => {
    render(<OrderCard establishmentId="establishment-id" order={paidOrder} />);

    fireEvent.click(screen.getByRole("button", { name: "Refuser et rembourser la commande 47" }));

    expect(screen.getByRole("group", { name: /Rembourser 37,00.*€ \?/ })).toBeTruthy();
    expect(screen.getByText(/commission Surplasse.*restituée/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refuser et rembourser" }));

    expect(refundMutate).toHaveBeenCalledWith({
      orderId: paidOrder.id,
      reason: "restaurant_refusal",
      idempotencyKey: expect.any(String),
    });
  });

  it("requires an explicit incident reason after the order was accepted", () => {
    render(<OrderCard establishmentId="establishment-id" order={{ ...paidOrder, status: "accepted" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Rembourser la commande 47" }));
    fireEvent.change(screen.getByLabelText("Motif du remboursement"), {
      target: { value: "service_incident" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rembourser la commande" }));

    expect(refundMutate).toHaveBeenCalledWith({
      orderId: paidOrder.id,
      reason: "service_incident",
      idempotencyKey: expect.any(String),
    });
  });

  it("returns focus to the refund trigger when Escape closes the confirmation", () => {
    render(<OrderCard establishmentId="establishment-id" order={paidOrder} />);
    const trigger = screen.getByRole("button", { name: "Refuser et rembourser la commande 47" });

    fireEvent.click(trigger);

    const confirmation = screen.getByRole("group", { name: /Rembourser 37,00.*€ \?/ });
    expect(screen.getByRole("button", { name: "Refuser et rembourser" })).toBe(document.activeElement);
    fireEvent.keyDown(confirmation, { key: "Escape" });

    expect(screen.queryByRole("group", { name: /Rembourser 37,00.*€ \?/ })).toBeNull();
    expect(trigger).toBe(document.activeElement);
    expect(refundMutate).not.toHaveBeenCalled();
  });
});
