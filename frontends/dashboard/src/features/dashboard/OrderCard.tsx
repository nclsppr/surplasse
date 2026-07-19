import { formatPriceCents, type DashboardOrder } from "@surplasse/shared";

import { fr } from "../../i18n/fr";
import { nextOrderStatus } from "./orderStatus";
import { useOrderStatusMutation } from "./useOrderStatusMutation";

interface OrderCardProps {
  establishmentId: string;
  order: DashboardOrder;
}

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function OrderCard({ establishmentId, order }: OrderCardProps) {
  const statusMutation = useOrderStatusMutation(establishmentId);
  const nextStatus = nextOrderStatus(order);
  const action = fr.service.actions[nextStatus];
  const createdTime = timeFormatter.format(new Date(order.createdAt));
  const location = order.tableLabel
    ? order.tableLabel
    : order.type === "takeaway"
      ? fr.service.takeaway
      : fr.service.onSite;

  return (
    <article className={`order-card order-card-${order.status}`}>
      <header className="order-card-header">
        <div>
          <span className="order-number">{fr.service.orderNumber(order.displayNumber)}</span>
          <strong>{location}</strong>
        </div>
        <time dateTime={order.createdAt}>{fr.service.createdAt(createdTime)}</time>
      </header>

      <ul className="order-lines">
        {order.lines.map((line, index) => (
          <li key={`${line.productId}-${index}`}>
            <div className="order-line-main">
              <span className="quantity">{fr.service.quantity(line.quantity)}</span>
              <span>{line.productName}</span>
            </div>
            {line.options.length > 0 ? (
              <small>{fr.service.options(line.options.map((option) => option.option).join(", "))}</small>
            ) : null}
            {line.note ? <small className="order-note">{fr.service.note(line.note)}</small> : null}
          </li>
        ))}
      </ul>

      <footer className="order-card-footer">
        <span>{order.type === "takeaway" ? fr.service.takeaway : fr.service.onSite}</span>
        <strong>{formatPriceCents(order.totalCents, order.currency)}</strong>
      </footer>

      <div className="order-card-action-area">
        <button
          aria-label={fr.service.actions.label(action, order.displayNumber)}
          className="button button-primary order-card-action"
          disabled={statusMutation.isPending}
          onClick={() => statusMutation.mutate({ orderId: order.id, status: nextStatus })}
          type="button"
        >
          {statusMutation.isPending ? fr.service.actions.pending : action}
        </button>
        {statusMutation.isError ? (
          <p className="order-card-action-error" role="alert">
            {fr.service.actions.error}
          </p>
        ) : null}
      </div>
    </article>
  );
}
