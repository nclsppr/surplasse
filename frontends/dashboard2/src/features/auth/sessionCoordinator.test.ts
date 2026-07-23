import type { RestaurateurSession } from "@surplasse/shared";
import { describe, expect, it, vi } from "vitest";

import type { IdentityClient } from "../../app/clients";
import type {
  SessionCoordination,
  SessionCoordinationMessage,
} from "./sessionCoordination";
import { SingleContextSessionCoordination } from "./sessionCoordination";
import { SessionCoordinator, type SessionStateSink } from "./sessionCoordinator";

const session: RestaurateurSession = {
  id: "restaurateur-1",
  email: "pilot@example.com",
  fullName: "Camille Martin",
  establishments: [],
};

function unauthorizedError() {
  return { response: { status: 401 } };
}

function createIdentityClient(options: {
  getCurrentSession?: IdentityClient["getCurrentSession"];
  refreshSession?: IdentityClient["refreshSession"];
} = {}): IdentityClient {
  return {
    requestMagicLink: vi.fn(async () => undefined),
    exchangeMagicLink: vi.fn(async () => session),
    getCurrentSession: options.getCurrentSession ?? vi.fn(async () => session),
    refreshSession: options.refreshSession ?? vi.fn(async () => session),
    logout: vi.fn(async () => undefined),
  };
}

function createStateSink(): SessionStateSink & {
  setSession: ReturnType<typeof vi.fn<(session: RestaurateurSession | null) => void>>;
  clearBusinessQueries: ReturnType<typeof vi.fn<() => void>>;
} {
  return {
    setSession: vi.fn(),
    clearBusinessQueries: vi.fn(),
  };
}

function operationWhile(accessIsValid: () => boolean, result: string) {
  return vi.fn(async () => {
    if (!accessIsValid()) {
      throw unauthorizedError();
    }
    return result;
  });
}

