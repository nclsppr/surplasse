import { fr } from "../i18n/fr";

export function SessionLoading() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10" aria-busy="true">
      <p className="sr-only" role="status">
        {fr.menu.sessionLoading}
      </p>
      <div className="space-y-6 motion-safe:animate-pulse" aria-hidden="true">
        <div className="h-9 w-2/3 rounded bg-[var(--surface-sunken)]" />
        <div className="h-4 w-1/2 rounded bg-[var(--surface-sunken)]" />
        <div className="h-40 rounded-lg bg-[var(--surface-sunken)]" />
        <div className="h-40 rounded-lg bg-[var(--surface-sunken)]" />
      </div>
    </main>
  );
}
