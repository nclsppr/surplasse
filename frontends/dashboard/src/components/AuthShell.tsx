import type { ReactNode } from "react";

import { Brand } from "./Brand";

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="auth-shell">
      <div className="auth-layout">
        <Brand />
        <section className="auth-card">{children}</section>
      </div>
    </main>
  );
}
