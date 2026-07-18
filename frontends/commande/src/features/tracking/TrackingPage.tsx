import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatPriceCents, queryKeys } from "@surplasse/shared";
import type { Order } from "@surplasse/shared";

import { apiBaseUrl, orderApi } from "../../app/api";
import { fr } from "../../i18n/fr";
import { PaymentSection } from "../payment/PaymentSection";

const STEPS = ["paid", "accepted", "preparing", "ready", "served"];

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
    return <main className="mx-auto max-w-2xl px-5 py-10" aria-busy="true" />;
  }
  if (order.isError || order.data === undefined) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <p>{fr.tracking.error}</p>
        <p className="mt-4">
          <Link to="/" className="text-sm text-[var(--structure)] underline">
            {fr.cart.backToMenu}
          </Link>
        </p>
      </main>
    );
  }

  const data = order.data;
  const stepIndex = STEPS.indexOf(data.status);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-bold text-[var(--structure)]">{fr.tracking.title}</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {fr.tracking.orderNumber} n° {data.displayNumber}
        {data.tableLabel !== undefined ? ` · ${data.tableLabel}` : ""}
      </p>

      <p className="mt-6 inline-block rounded-md bg-[var(--structure-tint)] px-4 py-2 text-lg font-semibold text-[var(--structure)]">
        {fr.tracking.statuses[data.status] ?? data.status}
      </p>

      {stepIndex >= 0 && (
        <ol className="mt-4 flex gap-2" aria-hidden="true">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className={`h-2 flex-1 rounded ${index <= stepIndex ? "bg-[var(--accent)]" : "bg-[var(--surface-sunken)]"}`}
            />
          ))}
        </ol>
      )}

      <ul className="mt-8 space-y-2">
        {data.lines.map((line, index) => (
          <li key={index} className="flex items-baseline justify-between gap-4 text-sm">
            <span>
              {line.quantity} x {line.productName}
              {line.options.length > 0 && (
                <span className="text-[var(--text-muted)]"> ({line.options.map((o) => o.option).join(", ")})</span>
              )}
            </span>
            <span className="shrink-0">{formatPriceCents(line.lineTotalCents, data.currency)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-baseline justify-between border-t border-[var(--line-2)] pt-3 font-bold">
        <span>{fr.tracking.total}</span>
        <span className="text-[var(--structure)]">{formatPriceCents(data.totalCents, data.currency)}</span>
      </div>

      {data.status === "pending_payment" && wantsPayment && <PaymentSection order={data} />}

      <p className="mt-10">
        <Link to="/" className="text-sm text-[var(--structure)] underline">
          {fr.cart.backToMenu}
        </Link>
      </p>
    </main>
  );
}
