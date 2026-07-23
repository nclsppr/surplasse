// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { OrderIntakeState } from "@surplasse/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderIntakeControl, OrderIntakeControlView } from "./OrderIntakeControl";
import {
  OrderIntakeUpdateProblem,
  type OrderIntakeUpdateProblemReason,
} from "./orderIntakeUpdateProblem";

const useOrderIntakeMock = vi.hoisted(() => vi.fn());

vi.mock("./useOrderIntake", () => ({
  useOrderIntake: useOrderIntakeMock,
}));

const openState: OrderIntakeState = {
  establishmentId: "establishment-id",
  status: "open",
  acceptingOrders: true,
  updatedAt: "2026-07-20T10:00:00Z",
};

const callbacks = {
  onRequestPause: vi.fn(),
  onConfirmPause: vi.fn(),
  onCancelPause: vi.fn(),
  onOpen: vi.fn(),
  onRetry: vi.fn(),
};

function hookResult(state: OrderIntakeState) {
  return {
    state: {
      data: state,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    },
    update: {
      error: null,
      isPending: false,
      isError: false,
      mutate: vi.fn(),
      reset: vi.fn(),
    },
  };
}

describe("OrderIntakeControlView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the open state visible with an explicit pause action", () => {
    const html = renderToStaticMarkup(
      <OrderIntakeControlView
        {...callbacks}
        state={openState}
        isLoading={false}
        loadError={false}
        updatePending={false}
        updateError={false}
        confirmingPause={false}
      />,
    );

    expect(html).toContain("Prise de commandes");
    expect(html).toContain("Ouverte");
    expect(html).toContain("Mettre en pause");
    expect(html).not.toContain("Confirmer la pause");
  });

  it("explains in-flight Stripe payments before confirming a pause", () => {
    const html = renderToStaticMarkup(
      <OrderIntakeControlView
        {...callbacks}
        state={openState}
        isLoading={false}
        loadError={false}
        updatePending={false}
        updateError={false}
        confirmingPause
      />,
    );

    expect(html).toContain("Confirmer la pause");
    expect(html).toContain("paiement Stripe est déjà lancé");
    expect(html).toContain("servir ou la rembourser");
    expect(html).toContain("Annuler");
  });

  it("distinguishes a payment configuration block from an operator pause", () => {
    const html = renderToStaticMarkup(
      <OrderIntakeControlView
        {...callbacks}
        state={{
          ...openState,
          acceptingOrders: false,
          blockedReason: "payments_unavailable",
        }}
        isLoading={false}
        loadError={false}
        updatePending={false}
        updateError={false}
        confirmingPause={false}
      />,
    );

    expect(html).toContain("Ouverte");
    expect(html).toContain("Disponibilité réelle");
    expect(html).toContain("Bloquée");
    expect(html).toContain("configuration Stripe");
    expect(html).toContain("Mettre en pause");
    expect(html).not.toContain("Rouvrir la prise de commandes");
  });

  it("still confirms an explicit pause when an open intake is effectively blocked", () => {
    const html = renderToStaticMarkup(
      <OrderIntakeControlView
        {...callbacks}
        state={{
          ...openState,
          acceptingOrders: false,
          blockedReason: "payments_unavailable",
        }}
        isLoading={false}
        loadError={false}
        updatePending={false}
        updateError={false}
        confirmingPause
      />,
    );

    expect(html).toContain("Confirmer la pause");
    expect(html).toContain("réouverture automatique");
    expect(html).toContain("paiement Stripe est déjà lancé");
  });

  it("explains when the published menu or active tables block intake", () => {
    const html = renderToStaticMarkup(
      <OrderIntakeControlView
        {...callbacks}
        state={{
          ...openState,
          acceptingOrders: false,
          blockedReason: "configuration_unavailable",
        }}
        isLoading={false}
        loadError={false}
        updatePending={false}
        updateError={false}
        confirmingPause={false}
      />,
    );

    expect(html).toContain("carte publiée");
    expect(html).toContain("table active");
  });

  it.each<[OrderIntakeUpdateProblemReason, string]>([
    ["establishment_not_active", "doit être actif"],
    ["configuration_unavailable", "activez au moins une table"],
    ["payments_unavailable", "Stripe Connect doit pouvoir accepter les paiements"],
    ["prerequisites_unavailable", "Vérifiez ces prérequis"],
  ])("explains the %s reopening rejection without exposing backend detail", (reason, copy) => {
    const html = renderToStaticMarkup(
      <OrderIntakeControlView
        {...callbacks}
        state={{ ...openState, status: "paused", acceptingOrders: false, blockedReason: "paused" }}
        isLoading={false}
        loadError={false}
        updatePending={false}
        updateError={new OrderIntakeUpdateProblem(reason)}
        confirmingPause={false}
      />,
    );

    expect(html).toContain(copy);
  });

  it("drops a stale confirmation and restores focus when another refresh closes intake", async () => {
    useOrderIntakeMock.mockReturnValue(hookResult(openState));
    const { rerender } = render(<OrderIntakeControl establishmentId="establishment-id" />);

    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" }));
    const confirmButton = screen.getByRole("button", { name: "Confirmer la pause" });
    await waitFor(() => expect(document.activeElement).toBe(confirmButton));

    useOrderIntakeMock.mockReturnValue(
      hookResult({
        ...openState,
        status: "paused",
        acceptingOrders: false,
        blockedReason: "paused",
      }),
    );
    rerender(<OrderIntakeControl establishmentId="establishment-id" />);

    const reopenButton = await screen.findByRole("button", {
      name: "Rouvrir la prise de commandes",
    });
    await waitFor(() => expect(document.activeElement).toBe(reopenButton));

    useOrderIntakeMock.mockReturnValue(hookResult(openState));
    rerender(<OrderIntakeControl establishmentId="establishment-id" />);

    expect(screen.queryByRole("button", { name: "Confirmer la pause" })).toBeNull();
  });
});
