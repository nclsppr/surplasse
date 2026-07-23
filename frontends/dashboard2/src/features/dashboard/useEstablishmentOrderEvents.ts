import { queryKeys } from "@surplasse/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  apiBaseUrl,
  dashboardClients,
  sessionCoordinator,
} from "../../app/runtime";
import {
  openEstablishmentOrderEvents,
  type LiveConnectionStatus,
} from "./establishmentOrderEvents";

export function useEstablishmentOrderEvents(
  establishmentId: string,
  pagesDemo = false,
): LiveConnectionStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveConnectionStatus>(
    pagesDemo ? "connected" : "connecting",
  );

  useEffect(() => {
    if (pagesDemo) {
      setStatus("connected");
      return;
    }
    setStatus("connecting");
    return openEstablishmentOrderEvents({
      baseUrl: apiBaseUrl,
      establishmentId,
      onStatus: setStatus,
      onResynchronize: () =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.orderList(establishmentId),
        }),
      onReconnect: () =>
        sessionCoordinator
          .runProtected(() => dashboardClients.identity.getCurrentSession())
          .then(() => undefined),
    });
  }, [establishmentId, pagesDemo, queryClient]);

  return status;
}
