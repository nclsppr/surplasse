import { describe, expect, it, vi } from "vitest";

import type { DashboardClients } from "./clients";
import { createDashboardRuntimeClients, pagesDemoSession } from "./pagesDemoMode";

describe("Pages demonstration isolation", () => {
  it("does not construct Backend clients and serves an in-memory operational fixture", async () => {
    const createClients = vi.fn(() => ({} as DashboardClients));
    const clients = createDashboardRuntimeClients(true, createClients);

    expect(createClients).not.toHaveBeenCalled();
    expect(pagesDemoSession.establishments).toEqual([
      expect.objectContaining({ id: "pages-demo-establishment", name: "Le Cormoran" }),
    ]);

    const identityOperations = [
      () => clients.identity.requestMagicLink("restaurant@example.com"),
      () => clients.identity.exchangeMagicLink("token"),
      () => clients.identity.getCurrentSession(),
      () => clients.identity.refreshSession(),
      () => clients.identity.logout(),
    ];
    for (const operation of identityOperations) {
      await expect(operation()).rejects.toThrow("Backend access is disabled");
    }

    const initialOrders = await clients.orders.listOrders("pages-demo-establishment");
    expect(initialOrders.items).toHaveLength(5);
    expect(initialOrders.items.map((order) => order.status)).toEqual([
      "paid",
      "paid",
      "accepted",
      "preparing",
      "ready",
    ]);

    await clients.orders.updateStatus("pages-demo-order-104", "accepted");
    expect(
      (await clients.orders.listOrders("pages-demo-establishment")).items.find(
        (order) => order.id === "pages-demo-order-104",
      )?.status,
    ).toBe("accepted");

    const paused = await clients.establishment.updateOrderIntake(
      "pages-demo-establishment",
      "paused",
    );
    expect(paused).toEqual(expect.objectContaining({ status: "paused", acceptingOrders: false }));
    expect(await clients.establishment.getOrderIntake("pages-demo-establishment")).toEqual(
      expect.objectContaining({ status: "paused", blockedReason: "paused" }),
    );

    const refund = await clients.refunds.createRefund(
      "pages-demo-order-105",
      "restaurant_refusal",
      "idempotency-key",
    );
    expect(refund).toEqual(
      expect.objectContaining({ orderId: "pages-demo-order-105", status: "succeeded" }),
    );
    expect(
      (await clients.orders.listOrders("pages-demo-establishment")).items.some(
        (order) => order.id === "pages-demo-order-105",
      ),
    ).toBe(false);
    await expect(clients.orders.updateStatus("unknown-order", "accepted")).rejects.toThrow(
      "does not exist",
    );
    await expect(clients.orders.listOrders("unknown-establishment")).rejects.toThrow(
      "does not exist",
    );
  });

  it("constructs and returns the real clients outside Pages", () => {
    const realClients = {} as DashboardClients;
    const createClients = vi.fn(() => realClients);

    expect(createDashboardRuntimeClients(false, createClients)).toBe(realClients);
    expect(createClients).toHaveBeenCalledOnce();
  });
});
