import { useEffect } from "react";
import { Link } from "react-router-dom";
import { formatPriceCents } from "@surplasse/shared";

import { storedTableSession } from "../../app/tableSession";
import { fr } from "../../i18n/fr";
import { cartTotalCents, useCart } from "../cart/hooks/useCart";
import { CategorySection } from "./components/CategorySection";
import { useEstablishment } from "./hooks/useEstablishment";
import { useMenu } from "./hooks/useMenu";

type Props = {
  slug: string;
};

export function MenuPage({ slug }: Props) {
  const establishment = useEstablishment(slug);
  const menu = useMenu(slug);
  const { lines } = useCart();
  const tableSession = storedTableSession();

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
        {tableSession !== undefined && (
          <p className="mt-2 inline-block rounded bg-[var(--structure-tint)] px-2 py-0.5 text-xs font-semibold text-[var(--structure)]">
            {tableSession.tableLabel}
          </p>
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

      {lines.length > 0 && (
        <Link
          to="/panier"
          className="fixed inset-x-5 bottom-5 z-40 mx-auto flex min-h-12 max-w-2xl items-center justify-between rounded-full bg-[var(--accent)] px-6 font-semibold text-[var(--on-accent)] [box-shadow:var(--shadow-pop,0_8px_24px_rgba(0,0,0,.25))]"
        >
          <span>
            {fr.cart.title} · {lines.reduce((sum, line) => sum + line.quantity, 0)}
          </span>
          <span>{formatPriceCents(cartTotalCents(lines), "EUR")}</span>
        </Link>
      )}
    </main>
  );
}
