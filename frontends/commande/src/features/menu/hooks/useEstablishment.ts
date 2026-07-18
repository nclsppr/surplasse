import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@surplasse/shared";

import { catalogApi } from "../../../app/api";

/** The public profile of the establishment, from the generated client. */
export function useEstablishment(slug: string) {
  return useQuery({
    queryKey: queryKeys.establishment(slug),
    queryFn: () => catalogApi.getEstablishmentPublic({ slug }),
  });
}
