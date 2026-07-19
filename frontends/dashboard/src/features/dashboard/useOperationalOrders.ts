import { queryKeys } from "@surplasse/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { dashboardClients, sessionCoordinator } from "../../app/runtime";

const pageSize = 50;

export function useOperationalOrders(establishmentId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.orderList(establishmentId),
    queryFn: ({ pageParam }) =>
      sessionCoordinator.runProtected(() =>
        dashboardClients.orders.listOrders(establishmentId, pageParam, pageSize),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });
}
