import { queryKeys, type OrderPage, type OrderStatusUpdateStatusEnum } from "@surplasse/shared";
import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";

import { dashboardClients, sessionCoordinator } from "../../app/runtime";
import { applyOrderStatusResult } from "./orderStatus";

interface OrderStatusVariables {
  orderId: string;
  status: OrderStatusUpdateStatusEnum;
}

export function useOrderStatusMutation(establishmentId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.orderList(establishmentId);

  return useMutation({
    mutationFn: ({ orderId, status }: OrderStatusVariables) =>
      sessionCoordinator.runProtected(() => dashboardClients.orders.updateStatus(orderId, status)),
    onSuccess: (result) => {
      queryClient.setQueryData<InfiniteData<OrderPage>>(queryKey, (current) =>
        applyOrderStatusResult(current, result),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
