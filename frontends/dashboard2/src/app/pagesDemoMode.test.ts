import { describe, expect, it, vi } from "vitest";

import type { DashboardClients } from "./clients";
import { createDashboardRuntimeClients } from "./pagesDemoMode";

describe("Pages demonstration isolation", () => {
  it("does not construct Backend clients and rejects every exposed operation", async () => {
    const createClients = vi.fn(() => ({} as DashboardClients));
    const clients = createDashboardRuntimeClients(true, createClients);

    expect(createClients).not.toHaveBeenCalled();
    const operations = [
      () => clients.identity.requestMagicLink("restaurant@example.com"),
      () => clients.identity.exchangeMagicLink("token"),
      () => clients.identity.getCurrentSession(),
      () => clients.identity.refreshSession(),
      () => clients.identity.logout(),
      () => clients.establishment.getOrderIntake("establishment"),
      () => clients.establishment.updateOrderIntake("establishment", "open"),
      () => clients.orders.listOrders("establishment"),
      () => clients.orders.updateStatus("order", "accepted"),
      () => clients.refunds.createRefund("order", "service_incident", "idempotency-key"),
    ];
    for (const operation of operations) {
      await expect(operation()).rejects.toThrow("Backend access is disabled");
    }
  });

  it("constructs and returns the real clients outside Pages", () => {
    const realClients = {} as DashboardClients;
    const createClients = vi.fn(() => realClients);

    expect(createDashboardRuntimeClients(false, createClients)).toBe(realClients);
    expect(createClients).toHaveBeenCalledOnce();
  });
});
