import { useEffect, useState } from "react";
import { queryKeys, type RestaurateurSession } from "@surplasse/shared";
import { Link, useNavigate } from "react-router-dom";

import { magicLinkExchangeCoordinator, queryClient } from "../../app/runtime";
import { AuthShell } from "../../components/AuthShell";
import { fr } from "../../i18n/fr";

type ExchangeState = "pending" | "missing" | "error";

export function MagicLinkPage() {
  const navigate = useNavigate();
  const [exchange] = useState(() =>
    magicLinkExchangeCoordinator.begin(window.location.href, (cleanUrl) => {
      window.history.replaceState(window.history.state, "", cleanUrl);
    }),
  );
  const [state, setState] = useState<ExchangeState>(exchange ? "pending" : "missing");

  useEffect(() => {
    if (!exchange) {
      return;
    }

    let active = true;
    exchange
      .then((session: RestaurateurSession) => {
        if (!active) {
          return;
        }
        queryClient.setQueryData(queryKeys.session(), session);
        navigate("/service", { replace: true });
      })
      .catch(() => {
        if (active) {
          setState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [exchange, navigate]);

  return (
    <AuthShell>
      <p className="eyebrow">{fr.auth.eyebrow}</p>
      <h1>{fr.auth.exchangeTitle}</h1>
      {state === "pending" ? (
        <div className="exchange-state" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>{fr.auth.exchangePending}</p>
        </div>
      ) : (
        <div className="exchange-state exchange-error" role="alert">
          <p>{state === "missing" ? fr.auth.exchangeMissing : fr.auth.exchangeError}</p>
          <Link className="button button-secondary" to="/auth/login">
            {fr.auth.backToLogin}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
