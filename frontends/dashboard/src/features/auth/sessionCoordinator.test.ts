import type { RestaurateurSession } from "@surplasse/shared";
import { describe, expect, it, vi } from "vitest";

import type { IdentityClient } from "../../app/clients";
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

function createIdentityClient(
  refreshSession: IdentityClient["refreshSession"],
): IdentityClient {
  return {
    requestMagicLink: vi.fn(async () => undefined),
    exchangeMagicLink: vi.fn(async () => session),
    getCurrentSession: vi.fn(async () => session),
    refreshSession,
    logout: vi.fn(async () => undefined),
  };
}

function createStateSink(): SessionStateSink & {
  setSession: ReturnType<typeof vi.fn>;
  clearBusinessQueries: ReturnType<typeof vi.fn>;
} {
  return {
    setSession: vi.fn(),
    clearBusinessQueries: vi.fn(),
  };
}

describe("SessionCoordinator", () => {
  it("shares one refresh across concurrent protected calls and replays each call once", async () => {
    let resolveRefresh: ((value: RestaurateurSession) => void) | undefined;
    const refreshPromise = new Promise<RestaurateurSession>((resolve) => {
      resolveRefresh = resolve;
    });
    const refreshSession = vi.fn(() => refreshPromise);
    const state = createStateSink();
    const coordinator = new SessionCoordinator(createIdentityClient(refreshSession), state);
    const firstOperation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(unauthorizedError())
      .mockResolvedValueOnce("first");
    const secondOperation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(unauthorizedError())
      .mockResolvedValueOnce("second");

    const firstResult = coordinator.runProtected(firstOperation);
    const secondResult = coordinator.runProtected(secondOperation);
    await Promise.resolve();
    await Promise.resolve();

    expect(refreshSession).toHaveBeenCalledTimes(1);
    resolveRefresh?.(session);

    await expect(Promise.all([firstResult, secondResult])).resolves.toEqual(["first", "second"]);
    expect(firstOperation).toHaveBeenCalledTimes(2);
    expect(secondOperation).toHaveBeenCalledTimes(2);
    expect(state.setSession).toHaveBeenCalledWith(session);
  });

  it("clears the session and business queries only when refresh is unauthorized", async () => {
    const refreshSession = vi.fn(async () => {
      throw unauthorizedError();
    });
    const state = createStateSink();
    const coordinator = new SessionCoordinator(createIdentityClient(refreshSession), state);
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
    const refreshSession = vi.fn(async () => {
      throw networkError;
    });
    const state = createStateSink();
    const coordinator = new SessionCoordinator(createIdentityClient(refreshSession), state);

    await expect(
      coordinator.runProtected(async () => {
        throw unauthorizedError();
      }),
    ).rejects.toBe(networkError);

    expect(state.setSession).not.toHaveBeenCalled();
    expect(state.clearBusinessQueries).not.toHaveBeenCalled();
  });

  it("clears authenticated state when the replay stays unauthorized", async () => {
    const refreshSession = vi.fn(async () => session);
    const state = createStateSink();
    const coordinator = new SessionCoordinator(createIdentityClient(refreshSession), state);
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
    const coordinator = new SessionCoordinator(createIdentityClient(refreshSession), state);
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
});
