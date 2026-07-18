import { useEffect } from "react";

import { fr } from "../../i18n/fr";
import { CategorySection } from "./components/CategorySection";
import { useEstablishment } from "./hooks/useEstablishment";
import { useMenu } from "./hooks/useMenu";

type Props = {
  slug: string;
};

export function MenuPage({ slug }: Props) {
  const establishment = useEstablishment(slug);
  const menu = useMenu(slug);

  useEffect(() => {
    if (establishment.data) {
      document.title = establishment.data.name;
    }
  }, [establishment.data]);

  if (establishment.isPending || menu.isPending) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10" aria-busy="true">
        <p className="sr-only">{fr.menu.loading}</p>
        <div className="animate-pulse space-y-6">
          <div className="h-9 w-2/3 rounded bg-[var(--surface-sunken)]" />
          <div className="h-4 w-1/2 rounded bg-[var(--surface-sunken)]" />
          <div className="h-40 rounded-lg bg-[var(--surface-sunken)]" />
          <div className="h-40 rounded-lg bg-[var(--surface-sunken)]" />
        </div>
      </main>
    );
  }

  if (establishment.isError || menu.isError || !establishment.data || !menu.data) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10 text-center">
        <p className="mb-6 text-lg">{fr.menu.error}</p>
        <button
          type="button"
          className="min-h-11 min-w-28 rounded-md bg-[var(--accent)] px-6 font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-press)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          onClick={() => {
            void establishment.refetch();
            void menu.refetch();
          }}
        >
          {fr.menu.retry}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-10 border-b border-[var(--line-2)] pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--structure)]">
          {establishment.data.name}
        </h1>
        {establishment.data.address !== undefined && (
          <p className="mt-2 text-sm text-[var(--text-muted)]">{establishment.data.address}</p>
        )}
      </header>

      <div className="space-y-10">
        {menu.data.categories.map((category) => (
          <CategorySection key={category.id} category={category} currency={menu.data.currency} />
        ))}
      </div>

      <footer className="mt-14 border-t border-[var(--line-1)] pt-6 text-center text-xs text-[var(--text-faint)]">
        {fr.menu.poweredBy}
      </footer>
    </main>
  );
}
