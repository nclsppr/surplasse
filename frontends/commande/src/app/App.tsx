import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@surplasse/shared";

import { MenuPage } from "../features/menu/MenuPage";
import { establishmentSlug } from "./api";

const queryClient = createQueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MenuPage slug={establishmentSlug} />
    </QueryClientProvider>
  );
}
