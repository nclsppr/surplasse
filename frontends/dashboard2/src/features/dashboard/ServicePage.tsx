import { useMutation } from "@tanstack/react-query";
import type { RestaurateurSession } from "@surplasse/shared";
import {
  Badge,
  Button,
  Status,
  initials,
} from "@surplasse/design-system2";
import {
  servicePass1600Url,
} from "@surplasse/design-system2/assets/service-pass-1600";
import {
  servicePass960Url,
} from "@surplasse/design-system2/assets/service-pass-960";
import { ClipboardList, LogOut, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { dashboardClients, sessionCoordinator } from "../../app/runtime";
import { Brand } from "../../components/Brand";
import { fr } from "../../i18n/fr";
import { OrderBoard } from "./OrderBoard";
import { OrderIntakeControl } from "./OrderIntakeControl";
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
      <aside className="service-rail">
        <div className="rail-brand">
          <Brand compact />
          <span className="rail-version" aria-label={fr.service.experiment}>2</span>
        </div>
        <nav aria-label={fr.service.navigationLabel}>
          <span className="rail-link rail-link-current" aria-current="page">
            <ClipboardList aria-hidden="true" />
            <span>{fr.service.navigationService}</span>
          </span>
        </nav>
        <span className="rail-avatar" aria-hidden="true">
          {initials(session.fullName)}
        </span>
      </aside>

      <div className="service-workspace">
        <header className="service-header">
          <div className="service-mobile-brand">
            <Brand />
          </div>
          <Badge tone="brand">{fr.service.experiment}</Badge>
          <div className="account-area">
            <span className="avatar" aria-hidden="true">
              {initials(session.fullName)}
            </span>
            <div className="account-copy">
              <strong>{session.fullName}</strong>
              <span>{session.email}</span>
            </div>
            <Button
              aria-label={fr.service.logout}
              color="tertiary"
              iconLeading={<LogOut aria-hidden="true" />}
              isDisabled={logout.isPending}
              onPress={() => logout.mutate()}
              size="sm"
            >
              <span className="logout-label">{fr.service.logout}</span>
            </Button>
          </div>
        </header>

        {logout.isError ? (
          <div className="header-error" role="alert">
            {fr.service.logoutError}
          </div>
        ) : null}

        {session.establishments.length > 0 ? (
          <section className="service-portrait" aria-label={fr.service.photoCaption}>
            <picture aria-hidden="true">
              <source media="(max-width: 900px)" srcSet={servicePass960Url} />
              <img src={servicePass1600Url} alt="" width="1600" height="901" />
            </picture>
            <p>{fr.service.photoCaption}</p>
          </section>
        ) : null}

        {session.establishments.length > 0 && establishment.selectedId ? (
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
  const statusState =
    liveStatus === "connected"
      ? "connected"
      : liveStatus === "connecting" || liveStatus === "reconnecting"
        ? "connecting"
        : "disconnected";

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
          <Status state={statusState}>{fr.service.live[liveStatus]}</Status>
          <div className="refresh-control">
            <Button
              color="secondary"
              iconLeading={<RefreshCw aria-hidden="true" />}
              isDisabled={orders.isFetching}
              isLoading={orders.isFetching}
              onPress={() => void orders.refetch()}
              size="sm"
            >
              {orders.isFetching ? fr.service.refreshing : fr.service.refresh}
            </Button>
            {updatedAt ? <small>{fr.service.updatedAt(updatedAt)}</small> : null}
          </div>
        </div>
      </section>

      <OrderIntakeControl key={selectedId} establishmentId={selectedId} />

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
          <section className="order-board-region" aria-label={fr.service.boardLabel}>
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
