import type { ReactNode } from "react";
import type { RestaurateurSession } from "@surplasse/shared";
import { Navigate, useLocation } from "react-router-dom";

import { Brand } from "../../components/Brand";
import { fr } from "../../i18n/fr";
import { useSession } from "./useSession";

interface SessionGateProps {
  children(session: RestaurateurSession): ReactNode;
}

export function SessionGate({ children }: SessionGateProps) {
  const location = useLocation();
  const session = useSession();

  if (session.isPending) {
    return (
      <main className="gate-shell">
        <Brand />
        <div className="gate-card" role="status">
          <span className="spinner" aria-hidden="true" />
          <h1>{fr.auth.sessionLoadingTitle}</h1>
          <p>{fr.auth.sessionLoadingDescription}</p>
        </div>
      </main>
    );
  }

  if (session.isError && !session.data) {
    return (
      <main className="gate-shell">
        <Brand />
        <div className="gate-card" role="alert">
          <h1>{fr.auth.sessionErrorTitle}</h1>
          <p>{fr.auth.sessionErrorDescription}</p>
          <button className="button button-secondary" onClick={() => void session.refetch()}>
            {fr.common.retry}
          </button>
        </div>
      </main>
    );
  }

  if (!session.data) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  return children(session.data);
}
