import type {
  DashboardOrder,
  OrderPage,
  OrderStatusResult,
  OrderStatusUpdateStatusEnum,
} from "@surplasse/shared";
import type { InfiniteData } from "@tanstack/react-query";

function isTerminalStatus(status: OrderStatusResult["status"]): status is "served" | "picked_up" {
  return status === "served" || status === "picked_up";
}

export function nextOrderStatus(order: Pick<DashboardOrder, "status" | "type">): OrderStatusUpdateStatusEnum {
  switch (order.status) {
    case "paid":
      return "accepted";
    case "accepted":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      return order.type === "takeaway" ? "picked_up" : "served";
  }
}

export function applyOrderStatusResult(
  data: InfiniteData<OrderPage> | undefined,
  result: OrderStatusResult,
): InfiniteData<OrderPage> | undefined {
  if (!data) {
    return data;
  }

  const terminal = isTerminalStatus(result.status);
  const operationalStatus: DashboardOrder["status"] | undefined = isTerminalStatus(result.status)
    ? undefined
    : result.status;
  return {
    ...data,
    pages: data.pages.map((page) => {
      if (!page.items.some((order) => order.id === result.id)) {
        return page;
      }
      return {
        ...page,
        items: terminal
          ? page.items.filter((order) => order.id !== result.id)
          : page.items.map((order) =>
              order.id === result.id && operationalStatus
                ? { ...order, status: operationalStatus }
                : order,
            ),
      };
    }),
  };
}

export function removeOperationalOrder(
  data: InfiniteData<OrderPage> | undefined,
  orderId: string,
): InfiniteData<OrderPage> | undefined {
  if (!data) {
    return data;
  }
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((order) => order.id !== orderId),
    })),
  };
}
