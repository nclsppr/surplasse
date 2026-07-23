import {
  queryKeys,
  type OrderPage,
  type RefundCreationRequestReasonEnum,
} from "@surplasse/shared";
import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";

import { dashboardClients, sessionCoordinator } from "../../app/runtime";
import { removeOperationalOrder } from "./orderStatus";

interface RefundVariables {
  orderId: string;
  reason: RefundCreationRequestReasonEnum;
  idempotencyKey: string;
}

export function useRefundMutation(establishmentId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.orderList(establishmentId);

  return useMutation({
    mutationFn: ({ orderId, reason, idempotencyKey }: RefundVariables) =>
      sessionCoordinator.runProtected(() =>
        dashboardClients.refunds.createRefund(orderId, reason, idempotencyKey),
      ),
    onSuccess: (refund) => {
      if (refund.status === "succeeded") {
        queryClient.setQueryData<InfiniteData<OrderPage>>(queryKey, (current) =>
          removeOperationalOrder(current, refund.orderId),
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
