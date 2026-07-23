import type { OrderApi, PaymentApi } from "@surplasse/shared";
import { describe, expect, it, vi } from "vitest";

import {
  createCustomerApiClients,
  runTableSessionBootstrap,
  type CustomerOrderClient,
  type CustomerPaymentClient,
} from "./pagesDemoMode";

function clientFixtures() {
  const orderClient = {} as CustomerOrderClient;
  const paymentClient = {} as CustomerPaymentClient;
  const createOrderClient = vi.fn(() => orderClient);
  const createPaymentClient = vi.fn(() => paymentClient);
  return { createOrderClient, createPaymentClient, orderClient, paymentClient };
}

describe("Pages demonstration isolation", () => {
  it("skips the table-session exchange", async () => {
    const bootstrap = vi.fn(async () => undefined);

    await runTableSessionBootstrap(true, bootstrap);

    expect(bootstrap).not.toHaveBeenCalled();
  });

  it("keeps the table-session exchange in an ordinary build", async () => {
    const bootstrap = vi.fn(async () => undefined);

    await runTableSessionBootstrap(false, bootstrap);

    expect(bootstrap).toHaveBeenCalledOnce();
  });

  it("does not construct Backend clients and rejects every exposed operation", async () => {
    const fixtures = clientFixtures();
    const clients = createCustomerApiClients({
      pagesDemoEnabled: true,
      createOrderClient: fixtures.createOrderClient,
      createPaymentClient: fixtures.createPaymentClient,
    });

    expect(fixtures.createOrderClient).not.toHaveBeenCalled();
    expect(fixtures.createPaymentClient).not.toHaveBeenCalled();
    await expect(
      clients.orderApi.createOrder({} as Parameters<OrderApi["createOrder"]>[0]),
    ).rejects.toThrow("Backend access is disabled");
    await expect(
      clients.orderApi.getOrder({} as Parameters<OrderApi["getOrder"]>[0]),
    ).rejects.toThrow("Backend access is disabled");
    await expect(
      clients.paymentApi.createPayment({} as Parameters<PaymentApi["createPayment"]>[0]),
    ).rejects.toThrow("Backend access is disabled");
  });

  it("constructs and returns the real clients outside Pages", () => {
    const fixtures = clientFixtures();
    const clients = createCustomerApiClients({
      pagesDemoEnabled: false,
      createOrderClient: fixtures.createOrderClient,
      createPaymentClient: fixtures.createPaymentClient,
    });

    expect(clients.orderApi).toBe(fixtures.orderClient);
    expect(clients.paymentApi).toBe(fixtures.paymentClient);
    expect(fixtures.createOrderClient).toHaveBeenCalledOnce();
    expect(fixtures.createPaymentClient).toHaveBeenCalledOnce();
  });
});
