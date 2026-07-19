import type { DashboardOrder, DashboardOrderStatusEnum } from "@surplasse/shared";

import { fr } from "../../i18n/fr";
import { OrderCard } from "./OrderCard";

type OperationalStatus = DashboardOrderStatusEnum;

interface StatusColumn {
  status: OperationalStatus;
  title: string;
  description: string;
  empty: string;
}

const columns: ReadonlyArray<StatusColumn> = [
  { status: "paid", ...fr.service.columns.paid },
  { status: "accepted", ...fr.service.columns.accepted },
  { status: "preparing", ...fr.service.columns.preparing },
  { status: "ready", ...fr.service.columns.ready },
];

interface OrderBoardProps {
  establishmentId: string;
  orders: ReadonlyArray<DashboardOrder>;
}

export function OrderBoard({ establishmentId, orders }: OrderBoardProps) {
  return (
    <div className="order-board">
      {columns.map((column) => {
        const columnOrders = orders.filter((order) => order.status === column.status);
        return (
          <section className={`order-column order-column-${column.status}`} key={column.status}>
            <header className="order-column-header">
              <div>
                <h2>{column.title}</h2>
                <p>{column.description}</p>
              </div>
              <span className="order-column-count">{columnOrders.length}</span>
            </header>
            <div className="order-stack">
              {columnOrders.length > 0 ? (
                columnOrders.map((order) => (
                  <OrderCard establishmentId={establishmentId} key={order.id} order={order} />
                ))
              ) : (
                <div className="column-empty">
                  <p>{column.empty}</p>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
