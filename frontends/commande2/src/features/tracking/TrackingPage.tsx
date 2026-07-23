import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatPriceCents, queryKeys } from "@surplasse/shared";
import type { Order } from "@surplasse/shared";
import { Badge, type BadgeTone } from "@surplasse/design-system2";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { apiBaseUrl, orderApi } from "../../app/api";
import { SiteHeader } from "../../components/SiteHeader";
import { fr } from "../../i18n/fr";
import { PaymentSection } from "../payment/PaymentSection";

const STEPS = ["paid", "accepted", "preparing", "ready", "served"];

function orderStatusTone(status: Order["status"]): BadgeTone {
  if (status === "pending_payment") {
    return "warning";
  }
  if (status === "cancelled" || status === "refunded") {
    return "danger";
  }
  if (status === "served" || status === "picked_up") {
    return "success";
  }
  return "info";
}

/**
 * Confirmation and live tracking page. Reachable by its URL (order id plus
 * tracking capability): the customer can close the browser and come back.
 */
export function TrackingPage() {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const trackingToken = params.get("t") ?? "";
  const wantsPayment = params.get("paiement") === "1";
  const queryClient = useQueryClient();

  const order = useQuery({
    queryKey: queryKeys.order(orderId ?? ""),
    queryFn: () => orderApi.getOrder({ orderId: orderId ?? "", trackingToken }),
    enabled: orderId !== undefined && trackingToken !== "",
  });

  // The SSE stream feeds the Query cache; components only read the cache
  // (conventions React). EventSource is the one sanctioned exception to
  // "everything goes through the generated client".
  useEffect(() => {
    if (orderId === undefined || trackingToken === "") {
      return;
    }
    const source = new EventSource(
      `${apiBaseUrl}/v1/orders/${orderId}/events?trackingToken=${encodeURIComponent(trackingToken)}`,
    );
    source.addEventListener("order-status", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { status: Order["status"] };
      queryClient.setQueryData(queryKeys.order(orderId), (cached: Order | undefined) =>
        cached === undefined ? cached : { ...cached, status: payload.status },
      );
    });
    return () => source.close();
  }, [orderId, trackingToken, queryClient]);

  if (order.isPending) {
    return <main className="state-page" aria-busy="true" />;
  }
  if (order.isError || order.data === undefined) {
    return (
      <div className="commande-page">
        <SiteHeader />
        <main className="state-page">
          <p className="state-title">{fr.tracking.error}</p>
          <Link to="/" className="back-link">
            <ArrowLeft aria-hidden="true" size={18} />
            {fr.cart.backToMenu}
          </Link>
        </main>
      </div>
    );
  }

  const data = order.data;
  const stepIndex = STEPS.indexOf(data.status);
  const statusTone = orderStatusTone(data.status);

  return (
    <div className="commande-page">
      <SiteHeader />
      <main className="state-page tracking-page">
        <div className="page-heading">
          <Link to="/" className="back-link">
            <ArrowLeft aria-hidden="true" size={18} />
            {fr.cart.backToMenu}
          </Link>
          <h1>{fr.tracking.title}</h1>
          <p>
            {fr.tracking.orderNumber} n° {data.displayNumber}
            {data.tableLabel !== undefined ? ` · ${data.tableLabel}` : ""}
          </p>
        </div>

        <Badge tone={statusTone} icon={<CheckCircle2 aria-hidden="true" size={15} />}>
          {fr.tracking.statuses[data.status] ?? data.status}
        </Badge>

        {stepIndex >= 0 && (
          <ol className="tracking-progress" aria-hidden="true">
            {STEPS.map((step, index) => (
              <li key={step} className={index <= stepIndex ? "tracking-step-complete" : ""} />
            ))}
          </ol>
        )}

        <section className="order-receipt" aria-label={fr.tracking.orderNumber}>
          <ul>
            {data.lines.map((line, index) => (
              <li key={index}>
                <span>
                  {line.quantity} x {line.productName}
                  {line.options.length > 0 ? (
                    <small> ({line.options.map((option) => option.option).join(", ")})</small>
                  ) : null}
                </span>
                <span>{formatPriceCents(line.lineTotalCents, data.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="receipt-total">
            <span>{fr.tracking.total}</span>
            <span>{formatPriceCents(data.totalCents, data.currency)}</span>
          </div>
        </section>

        {data.status === "pending_payment" && wantsPayment ? <PaymentSection key={data.id} order={data} /> : null}

      </main>
    </div>
  );
}
