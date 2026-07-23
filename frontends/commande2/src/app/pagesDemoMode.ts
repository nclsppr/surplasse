import type { OrderApi, PaymentApi } from "@surplasse/shared";

export type CustomerOrderClient = Pick<OrderApi, "createOrder" | "getOrder">;
export type CustomerPaymentClient = Pick<PaymentApi, "createPayment">;

type CustomerApiClientFactories = {
  pagesDemoEnabled: boolean;
  createOrderClient(): CustomerOrderClient;
  createPaymentClient(): CustomerPaymentClient;
};

const PAGES_DEMO_BACKEND_DISABLED =
  "Backend access is disabled in the static Pages demonstration.";

function rejectPagesDemoBackendAccess(): Promise<never> {
  return Promise.reject(new Error(PAGES_DEMO_BACKEND_DISABLED));
}

const blockedOrderClient = Object.freeze({
  createOrder: rejectPagesDemoBackendAccess,
  getOrder: rejectPagesDemoBackendAccess,
}) satisfies CustomerOrderClient;

const blockedPaymentClient = Object.freeze({
  createPayment: rejectPagesDemoBackendAccess,
}) satisfies CustomerPaymentClient;

export function createCustomerApiClients({
  pagesDemoEnabled,
  createOrderClient,
  createPaymentClient,
}: CustomerApiClientFactories): {
  orderApi: CustomerOrderClient;
  paymentApi: CustomerPaymentClient;
} {
  if (pagesDemoEnabled) {
    return {
      orderApi: blockedOrderClient,
      paymentApi: blockedPaymentClient,
    };
  }

  return {
    orderApi: createOrderClient(),
    paymentApi: createPaymentClient(),
  };
}

export async function runTableSessionBootstrap(
  pagesDemoEnabled: boolean,
  bootstrap: () => Promise<void>,
): Promise<void> {
  if (pagesDemoEnabled) {
    return;
  }
  await bootstrap();
}
