import {
  createEstablishmentApi,
  createIdentityApi,
  createRestaurateurOrderApi,
  type OrderPage,
  type OrderIntakeState,
  type OrderIntakeStatus,
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

export interface EstablishmentClient {
  getOrderIntake(establishmentId: string): Promise<OrderIntakeState>;
  updateOrderIntake(
    establishmentId: string,
    status: OrderIntakeStatus,
  ): Promise<OrderIntakeState>;
}

export interface DashboardClients {
  identity: IdentityClient;
  establishment: EstablishmentClient;
  orders: RestaurateurOrderClient;
}

export function createDashboardClients(baseUrl: string): DashboardClients {
  const identityApi = createIdentityApi(baseUrl);
  const establishmentApi = createEstablishmentApi(baseUrl);
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
    establishment: {
      getOrderIntake: (establishmentId) =>
        establishmentApi.getOrderIntake({ establishmentId }),
      updateOrderIntake: (establishmentId, status) =>
        establishmentApi.updateOrderIntake({
          establishmentId,
          orderIntakeUpdate: { status },
        }),
    },
    orders: {
      listOrders: (establishmentId, cursor, limit) =>
        orderApi.listOrders({ establishmentId, cursor, limit }),
      updateStatus: (orderId, status) =>
        orderApi.updateOrderStatus({ orderId, orderStatusUpdate: { status } }),
    },
  };
}