describe("SessionCoordinator", () => {
  it("shares one refresh across concurrent protected calls in one tab", async () => {
    let accessValid = false;
    let resolveRefresh: ((value: RestaurateurSession) => void) | undefined;
    const refreshPromise = new Promise<RestaurateurSession>((resolve) => {
      resolveRefresh = resolve;
    }).then((value) => {
      accessValid = true;
      return value;
    });
    const getCurrentSession = vi.fn(async () => {
      if (!accessValid) {
        throw unauthorizedError();
      }
      return session;
    });
    const refreshSession = vi.fn(() => refreshPromise);
    const state = createStateSink();
    const coordinator = new SessionCoordinator(
      createIdentityClient({ getCurrentSession, refreshSession }),
      state,
    );
    const firstOperation = operationWhile(() => accessValid, "first");
    const secondOperation = operationWhile(() => accessValid, "second");

    const firstResult = coordinator.runProtected(firstOperation);
    const secondResult = coordinator.runProtected(secondOperation);
    await vi.waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(1));
    resolveRefresh?.(session);

    await expect(Promise.all([firstResult, secondResult])).resolves.toEqual(["first", "second"]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(firstOperation).toHaveBeenCalledTimes(2);
    expect(secondOperation).toHaveBeenCalledTimes(2);
    expect(state.setSession).toHaveBeenCalledWith(session);
  });

  it("shares one refresh across two coordinators using the same cross-tab lock", async () => {
    let accessValid = false;
    const crossTabLock = new SingleContextSessionCoordination();
    const getCurrentSession = vi.fn(async () => {
      if (!accessValid) {
        throw unauthorizedError();
      }
      return session;
    });
    const refreshSession = vi.fn(async () => {
      accessValid = true;
      return session;
    });
    const firstState = createStateSink();
    const secondState = createStateSink();
    const firstCoordinator = new SessionCoordinator(
      createIdentityClient({ getCurrentSession, refreshSession }),
      firstState,
      crossTabLock,
    );
    const secondCoordinator = new SessionCoordinator(
      createIdentityClient({ getCurrentSession, refreshSession }),
      secondState,
      crossTabLock,
    );

    const results = await Promise.all([
      firstCoordinator.runProtected(operationWhile(() => accessValid, "first tab")),
      secondCoordinator.runProtected(operationWhile(() => accessValid, "second tab")),
    ]);

    expect(results).toEqual(["first tab", "second tab"]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(firstState.setSession).toHaveBeenCalledWith(session);
    expect(secondState.setSession).toHaveBeenCalledWith(session);
  });

  it("clears the session and business queries when refresh is unauthorized", async () => {
    const refreshSession = vi.fn(async () => {
      throw unauthorizedError();
    });
    const state = createStateSink();
    const coordinator = new SessionCoordinator(
      createIdentityClient({
        getCurrentSession: vi.fn(async () => {
          throw unauthorizedError();
        }),
        refreshSession,
      }),
      state,
    );
    const operation = vi.fn(async () => {
      throw unauthorizedError();
    });

    await expect(coordinator.runProtected(operation)).rejects.toEqual(unauthorizedError());

    expect(state.setSession).toHaveBeenCalledWith(null);
    expect(state.clearBusinessQueries).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("keeps authenticated state when refresh fails because of the network", async () => {
    const networkError = new Error("Network unavailable");
    const state = createStateSink();
    const coordinator = new SessionCoordinator(
      createIdentityClient({
        getCurrentSession: vi.fn(async () => {
          throw unauthorizedError();
        }),
        refreshSession: vi.fn(async () => {
          throw networkError;
        }),
      }),
      state,
    );

    await expect(
      coordinator.runProtected(async () => {
        throw unauthorizedError();
      }),
    ).rejects.toBe(networkError);

    expect(state.setSession).not.toHaveBeenCalled();
    expect(state.clearBusinessQueries).not.toHaveBeenCalled();
  });

  it("clears authenticated state when the replay stays unauthorized", async () => {
    const state = createStateSink();
    const coordinator = new SessionCoordinator(
      createIdentityClient({
        getCurrentSession: vi.fn(async () => {
          throw unauthorizedError();
        }),
      }),
      state,
    );
    const operation = vi.fn(async () => {
      throw unauthorizedError();
    });

    await expect(coordinator.runProtected(operation)).rejects.toEqual(unauthorizedError());

    expect(operation).toHaveBeenCalledTimes(2);
    expect(state.setSession).toHaveBeenNthCalledWith(1, session);
    expect(state.setSession).toHaveBeenNthCalledWith(2, null);
    expect(state.clearBusinessQueries).toHaveBeenCalledTimes(1);
  });

  it("does not refresh or disconnect on a protected server error", async () => {
    const refreshSession = vi.fn(async () => session);
    const state = createStateSink();
    const coordinator = new SessionCoordinator(createIdentityClient({ refreshSession }), state);
    const serverError = { response: { status: 503 } };

    await expect(
      coordinator.runProtected(async () => {
        throw serverError;
      }),
    ).rejects.toBe(serverError);

    expect(refreshSession).not.toHaveBeenCalled();
    expect(state.setSession).not.toHaveBeenCalled();
    expect(state.clearBusinessQueries).not.toHaveBeenCalled();
  });

  it("fails closed instead of rotating without a cross-tab lock", async () => {
    const refreshSession = vi.fn(async () => session);
    const state = createStateSink();
    const coordination = new TestSessionCoordination(false);
    const coordinator = new SessionCoordinator(
      createIdentityClient({ refreshSession }),
      state,
      coordination,
    );

    await expect(
      coordinator.runProtected(async () => {
        throw unauthorizedError();
      }),
    ).rejects.toEqual(unauthorizedError());

    expect(refreshSession).not.toHaveBeenCalled();
    expect(coordination.runExclusiveSpy).not.toHaveBeenCalled();
    expect(state.setSession).toHaveBeenCalledWith(null);
    expect(state.clearBusinessQueries).toHaveBeenCalledTimes(1);
  });

  it("applies session changes received from another tab without rebroadcasting", () => {
    const state = createStateSink();
    const coordination = new TestSessionCoordination(true);
    new SessionCoordinator(createIdentityClient(), state, coordination);

    coordination.emit({ version: 1, type: "session-refreshed", session });
    coordination.emit({ version: 1, type: "session-cleared" });

    expect(state.setSession).toHaveBeenNthCalledWith(1, session);
    expect(state.setSession).toHaveBeenNthCalledWith(2, null);
    expect(state.clearBusinessQueries).toHaveBeenCalledTimes(1);
    expect(coordination.publish).not.toHaveBeenCalled();
  });
});

class TestSessionCoordination implements SessionCoordination {
  readonly listeners = new Set<(message: SessionCoordinationMessage) => void>();
  readonly runExclusiveSpy = vi.fn();
  readonly publish = vi.fn();

  constructor(readonly canRefreshSafely: boolean) {}

  runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    this.runExclusiveSpy(operation);
    return operation();
  }

  subscribe(listener: (message: SessionCoordinationMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(message: SessionCoordinationMessage): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }
}
