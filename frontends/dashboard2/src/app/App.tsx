import type { CSSProperties } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { servicePass960Url } from "@surplasse/design-system2/assets/service-pass-960";
import { tableSetting960Url } from "@surplasse/design-system2/assets/table-setting-960";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "../features/auth/LoginPage";
import { MagicLinkPage } from "../features/auth/MagicLinkPage";
import { SessionGate } from "../features/auth/SessionGate";
import { ServicePage } from "../features/dashboard/ServicePage";
import { pagesDemoSession } from "./pagesDemoMode";
import { pagesDemoEnabled, queryClient } from "./runtime";

const visualAssets = {
  "--dashboard2-service-pass": `url("${servicePass960Url}")`,
  "--dashboard2-table-setting": `url("${tableSetting960Url}")`,
} as CSSProperties;

export function App() {
  const servicePage = pagesDemoEnabled ? (
    <ServicePage pagesDemo session={pagesDemoSession} />
  ) : (
    <SessionGate>
      {(session) => <ServicePage session={session} />}
    </SessionGate>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div className="ui2-root dashboard-root" style={visualAssets}>
          <Routes>
            <Route path="/" element={<Navigate to="/service" replace />} />
            <Route
              path="/auth/login"
              element={pagesDemoEnabled ? <Navigate to="/service" replace /> : <LoginPage />}
            />
            <Route
              path="/auth/magic-link"
              element={pagesDemoEnabled ? <Navigate to="/service" replace /> : <MagicLinkPage />}
            />
            <Route path="/service" element={servicePage} />
            <Route path="*" element={<Navigate to="/service" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
