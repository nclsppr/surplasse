import type { RestaurateurSession } from "@surplasse/shared";

import type { IdentityClient } from "../../app/clients";
import { isUnauthorized } from "./httpError";

export interface SessionStateSink {
  setSession(session: RestaurateurSession | null): void;
  clearBusinessQueries(): void;
}

export class SessionCoordinator {
  private refreshInFlight: Promise<RestaurateurSession> | undefined;

  constructor(
    private readonly identityClient: IdentityClient,
    private readonly state: SessionStateSink,
  ) {}

  async runProtected<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!isUnauthorized(error)) {
        throw error;
      }
    }

    await this.refreshOnce();
    try {
      return await operation();
    } catch (error) {
      if (isUnauthorized(error)) {
        this.clearAuthenticatedState();
      }
      throw error;
    }
  }

  clearAuthenticatedState(): void {
    this.state.setSession(null);
    this.state.clearBusinessQueries();
  }

  private refreshOnce(): Promise<RestaurateurSession> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.identityClient
        .refreshSession()
        .then((session) => {
          this.state.setSession(session);
          return session;
        })
        .catch((error: unknown) => {
          if (isUnauthorized(error)) {
            this.clearAuthenticatedState();
          }
          throw error;
        })
        .finally(() => {
          this.refreshInFlight = undefined;
        });
    }

    return this.refreshInFlight;
  }
}
