import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "../features/auth/LoginPage";
import { MagicLinkPage } from "../features/auth/MagicLinkPage";
import { SessionGate } from "../features/auth/SessionGate";
import { ServicePage } from "../features/dashboard/ServicePage";
import { queryClient } from "./runtime";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="theme-light dashboard-root">
          <Routes>
            <Route path="/" element={<Navigate to="/service" replace />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/magic-link" element={<MagicLinkPage />} />
            <Route
              path="/service"
              element={
                <SessionGate>
                  {(session) => <ServicePage session={session} />}
                </SessionGate>
              }
            />
            <Route path="*" element={<Navigate to="/service" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
