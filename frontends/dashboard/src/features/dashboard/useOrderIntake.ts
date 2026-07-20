import { queryKeys, type OrderIntakeStatus } from "@surplasse/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardClients, sessionCoordinator } from "../../app/runtime";
import { normalizeOrderIntakeUpdateError } from "./orderIntakeUpdateProblem";

export function useOrderIntake(establishmentId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.orderIntake(establishmentId);
  const state = useQuery({
    queryKey,
    queryFn: () =>
      sessionCoordinator.runProtected(() =>
        dashboardClients.establishment.getOrderIntake(establishmentId),
      ),
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  });
  const update = useMutation({
    mutationFn: async (status: OrderIntakeStatus) => {
      try {
        return await sessionCoordinator.runProtected(() =>
          dashboardClients.establishment.updateOrderIntake(establishmentId, status),
        );
      } catch (caught) {
        throw await normalizeOrderIntakeUpdateError(caught);
      }
    },
    onSuccess: (nextState) => {
      queryClient.setQueryData(queryKey, nextState);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { state, update };
}
