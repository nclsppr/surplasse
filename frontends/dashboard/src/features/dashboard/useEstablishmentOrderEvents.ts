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
): LiveConnectionStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveConnectionStatus>("connecting");

  useEffect(() => {
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
  }, [establishmentId, queryClient]);

  return status;
}
