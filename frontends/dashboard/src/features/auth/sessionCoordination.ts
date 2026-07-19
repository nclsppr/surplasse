import type { RestaurateurSession } from "@surplasse/shared";

const SESSION_LOCK_NAME = "surplasse:restaurateur-session-refresh";
const SESSION_CHANNEL_NAME = "surplasse:restaurateur-session";

export type SessionCoordinationMessage =
  | { version: 1; type: "session-refreshed"; session: RestaurateurSession }
  | { version: 1; type: "session-cleared" };

export interface SessionCoordination {
  readonly canRefreshSafely: boolean;
  runExclusive<T>(operation: () => Promise<T>): Promise<T>;
  publish(message: SessionCoordinationMessage): void;
  subscribe(listener: (message: SessionCoordinationMessage) => void): () => void;
}

export interface LockManagerPort {
  request<T>(
    name: string,
    options: { mode: "exclusive" },
    callback: () => Promise<T>,
  ): Promise<T>;
}

export interface MessageChannelPort {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: EventListener): void;
  removeEventListener(type: "message", listener: EventListener): void;
}

export class SingleContextSessionCoordination implements SessionCoordination {
  readonly canRefreshSafely = true;
  private tail: Promise<void> = Promise.resolve();

  runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation, operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  publish(): void {
    return;
  }

  subscribe(): () => void {
    return () => undefined;
  }
}

export class BrowserSessionCoordination implements SessionCoordination {
  readonly canRefreshSafely: boolean;

  constructor(
    private readonly lockManager: LockManagerPort | undefined,
    private readonly channel: MessageChannelPort | undefined,
  ) {
    this.canRefreshSafely = lockManager !== undefined;
  }

  runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.lockManager) {
      return Promise.reject(new Error("Cross-tab session refresh coordination is unavailable."));
    }
    return this.lockManager.request(SESSION_LOCK_NAME, { mode: "exclusive" }, operation);
  }

  publish(message: SessionCoordinationMessage): void {
    try {
      this.channel?.postMessage(message);
    } catch {
      // The exclusive lock still protects token rotation if messaging is unavailable.
    }
  }

  subscribe(listener: (message: SessionCoordinationMessage) => void): () => void {
    if (!this.channel) {
      return () => undefined;
    }

    const receive: EventListener = (event) => {
      const message = (event as MessageEvent<unknown>).data;
      if (isSessionCoordinationMessage(message)) {
        listener(message);
      }
    };
    this.channel.addEventListener("message", receive);
    return () => this.channel?.removeEventListener("message", receive);
  }
}

export function createBrowserSessionCoordination(): SessionCoordination {
  if (typeof window === "undefined") {
    return new BrowserSessionCoordination(undefined, undefined);
  }

  const lockManager = window.navigator.locks as LockManagerPort | undefined;
  let channel: BroadcastChannel | undefined;
  if (typeof window.BroadcastChannel === "function") {
    try {
      channel = new window.BroadcastChannel(SESSION_CHANNEL_NAME);
    } catch {
      channel = undefined;
    }
  }
  return new BrowserSessionCoordination(lockManager, channel);
}

function isSessionCoordinationMessage(value: unknown): value is SessionCoordinationMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SessionCoordinationMessage>;
  if (candidate.version !== 1) {
    return false;
  }
  if (candidate.type === "session-cleared") {
    return true;
  }
  return candidate.type === "session-refreshed" && isRestaurateurSession(candidate.session);
}

function isRestaurateurSession(value: unknown): value is RestaurateurSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<RestaurateurSession>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.fullName === "string" &&
    Array.isArray(candidate.establishments)
  );
}

export { SESSION_CHANNEL_NAME, SESSION_LOCK_NAME };
