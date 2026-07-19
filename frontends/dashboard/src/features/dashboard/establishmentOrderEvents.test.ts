import { describe, expect, it, vi } from "vitest";

import {
  openEstablishmentOrderEvents,
  type EventSourceFactory,
} from "./establishmentOrderEvents";

class FakeEventSource {
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly listeners = new Map<string, EventListener>();
  readonly close = vi.fn();

  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, listener);
  }

  emitOpen(): void {
    this.onopen?.({} as Event);
  }

  emitError(): void {
    this.onerror?.({} as Event);
  }

  emit(type: string): void {
    this.listeners.get(type)?.({} as Event);
  }
}

describe("establishment order events", () => {
  it("opens a credentialed stream and resynchronizes on open and order activity", () => {
    const source = new FakeEventSource();
    const factory = vi.fn<EventSourceFactory>(() => source);
    const onStatus = vi.fn();
    const onResynchronize = vi.fn();

    const close = openEstablishmentOrderEvents({
      baseUrl: "https://api.surplasse.test/",
      establishmentId: "establishment-id",
      eventSourceFactory: factory,
      onStatus,
      onResynchronize,
      onReconnect: vi.fn(),
    });

    expect(factory).toHaveBeenCalledWith(
      "https://api.surplasse.test/v1/establishments/establishment-id/order-events",
      { withCredentials: true },
    );
    source.emitOpen();
    source.emit("order-status");

    expect(onStatus).toHaveBeenCalledWith("connected");
    expect(onResynchronize).toHaveBeenCalledTimes(2);

    close();
    expect(source.close).toHaveBeenCalledTimes(1);
  });

  it("reports reconnection and shares one session check across repeated errors", async () => {
    const source = new FakeEventSource();
    let resolveReconnect: (() => void) | undefined;
    const reconnect = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveReconnect = resolve;
        }),
    );
    const onStatus = vi.fn();

    openEstablishmentOrderEvents({
      baseUrl: "https://api.surplasse.test",
      establishmentId: "establishment-id",
      eventSourceFactory: () => source,
      onStatus,
      onResynchronize: vi.fn(),
      onReconnect: reconnect,
    });

    source.emitError();
    source.emitError();

    expect(onStatus).toHaveBeenLastCalledWith("reconnecting");
    expect(reconnect).toHaveBeenCalledTimes(1);

    resolveReconnect?.();
    await Promise.resolve();
    await Promise.resolve();
    source.emitError();
    expect(reconnect).toHaveBeenCalledTimes(2);
  });
});
