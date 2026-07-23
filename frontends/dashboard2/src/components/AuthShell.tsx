import type { ReactNode } from "react";

import { fr } from "../i18n/fr";
import { Brand } from "./Brand";

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="auth-shell">
      <div className="auth-visual" aria-hidden="true">
        <div className="auth-visual-copy">
          <span>{fr.auth.visualCaption}</span>
        </div>
      </div>
      <div className="auth-layout">
        <div className="auth-brand-row">
          <Brand />
          <span className="experiment-label">{fr.auth.experiment}</span>
        </div>
        <section className="auth-card">{children}</section>
      </div>
    </main>
  );
}
