import type { RestaurateurSession } from "@surplasse/shared";
import { describe, expect, it, vi } from "vitest";

import type { IdentityClient } from "../../app/clients";
import { MagicLinkExchangeCoordinator } from "./magicLinkExchange";

const session: RestaurateurSession = {
  id: "restaurateur-1",
  email: "pilot@example.com",
  fullName: "Camille Martin",
  establishments: [],
};

function createIdentityClient(exchangeMagicLink: IdentityClient["exchangeMagicLink"]): IdentityClient {
  return {
    requestMagicLink: vi.fn(async () => undefined),
    exchangeMagicLink,
    getCurrentSession: vi.fn(async () => session),
    refreshSession: vi.fn(async () => session),
    logout: vi.fn(async () => undefined),
  };
}

describe("MagicLinkExchangeCoordinator", () => {
  it("cleans the URL before exchanging the fragment token and only exchanges once", async () => {
    const events: Array<string> = [];
    const exchangeMagicLink = vi.fn(async (token: string) => {
      events.push(`exchange:${token}`);
      return session;
    });
    const coordinator = new MagicLinkExchangeCoordinator(createIdentityClient(exchangeMagicLink));
    let cleanUrl = "";

    const first = coordinator.begin(
      "https://dashboard.surplasse.com/auth/magic-link?source=email&token=legacy#token=fragment-token",
      (url) => {
        cleanUrl = url;
        events.push(`clean:${url}`);
      },
    );
    const second = coordinator.begin(
      "https://dashboard.surplasse.com/auth/magic-link?source=email",
      vi.fn(),
    );

    expect(cleanUrl).toBe("/auth/magic-link?source=email");
    expect(events[0]).toBe("clean:/auth/magic-link?source=email");
    expect(exchangeMagicLink).toHaveBeenCalledTimes(1);
    expect(exchangeMagicLink).toHaveBeenCalledWith("fragment-token");
    expect(second).toBe(first);
    await expect(first).resolves.toBe(session);
  });

  it("removes a query token without exchanging it", () => {
    const exchangeMagicLink = vi.fn(async () => session);
    const coordinator = new MagicLinkExchangeCoordinator(createIdentityClient(exchangeMagicLink));
    const replaceUrl = vi.fn();

    const exchange = coordinator.begin(
      "https://dashboard.surplasse.com/auth/magic-link?token=legacy-token",
      replaceUrl,
    );

    expect(replaceUrl).toHaveBeenCalledWith("/auth/magic-link");
    expect(exchangeMagicLink).not.toHaveBeenCalled();
    expect(exchange).toBeNull();
  });

  it("starts a fresh exchange after the previous request has settled", async () => {
    const exchangeMagicLink = vi.fn(async () => session);
    const coordinator = new MagicLinkExchangeCoordinator(createIdentityClient(exchangeMagicLink));

    const first = coordinator.begin(
      "https://dashboard.surplasse.com/auth/magic-link#token=first-token",
      vi.fn(),
    );
    await expect(first).resolves.toBe(session);

    const second = coordinator.begin(
      "https://dashboard.surplasse.com/auth/magic-link#token=second-token",
      vi.fn(),
    );
    await expect(second).resolves.toBe(session);

    expect(exchangeMagicLink).toHaveBeenNthCalledWith(1, "first-token");
    expect(exchangeMagicLink).toHaveBeenNthCalledWith(2, "second-token");
  });

  it("does not call the identity client when the URL carries no token", () => {
    const exchangeMagicLink = vi.fn(async () => session);
    const coordinator = new MagicLinkExchangeCoordinator(createIdentityClient(exchangeMagicLink));

    expect(
      coordinator.begin("https://dashboard.surplasse.com/auth/magic-link", vi.fn()),
    ).toBeNull();
    expect(exchangeMagicLink).not.toHaveBeenCalled();
  });
});
