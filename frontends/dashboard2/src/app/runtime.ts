import { createQueryClient, queryKeys, type RestaurateurSession } from "@surplasse/shared";

import { SessionCoordinator } from "../features/auth/sessionCoordinator";
import { createBrowserSessionCoordination } from "../features/auth/sessionCoordination";
import { MagicLinkExchangeCoordinator } from "../features/auth/magicLinkExchange";
import { createDashboardClients } from "./clients";
import { createDashboardRuntimeClients } from "./pagesDemoMode";

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
export const pagesDemoEnabled = import.meta.env.VITE_UI2_PAGES_DEMO === "true";
export const dashboardClients = createDashboardRuntimeClients(
  pagesDemoEnabled,
  () => createDashboardClients(apiBaseUrl),
);
export const queryClient = createQueryClient();

const businessQueryRoots = new Set<string>([
  queryKeys.orderList("")[0],
  queryKeys.orderIntake("")[0],
]);

export const sessionCoordinator = new SessionCoordinator(
  dashboardClients.identity,
  {
    setSession(session: RestaurateurSession | null) {
      queryClient.setQueryData(queryKeys.session(), session);
    },
    clearBusinessQueries() {
      queryClient.removeQueries({
        predicate: (query) => businessQueryRoots.has(String(query.queryKey[0])),
      });
    },
  },
  createBrowserSessionCoordination(),
);

export const magicLinkExchangeCoordinator = new MagicLinkExchangeCoordinator(
  dashboardClients.identity,
);
