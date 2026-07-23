import type { DashboardClients } from "./clients";

const PAGES_DEMO_BACKEND_DISABLED =
  "Backend access is disabled in the static Pages demonstration.";

function rejectPagesDemoBackendAccess(): Promise<never> {
  return Promise.reject(new Error(PAGES_DEMO_BACKEND_DISABLED));
}

const blockedDashboardClients = Object.freeze({
  identity: Object.freeze({
    requestMagicLink: rejectPagesDemoBackendAccess,
    exchangeMagicLink: rejectPagesDemoBackendAccess,
    getCurrentSession: rejectPagesDemoBackendAccess,
    refreshSession: rejectPagesDemoBackendAccess,
    logout: rejectPagesDemoBackendAccess,
  }),
  establishment: Object.freeze({
    getOrderIntake: rejectPagesDemoBackendAccess,
    updateOrderIntake: rejectPagesDemoBackendAccess,
  }),
  orders: Object.freeze({
    listOrders: rejectPagesDemoBackendAccess,
    updateStatus: rejectPagesDemoBackendAccess,
  }),
  refunds: Object.freeze({
    createRefund: rejectPagesDemoBackendAccess,
  }),
}) satisfies DashboardClients;

export function createDashboardRuntimeClients(
  pagesDemoEnabled: boolean,
  createClients: () => DashboardClients,
): DashboardClients {
  return pagesDemoEnabled ? blockedDashboardClients : createClients();
}
