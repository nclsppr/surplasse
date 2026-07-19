import { describe, expect, it, vi } from "vitest";

import {
  BrowserSessionCoordination,
  SESSION_LOCK_NAME,
  type LockManagerPort,
  type MessageChannelPort,
} from "./sessionCoordination";

const session = {
  id: "restaurateur-1",
  email: "pilot@example.com",
  fullName: "Camille Martin",
  establishments: [],
};

describe("BrowserSessionCoordination", () => {
  it("runs refresh work under the named exclusive Web Lock", async () => {
    const request = vi.fn();
    const lockManager: LockManagerPort = {
      request: async <T>(
        name: string,
        options: { mode: "exclusive" },
        callback: () => Promise<T>,
      ) => {
        request(name, options, callback);
        return callback();
      },
    };
    const coordination = new BrowserSessionCoordination(lockManager, undefined);

    await expect(coordination.runExclusive(async () => "done")).resolves.toBe("done");

    expect(coordination.canRefreshSafely).toBe(true);
    expect(request).toHaveBeenCalledWith(
      SESSION_LOCK_NAME,
      { mode: "exclusive" },
      expect.any(Function),
    );
  });

  it("reports an unsafe fallback when Web Locks is unavailable", async () => {
    const coordination = new BrowserSessionCoordination(undefined, undefined);

    expect(coordination.canRefreshSafely).toBe(false);
    await expect(coordination.runExclusive(async () => undefined)).rejects.toThrow(
      "Cross-tab session refresh coordination is unavailable.",
    );
  });

  it("broadcasts state and ignores malformed messages", () => {
    const channel = new FakeMessageChannel();
    const coordination = new BrowserSessionCoordination(
      { request: async (_name, _options, callback) => callback() },
      channel,
    );
    const listener = vi.fn();
    const unsubscribe = coordination.subscribe(listener);
    const refreshed = { version: 1 as const, type: "session-refreshed" as const, session };

    coordination.publish(refreshed);
    channel.emit({ version: 2, type: "session-cleared" });
    channel.emit({ version: 1, type: "session-refreshed", session: { id: 42 } });
    channel.emit(refreshed);

    expect(channel.postMessage).toHaveBeenCalledWith(refreshed);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(refreshed);

    unsubscribe();
    channel.emit({ version: 1, type: "session-cleared" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

class FakeMessageChannel implements MessageChannelPort {
  readonly postMessage = vi.fn();
  private readonly listeners = new Set<EventListener>();

  addEventListener(_type: "message", listener: EventListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: EventListener): void {
    this.listeners.delete(listener);
  }

  emit(data: unknown): void {
    for (const listener of this.listeners) {
      listener({ data } as MessageEvent);
    }
  }
}
