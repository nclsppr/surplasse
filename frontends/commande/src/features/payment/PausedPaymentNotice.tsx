import { fr } from "../../i18n/fr";

export function PausedPaymentNotice({ onRetry }: { onRetry(): void }) {
  return (
    <div
      className="mt-8 rounded-md border border-[var(--accent-hover)] border-t-2 bg-[var(--accent-tint)] p-4 text-sm"
      role="alert"
    >
      <p>{fr.payment.orderIntakePaused}</p>
      <button
        type="button"
        className="mt-3 min-h-11 rounded-md border border-[var(--accent-hover)] px-4 font-semibold text-[var(--accent-hover)]"
        onClick={onRetry}
      >
        {fr.payment.retry}
      </button>
    </div>
  );
}
