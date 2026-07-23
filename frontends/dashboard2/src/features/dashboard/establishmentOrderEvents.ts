export type LiveConnectionStatus = "connecting" | "connected" | "reconnecting";

interface EventSourcePort {
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: EventListener): void;
  close(): void;
}

export type EventSourceFactory = (
  url: string,
  options: { withCredentials: true },
) => EventSourcePort;

interface EstablishmentOrderEventConnection {
  baseUrl: string;
  establishmentId: string;
  eventSourceFactory?: EventSourceFactory;
  onStatus(status: LiveConnectionStatus): void;
  onResynchronize(): void | Promise<void>;
  onReconnect(): void | Promise<void>;
}

const browserEventSourceFactory: EventSourceFactory = (url, options) =>
  new EventSource(url, options);

export function openEstablishmentOrderEvents({
  baseUrl,
  establishmentId,
  eventSourceFactory = browserEventSourceFactory,
  onStatus,
  onResynchronize,
  onReconnect,
}: EstablishmentOrderEventConnection): () => void {
  const normalizedBaseUrl = baseUrl.replace(/\/$/u, "");
  const source = eventSourceFactory(
    `${normalizedBaseUrl}/v1/establishments/${encodeURIComponent(establishmentId)}/order-events`,
    { withCredentials: true },
  );
  let reconnectCheckInFlight = false;

  source.onopen = () => {
    onStatus("connected");
    void onResynchronize();
  };
  source.onerror = () => {
    onStatus("reconnecting");
    if (!reconnectCheckInFlight) {
      reconnectCheckInFlight = true;
      void Promise.resolve(onReconnect())
        .catch(() => undefined)
        .finally(() => {
          reconnectCheckInFlight = false;
        });
    }
  };
  source.addEventListener("order-status", () => {
    void onResynchronize();
  });

  return () => source.close();
}
