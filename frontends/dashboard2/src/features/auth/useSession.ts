import { queryKeys, type RestaurateurSession } from "@surplasse/shared";
import { useQuery } from "@tanstack/react-query";

import { dashboardClients, sessionCoordinator } from "../../app/runtime";
import { isUnauthorized } from "./httpError";

export function useSession() {
  return useQuery<RestaurateurSession | null>({
    queryKey: queryKeys.session(),
    queryFn: async () => {
      try {
        return await sessionCoordinator.runProtected(() =>
          dashboardClients.identity.getCurrentSession(),
        );
      } catch (error) {
        if (isUnauthorized(error)) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
