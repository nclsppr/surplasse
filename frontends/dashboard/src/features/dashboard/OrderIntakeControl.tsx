import { useEffect, useRef, useState } from "react";
import type { OrderIntakeState, OrderIntakeStatus } from "@surplasse/shared";

import { fr } from "../../i18n/fr";
import { OrderIntakeUpdateProblem } from "./orderIntakeUpdateProblem";
import { useOrderIntake } from "./useOrderIntake";

interface OrderIntakeControlProps {
  establishmentId: string;
}

export function OrderIntakeControl({ establishmentId }: OrderIntakeControlProps) {
  const { state, update } = useOrderIntake(establishmentId);
  const [confirmingPause, setConfirmingPause] = useState(false);

  useEffect(() => {
    if (confirmingPause && state.data?.status !== "open") {
      setConfirmingPause(false);
    }
  }, [confirmingPause, state.data?.status]);

  function requestPause() {
    update.reset();
    setConfirmingPause(true);
  }

  function applyStatus(status: OrderIntakeStatus) {
    update.mutate(status, {
      onSuccess: () => setConfirmingPause(false),
    });
  }

  return (
    <OrderIntakeControlView
      state={state.data}
      isLoading={state.isPending}
      loadError={state.isError}
      updatePending={update.isPending}
      updateError={update.error}
      confirmingPause={confirmingPause}
      onRequestPause={requestPause}
      onConfirmPause={() => applyStatus("paused")}
      onCancelPause={() => setConfirmingPause(false)}
      onOpen={() => applyStatus("open")}
      onRetry={() => {
        update.reset();
        void state.refetch();
      }}
    />
  );
}

interface OrderIntakeControlViewProps {
  state?: OrderIntakeState;
  isLoading: boolean;
  loadError: boolean;
  updatePending: boolean;
  updateError: unknown;
  confirmingPause: boolean;
  onRequestPause(): void;
  onConfirmPause(): void;
  onCancelPause(): void;
  onOpen(): void;
  onRetry(): void;
}

function descriptionFor(state: OrderIntakeState): string {
  if (state.acceptingOrders) {
    return fr.service.orderIntake.openDescription;
  }
  if (state.blockedReason === "establishment_not_active") {
    return fr.service.orderIntake.inactiveDescription;
  }
  if (state.blockedReason === "payments_unavailable") {
    return fr.service.orderIntake.paymentsUnavailableDescription;
  }
  if (state.blockedReason === "configuration_unavailable") {
    return fr.service.orderIntake.configurationUnavailableDescription;
  }
  return fr.service.orderIntake.pausedDescription;
}

function updateErrorMessage(error: unknown): string {
  if (error instanceof OrderIntakeUpdateProblem) {
    if (error.reason === "establishment_not_active") {
      return fr.service.orderIntake.openEstablishmentInactiveError;
    }
    if (error.reason === "configuration_unavailable") {
      return fr.service.orderIntake.openConfigurationError;
    }
    if (error.reason === "payments_unavailable") {
      return fr.service.orderIntake.openPaymentsError;
    }
    return fr.service.orderIntake.openPrerequisitesError;
  }
  return fr.service.orderIntake.updateUncertainError;
}

export function OrderIntakeControlView({
  state,
  isLoading,
  loadError,
  updatePending,
  updateError,
  confirmingPause,
  onRequestPause,
  onConfirmPause,
  onCancelPause,
  onOpen,
  onRetry,
}: OrderIntakeControlViewProps) {
  const acceptingOrders = state?.acceptingOrders === true;
  const configuredOpen = state?.status === "open";
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingPause = useRef(confirmingPause);

  useEffect(() => {
    if (confirmingPause) {
      confirmButtonRef.current?.focus({ preventScroll: true });
    } else if (wasConfirmingPause.current) {
      actionButtonRef.current?.focus({ preventScroll: true });
    }
    wasConfirmingPause.current = confirmingPause;
  }, [confirmingPause]);

  return (
    <section className="order-intake" aria-labelledby="order-intake-title">
      <div className="order-intake-copy">
        <p className="eyebrow">{fr.service.orderIntake.eyebrow}</p>
        <div className="order-intake-title-line">
          <h2 id="order-intake-title">{fr.service.orderIntake.title}</h2>
          {state ? (
            <span
              className={`order-intake-state order-intake-state-${configuredOpen ? "open" : "paused"}`}
              role="status"
              aria-live="polite"
            >
              <span aria-hidden="true" />
              {configuredOpen
                ? fr.service.orderIntake.open
                : fr.service.orderIntake.paused}
            </span>
          ) : null}
        </div>
        <p className="order-intake-description">
          {isLoading
            ? fr.service.orderIntake.loading
            : state
              ? descriptionFor(state)
              : fr.service.orderIntake.unavailable}
        </p>
        {state ? (
          <p
            className={`order-intake-effective order-intake-effective-${acceptingOrders ? "open" : "blocked"}`}
            role="status"
            aria-live="polite"
          >
            <span>{fr.service.orderIntake.effectiveLabel}</span>
            <strong>
              {acceptingOrders
                ? fr.service.orderIntake.effectiveOpen
                : fr.service.orderIntake.effectiveBlocked}
            </strong>
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="order-intake-loading" role="status" aria-label={fr.service.orderIntake.loading}>
          <span className="spinner" aria-hidden="true" />
        </div>
      ) : state ? (
        <div className="order-intake-action">
          {configuredOpen ? (
            <button
              ref={actionButtonRef}
              type="button"
              className="button button-secondary"
              aria-controls="order-intake-confirmation"
              aria-expanded={confirmingPause}
              disabled={updatePending}
              onClick={onRequestPause}
            >
              {fr.service.orderIntake.pauseAction}
            </button>
          ) : (
            <button
              ref={actionButtonRef}
              type="button"
              className="button button-primary"
              disabled={updatePending}
              onClick={onOpen}
            >
              {updatePending
                ? fr.service.orderIntake.opening
                : fr.service.orderIntake.openAction}
            </button>
          )}
        </div>
      ) : (
        <button type="button" className="button button-secondary" onClick={onRetry}>
          {fr.common.retry}
        </button>
      )}

      {confirmingPause && configuredOpen ? (
        <div
          className="order-intake-confirmation"
          id="order-intake-confirmation"
          role="group"
          aria-label={fr.service.orderIntake.confirmTitle}
          aria-live="polite"
        >
          <div>
            <strong>{fr.service.orderIntake.confirmTitle}</strong>
            <p>
              {acceptingOrders
                ? fr.service.orderIntake.confirmDescription
                : fr.service.orderIntake.confirmBlockedDescription}
            </p>
          </div>
          <div className="order-intake-confirmation-actions">
            <button
              type="button"
              className="button button-ghost"
              disabled={updatePending}
              onClick={onCancelPause}
            >
              {fr.service.orderIntake.cancel}
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              className="button button-primary"
              disabled={updatePending}
              onClick={onConfirmPause}
            >
              {updatePending
                ? fr.service.orderIntake.pausing
                : fr.service.orderIntake.confirmAction}
            </button>
          </div>
        </div>
      ) : null}

      {loadError && state ? (
        <div className="order-intake-warning" role="alert">
          <span>{fr.service.orderIntake.staleWarning}</span>
          <button type="button" onClick={onRetry}>
            {fr.common.retry}
          </button>
        </div>
      ) : null}

      {updateError ? (
        <p className="order-intake-error" role="alert">
          {updateErrorMessage(updateError)}
        </p>
      ) : null}
    </section>
  );
}
