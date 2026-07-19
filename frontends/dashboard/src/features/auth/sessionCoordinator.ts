import type { RestaurateurSession } from "@surplasse/shared";

import type { IdentityClient } from "../../app/clients";
import { isUnauthorized } from "./httpError";
import {
  SingleContextSessionCoordination,
  type SessionCoordination,
  type SessionCoordinationMessage,
} from "./sessionCoordination";

export interface SessionStateSink {
  setSession(session: RestaurateurSession | null): void;
  clearBusinessQueries(): void;
}

export class SessionCoordinator {
  constructor(
    private readonly identityClient: IdentityClient,
    private readonly state: SessionStateSink,
    private readonly coordination: SessionCoordination = new SingleContextSessionCoordination(),
  ) {
    this.coordination.subscribe((message) => this.applyRemoteMessage(message));
  }

  async runProtected<T>(operation: () => Promise<T>): Promise<T> {
    let unauthorizedError: unknown;
    try {
      return await operation();
    } catch (error) {
      if (!isUnauthorized(error)) {
        throw error;
      }
      unauthorizedError = error;
    }

    if (!this.coordination.canRefreshSafely) {
      this.clearAuthenticatedState();
      throw unauthorizedError;
    }

    return this.coordination.runExclusive(() => this.recoverProtectedOperation(operation));
  }

  setAuthenticatedSession(session: RestaurateurSession): void {
    this.state.setSession(session);
    this.coordination.publish({ version: 1, type: "session-refreshed", session });
  }

  clearAuthenticatedState(): void {
    this.applyClearedState();
    this.coordination.publish({ version: 1, type: "session-cleared" });
  }

  private async recoverProtectedOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const currentSession = await this.identityClient.getCurrentSession();
      this.state.setSession(currentSession);
    } catch (error) {
      if (!isUnauthorized(error)) {
        throw error;
      }
      await this.refreshSession();
    }

    try {
      return await operation();
    } catch (error) {
      if (isUnauthorized(error)) {
        this.clearAuthenticatedState();
      }
      throw error;
    }
  }

  private applyClearedState(): void {
    this.state.setSession(null);
    this.state.clearBusinessQueries();
  }

  private async refreshSession(): Promise<void> {
    try {
      this.setAuthenticatedSession(await this.identityClient.refreshSession());
    } catch (error) {
      if (isUnauthorized(error)) {
        this.clearAuthenticatedState();
      }
      throw error;
    }
  }

  private applyRemoteMessage(message: SessionCoordinationMessage): void {
    if (message.type === "session-refreshed") {
      this.state.setSession(message.session);
      return;
    }
    this.applyClearedState();
  }
}
