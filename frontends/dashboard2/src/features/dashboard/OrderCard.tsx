import { useEffect, useId, useRef, useState } from "react";
import {
  formatPriceCents,
  type DashboardOrder,
  type RefundCreationRequestReasonEnum,
} from "@surplasse/shared";

import { fr } from "../../i18n/fr";
import { nextOrderStatus } from "./orderStatus";
import { useRefundMutation } from "./useRefundMutation";
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
  const refundMutation = useRefundMutation(establishmentId);
  const [confirmingRefund, setConfirmingRefund] = useState(false);
  const [refundIdempotencyKey, setRefundIdempotencyKey] = useState<string>();
  const [refundReason, setRefundReason] = useState<RefundCreationRequestReasonEnum>(
    order.status === "paid" ? "restaurant_refusal" : "item_unavailable",
  );
  const refundConfirmationId = useId();
  const refundTitleId = useId();
  const refundTriggerRef = useRef<HTMLButtonElement>(null);
  const refundConfirmRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingRefund = useRef(confirmingRefund);
  const nextStatus = nextOrderStatus(order);
  const action = fr.service.actions[nextStatus];
  const createdTime = timeFormatter.format(new Date(order.createdAt));
  const location = order.tableLabel
    ? order.tableLabel
    : order.type === "takeaway"
      ? fr.service.takeaway
      : fr.service.onSite;
  const isRefusal = order.status === "paid";
  const refundInProgress =
    refundMutation.isPending ||
    refundMutation.data?.status === "pending" ||
    refundMutation.data?.status === "requires_action";

  useEffect(() => {
    if (confirmingRefund) {
      refundConfirmRef.current?.focus({ preventScroll: true });
    } else if (wasConfirmingRefund.current) {
      refundTriggerRef.current?.focus({ preventScroll: true });
    }
    wasConfirmingRefund.current = confirmingRefund;
  }, [confirmingRefund]);

  function requestRefund() {
    refundMutation.reset();
    setRefundReason(isRefusal ? "restaurant_refusal" : "item_unavailable");
    setRefundIdempotencyKey(crypto.randomUUID());
    setConfirmingRefund(true);
  }

  function cancelRefund() {
    if (refundInProgress) {
      return;
    }
    setConfirmingRefund(false);
    setRefundIdempotencyKey(undefined);
    refundMutation.reset();
  }

  function confirmRefund() {
    let key = refundIdempotencyKey;
    if (refundMutation.data?.status === "failed" || refundMutation.data?.status === "canceled") {
      key = crypto.randomUUID();
      setRefundIdempotencyKey(key);
    }
    if (!key) {
      return;
    }
    refundMutation.mutate({
      orderId: order.id,
      reason: refundReason,
      idempotencyKey: key,
    });
  }

  return (
    <article
      aria-busy={statusMutation.isPending || refundMutation.isPending}
      className={`order-card order-card-${order.status}`}
    >
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
        <div className="order-card-actions order-card-actions-with-refund">
          <button
            aria-label={fr.service.actions.label(action, order.displayNumber)}
            className="button button-primary order-card-action"
            disabled={statusMutation.isPending || refundInProgress || confirmingRefund}
            onClick={() => statusMutation.mutate({ orderId: order.id, status: nextStatus })}
            type="button"
          >
            {statusMutation.isPending ? fr.service.actions.pending : action}
          </button>
          <button
            ref={refundTriggerRef}
            aria-controls={refundConfirmationId}
            aria-expanded={confirmingRefund}
            aria-label={fr.service.refund.triggerLabel(isRefusal, order.displayNumber)}
            className="button button-danger-quiet order-card-refund-trigger"
            disabled={statusMutation.isPending || refundInProgress}
            onClick={requestRefund}
            type="button"
          >
            {isRefusal ? fr.service.refund.triggerRefusal : fr.service.refund.triggerIncident}
          </button>
        </div>

        {confirmingRefund ? (
          <div
            aria-labelledby={refundTitleId}
            aria-live="polite"
            className="order-refund-confirmation"
            id={refundConfirmationId}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelRefund();
              }
            }}
            role="group"
          >
            <strong id={refundTitleId}>
              {fr.service.refund.confirmTitle(formatPriceCents(order.totalCents, order.currency))}
            </strong>
            <p>{fr.service.refund.confirmDescription}</p>
            {!isRefusal ? (
              <label className="order-refund-reason">
                <span>{fr.service.refund.reasonLabel}</span>
                <select
                  disabled={refundInProgress}
                  onChange={(event) =>
                    setRefundReason(event.target.value as RefundCreationRequestReasonEnum)
                  }
                  value={refundReason}
                >
                  <option value="item_unavailable">{fr.service.refund.reasonUnavailable}</option>
                  <option value="service_incident">{fr.service.refund.reasonIncident}</option>
                </select>
              </label>
            ) : null}
            <div className="order-refund-confirmation-actions">
              <button
                className="button button-ghost"
                disabled={refundInProgress}
                onClick={cancelRefund}
                type="button"
              >
                {isRefusal ? fr.service.refund.cancelRefusal : fr.service.refund.cancel}
              </button>
              <button
                ref={refundConfirmRef}
                className="button button-danger"
                disabled={refundInProgress}
                onClick={confirmRefund}
                type="button"
              >
                {refundMutation.isPending
                  ? fr.service.refund.pending
                  : isRefusal
                    ? fr.service.refund.confirmRefusal
                    : fr.service.refund.confirmIncident}
              </button>
            </div>
            {refundMutation.isError ? (
              <p className="order-card-action-error" role="alert">
                {fr.service.refund.error}
              </p>
            ) : null}
            {refundMutation.data?.status === "pending" ||
            refundMutation.data?.status === "requires_action" ? (
              <p className="order-refund-status" role="status">
                {fr.service.refund.processing}
              </p>
            ) : null}
            {refundMutation.data?.status === "failed" || refundMutation.data?.status === "canceled" ? (
              <p className="order-card-action-error" role="alert">
                {fr.service.refund.failed}
              </p>
            ) : null}
          </div>
        ) : null}
        {statusMutation.isError ? (
          <p className="order-card-action-error" role="alert">
            {fr.service.actions.error}
          </p>
        ) : null}
      </div>
    </article>
  );
}
