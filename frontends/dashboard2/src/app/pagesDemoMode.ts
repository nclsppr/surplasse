import type {
  DashboardOrder,
  OrderIntakeState,
  OrderStatusResult,
  Refund,
  RestaurateurSession,
} from "@surplasse/shared";

import type { DashboardClients } from "./clients";

const PAGES_DEMO_BACKEND_DISABLED =
  "Backend access is disabled in the static Pages demonstration.";
const PAGES_DEMO_ESTABLISHMENT_ID = "pages-demo-establishment";

function rejectPagesDemoBackendAccess(): Promise<never> {
  return Promise.reject(new Error(PAGES_DEMO_BACKEND_DISABLED));
}

function assertPagesDemoEstablishment(establishmentId: string): void {
  if (establishmentId !== PAGES_DEMO_ESTABLISHMENT_ID) {
    throw new Error("The demonstration establishment does not exist.");
  }
}

export const pagesDemoSession: RestaurateurSession = {
  id: "pages-demo-restaurateur",
  email: "demo@pages.invalid",
  fullName: "Camille Bernard",
  establishments: [
    {
      id: PAGES_DEMO_ESTABLISHMENT_ID,
      name: "Le Cormoran",
      slug: "le-cormoran",
    },
  ],
};

function createPagesDemoOrders(): DashboardOrder[] {
  return [
    {
      id: "pages-demo-order-104",
      displayNumber: "104",
      status: "paid",
      type: "on_site",
      tableLabel: "Table 4",
      lines: [
        {
          productId: "pages-demo-product-panisses",
          productName: "Panisses croustillantes",
          unitPriceCents: 650,
          quantity: 1,
          options: [],
          lineTotalCents: 650,
        },
        {
          productId: "pages-demo-product-loup",
          productName: "Loup grillé",
          unitPriceCents: 2200,
          quantity: 1,
          options: [],
          note: "Sans fenouil, merci",
          lineTotalCents: 2200,
        },
      ],
      totalCents: 2850,
      currency: "EUR",
      createdAt: "2026-07-23T17:42:00Z",
    },
    {
      id: "pages-demo-order-105",
      displayNumber: "105",
      status: "paid",
      type: "takeaway",
      lines: [
        {
          productId: "pages-demo-product-daube",
          productName: "Daube provençale",
          unitPriceCents: 1850,
          quantity: 2,
          options: [
            {
              group: "Accompagnement",
              option: "Pommes grenaille",
              extraCostCents: 0,
            },
          ],
          lineTotalCents: 3700,
        },
      ],
      totalCents: 3700,
      currency: "EUR",
      createdAt: "2026-07-23T17:44:00Z",
    },
    {
      id: "pages-demo-order-101",
      displayNumber: "101",
      status: "accepted",
      type: "on_site",
      tableLabel: "Table 8",
      lines: [
        {
          productId: "pages-demo-product-soupe",
          productName: "Soupe de poisson",
          unitPriceCents: 850,
          quantity: 3,
          options: [],
          lineTotalCents: 2550,
        },
      ],
      totalCents: 2550,
      currency: "EUR",
      createdAt: "2026-07-23T17:35:00Z",
    },
    {
      id: "pages-demo-order-098",
      displayNumber: "098",
      status: "preparing",
      type: "on_site",
      tableLabel: "Table 2",
      lines: [
        {
          productId: "pages-demo-product-daube",
          productName: "Daube provençale",
          unitPriceCents: 1850,
          quantity: 1,
          options: [
            {
              group: "Accompagnement",
              option: "Polenta crémeuse",
              extraCostCents: 0,
            },
          ],
          lineTotalCents: 1850,
        },
        {
          productId: "pages-demo-product-navettes",
          productName: "Navettes maison",
          unitPriceCents: 450,
          quantity: 2,
          options: [],
          lineTotalCents: 900,
        },
      ],
      totalCents: 2750,
      currency: "EUR",
      createdAt: "2026-07-23T17:26:00Z",
    },
    {
      id: "pages-demo-order-096",
      displayNumber: "096",
      status: "ready",
      type: "takeaway",
      lines: [
        {
          productId: "pages-demo-product-tarte",
          productName: "Tarte au citron",
          unitPriceCents: 700,
          quantity: 2,
          options: [],
          lineTotalCents: 1400,
        },
      ],
      totalCents: 1400,
      currency: "EUR",
      createdAt: "2026-07-23T17:18:00Z",
    },
  ];
}

function cloneOrder(order: DashboardOrder): DashboardOrder {
  return {
    ...order,
    lines: order.lines.map((line) => ({
      ...line,
      options: line.options.map((option) => ({ ...option })),
    })),
  };
}

function createPagesDemoDashboardClients(): DashboardClients {
  let orders = createPagesDemoOrders();
  let orderIntake: OrderIntakeState = {
    establishmentId: PAGES_DEMO_ESTABLISHMENT_ID,
    status: "open",
    acceptingOrders: true,
    updatedAt: "2026-07-23T17:00:00Z",
  };

  return {
    identity: {
      requestMagicLink: rejectPagesDemoBackendAccess,
      exchangeMagicLink: rejectPagesDemoBackendAccess,
      getCurrentSession: rejectPagesDemoBackendAccess,
      refreshSession: rejectPagesDemoBackendAccess,
      logout: rejectPagesDemoBackendAccess,
    },
    establishment: {
      getOrderIntake: async (establishmentId) => {
        assertPagesDemoEstablishment(establishmentId);
        return { ...orderIntake };
      },
      updateOrderIntake: async (establishmentId, status) => {
        assertPagesDemoEstablishment(establishmentId);
        orderIntake = {
          ...orderIntake,
          status,
          acceptingOrders: status === "open",
          blockedReason: status === "paused" ? "paused" : undefined,
          updatedAt: new Date().toISOString(),
        };
        return { ...orderIntake };
      },
    },
    orders: {
      listOrders: async (establishmentId) => {
        assertPagesDemoEstablishment(establishmentId);
        return {
          items: orders.map(cloneOrder),
          hasMore: false,
        };
      },
      updateStatus: async (orderId, status): Promise<OrderStatusResult> => {
        if (!orders.some((order) => order.id === orderId)) {
          throw new Error("The demonstration order does not exist.");
        }
        if (status === "served" || status === "picked_up") {
          orders = orders.filter((order) => order.id !== orderId);
        } else {
          orders = orders.map((order) =>
            order.id === orderId ? { ...order, status } : order,
          );
        }
        return { id: orderId, status };
      },
    },
    refunds: {
      createRefund: async (orderId, reason): Promise<Refund> => {
        const order = orders.find((candidate) => candidate.id === orderId);
        if (!order) {
          throw new Error("The demonstration order does not exist.");
        }
        orders = orders.filter((candidate) => candidate.id !== orderId);
        return {
          id: `pages-demo-refund-${orderId}`,
          orderId,
          amountCents: order.totalCents,
          applicationFeeRefundedCents: 0,
          currency: order.currency,
          reason,
          status: "succeeded",
        };
      },
    },
  };
}

export function createDashboardRuntimeClients(
  pagesDemoEnabled: boolean,
  createClients: () => DashboardClients,
): DashboardClients {
  return pagesDemoEnabled ? createPagesDemoDashboardClients() : createClients();
}
