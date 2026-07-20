import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@surplasse/shared";

import { CartPage } from "../features/cart/CartPage";
import { MenuPage } from "../features/menu/MenuPage";
import { TrackingPage } from "../features/tracking/TrackingPage";
import { SessionLoading } from "../components/SessionLoading";
import { apiBaseUrl, establishmentSlug } from "./api";
import { bootstrapTableSession } from "./tableSession";

const queryClient = createQueryClient();

export function App() {
  // The scanned QR carries ?table={code}: exchanged once for the anonymous
  // session before anything renders order actions.
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    bootstrapTableSession(apiBaseUrl, establishmentSlug).finally(() => setSessionReady(true));
  }, []);

  if (!sessionReady) {
    return <SessionLoading />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MenuPage slug={establishmentSlug} />} />
          <Route path="/panier" element={<CartPage slug={establishmentSlug} />} />
          <Route path="/commandes/:orderId" element={<TrackingPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
