import type { RestaurateurSession } from "@surplasse/shared";

import type { IdentityClient } from "../../app/clients";

export class MagicLinkExchangeCoordinator {
  private exchangeInFlight: Promise<RestaurateurSession> | undefined;

  constructor(private readonly identityClient: IdentityClient) {}

  begin(currentUrl: string, replaceUrl: (cleanUrl: string) => void): Promise<RestaurateurSession> | null {
    const url = new URL(currentUrl);
    const fragment = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
    const token = fragment.get("token");
    const carriesToken = token !== null || url.searchParams.has("token");

    if (carriesToken) {
      url.hash = "";
      url.searchParams.delete("token");
      replaceUrl(`${url.pathname}${url.search}${url.hash}`);
    }

    if (token && !this.exchangeInFlight) {
      const exchange = this.identityClient.exchangeMagicLink(token);
      this.exchangeInFlight = exchange;
      void exchange.then(
        () => this.clearExchange(exchange),
        () => this.clearExchange(exchange),
      );
    }

    return this.exchangeInFlight ?? null;
  }

  private clearExchange(exchange: Promise<RestaurateurSession>): void {
    if (this.exchangeInFlight === exchange) {
      this.exchangeInFlight = undefined;
    }
  }
}
