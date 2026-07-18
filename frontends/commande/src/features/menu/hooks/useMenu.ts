import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@surplasse/shared";

import { catalogApi } from "../../../app/api";

/** The published menu of the establishment, from the generated client. */
export function useMenu(slug: string) {
  return useQuery({
    queryKey: queryKeys.menu(slug),
    queryFn: () => catalogApi.getPublishedMenu({ slug }),
  });
}
