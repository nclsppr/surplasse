import { useMutation } from "@tanstack/react-query";
import type { RestaurateurSession } from "@surplasse/shared";
import { useNavigate } from "react-router-dom";

import { dashboardClients, sessionCoordinator } from "../../app/runtime";
import { Brand } from "../../components/Brand";
import { fr } from "../../i18n/fr";
import { OrderBoard } from "./OrderBoard";
import { useEstablishmentSelection } from "./useEstablishmentSelection";
import { useEstablishmentOrderEvents } from "./useEstablishmentOrderEvents";
import { useOperationalOrders } from "./useOperationalOrders";

interface ServicePageProps {
  session: RestaurateurSession;
}

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("fr-FR"))
    .join("");
}

export function ServicePage({ session }: ServicePageProps) {
  const navigate = useNavigate();
  const establishment = useEstablishmentSelection(session.establishments);
  const logout = useMutation({
    mutationFn: () => dashboardClients.identity.logout(),
    onSuccess: () => {
      sessionCoordinator.clearAuthenticatedState();
      navigate("/auth/login", { replace: true });
    },
  });

  return (
    <div className="service-shell">
      <header className="service-header">
        <Brand />
        <div className="account-area">
          <span className="avatar" aria-hidden="true">
            {initials(session.fullName)}
          </span>
          <div className="account-copy">
            <strong>{session.fullName}</strong>
            <span>{session.email}</span>
          </div>
          <button
            className="button button-ghost"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            {fr.service.logout}
          </button>
        </div>
      </header>

      {logout.isError ? (
        <div className="header-error" role="alert">
          {fr.service.logoutError}
        </div>
      ) : null}

      {establishment.selectedId ? (
        <OperationalService
          session={session}
          selectedId={establishment.selectedId}
          onSelect={establishment.select}
        />
      ) : (
        <main className="no-establishment">
          <h1>{fr.service.noEstablishmentTitle}</h1>
          <p>{fr.service.noEstablishmentDescription}</p>
        </main>
      )}
    </div>
  );
}

interface OperationalServiceProps {
  session: RestaurateurSession;
  selectedId: string;
  onSelect(establishmentId: string): void;
}

function OperationalService({ session, selectedId, onSelect }: OperationalServiceProps) {
  const orders = useOperationalOrders(selectedId);
  const liveStatus = useEstablishmentOrderEvents(selectedId);
  const allOrders = orders.data?.pages.flatMap((page) => page.items) ?? [];
  const updatedAt = orders.dataUpdatedAt
    ? timeFormatter.format(new Date(orders.dataUpdatedAt))
    : undefined;

  function retryOrders() {
    if (orders.isFetchNextPageError) {
      void orders.fetchNextPage();
      return;
    }
    void orders.refetch();
  }

  return (
    <main className="service-main">
      <section className="service-toolbar">
        <div className="service-title">
          <div className="title-line">
            <p className="eyebrow">{fr.service.eyebrow}</p>
          </div>
          <h1>{fr.service.title}</h1>
          <p className="service-count">{fr.service.orderCount(allOrders.length)}</p>
        </div>

        <div className="service-controls">
          {session.establishments.length > 1 ? (
            <label className="establishment-picker">
              <span>{fr.service.establishmentLabel}</span>
              <select value={selectedId} onChange={(event) => onSelect(event.target.value)}>
                {session.establishments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="single-establishment">
              <span>{fr.service.establishmentLabel}</span>
              <strong>{session.establishments[0]?.name}</strong>
            </div>
          )}
          <div className={`live-status live-status-${liveStatus}`} role="status">
            <span className="live-status-dot" aria-hidden="true" />
            <span>{fr.service.live[liveStatus]}</span>
          </div>
          <div className="refresh-control">
            <button
              className="button button-secondary"
              disabled={orders.isFetching}
              onClick={() => void orders.refetch()}
            >
              {orders.isFetching ? fr.service.refreshing : fr.service.refresh}
            </button>
            {updatedAt ? <small>{fr.service.updatedAt(updatedAt)}</small> : null}
          </div>
        </div>
      </section>

      {orders.isError && orders.data ? (
        <div className="board-warning" role="alert">
          <p>{fr.service.ordersStaleWarning}</p>
          <button
            className="button button-secondary"
            disabled={orders.isFetching}
            onClick={retryOrders}
          >
            {fr.common.retry}
          </button>
        </div>
      ) : null}

      {orders.isPending ? (
        <div className="board-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>{fr.service.loadingOrders}</p>
        </div>
      ) : orders.isError && !orders.data ? (
        <div className="board-error" role="alert">
          <div>
            <h2>{fr.service.ordersErrorTitle}</h2>
            <p>{fr.service.ordersErrorDescription}</p>
          </div>
          <button className="button button-secondary" onClick={() => void orders.refetch()}>
            {fr.common.retry}
          </button>
        </div>
      ) : (
        <>
          {allOrders.length === 0 ? <p className="board-empty">{fr.service.emptyBoard}</p> : null}
          <section className="order-board-scroll" aria-label={fr.service.boardLabel} tabIndex={0}>
            <OrderBoard establishmentId={selectedId} orders={allOrders} />
          </section>
          {orders.hasNextPage ? (
            <div className="load-more">
              <button
                className="button button-secondary"
                disabled={orders.isFetchingNextPage}
                onClick={() => void orders.fetchNextPage()}
              >
                {orders.isFetchingNextPage ? fr.service.loadingMore : fr.service.loadMore}
              </button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
