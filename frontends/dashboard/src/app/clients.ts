import {
  createIdentityApi,
  createRestaurateurOrderApi,
  type OrderPage,
  type OrderStatusResult,
  type OrderStatusUpdateStatusEnum,
  type RestaurateurSession,
} from "@surplasse/shared";

export interface IdentityClient {
  requestMagicLink(email: string): Promise<void>;
  exchangeMagicLink(token: string): Promise<RestaurateurSession>;
  getCurrentSession(): Promise<RestaurateurSession>;
  refreshSession(): Promise<RestaurateurSession>;
  logout(): Promise<void>;
}

export interface RestaurateurOrderClient {
  listOrders(establishmentId: string, cursor?: string, limit?: number): Promise<OrderPage>;
  updateStatus(orderId: string, status: OrderStatusUpdateStatusEnum): Promise<OrderStatusResult>;
}

export interface DashboardClients {
  identity: IdentityClient;
  orders: RestaurateurOrderClient;
}

export function createDashboardClients(baseUrl: string): DashboardClients {
  const identityApi = createIdentityApi(baseUrl);
  const orderApi = createRestaurateurOrderApi(baseUrl);

  return {
    identity: {
      requestMagicLink: (email) => identityApi.requestMagicLink({ magicLinkRequest: { email } }),
      exchangeMagicLink: (token) =>
        identityApi.createRestaurateurSession({ magicLinkExchange: { token } }),
      getCurrentSession: () => identityApi.getCurrentRestaurateurSession(),
      refreshSession: () => identityApi.refreshRestaurateurSession(),
      logout: () => identityApi.deleteCurrentRestaurateurSession(),
    },
    orders: {
      listOrders: (establishmentId, cursor, limit) =>
        orderApi.listOrders({ establishmentId, cursor, limit }),
      updateStatus: (orderId, status) =>
        orderApi.updateOrderStatus({ orderId, orderStatusUpdate: { status } }),
    },
  };
}
