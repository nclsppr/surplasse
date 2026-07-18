import { useState } from "react";
import { formatPriceCents } from "@surplasse/shared";
import type { MenuProduct } from "@surplasse/shared";

import { fr } from "../../../i18n/fr";
import { useCart } from "../../cart/hooks/useCart";
import type { CartOption } from "../../cart/hooks/useCart";
import { ProductSheet } from "./ProductSheet";

type Props = {
  product: MenuProduct;
  currency: string;
};

export function ProductCard({ product, currency }: Props) {
  const { addLine } = useCart();
  const [sheetOpen, setSheetOpen] = useState(false);

  const add = (options: CartOption[], note: string | undefined) => {
    addLine({
      productId: product.id,
      productName: product.name,
      unitPriceCents: product.priceCents,
      quantity: 1,
      options,
      note,
    });
    setSheetOpen(false);
  };

  return (
    <article
      className={`rounded-lg border border-[var(--line-1)] bg-[var(--surface-card)] p-4 [box-shadow:var(--shadow-card)] ${
        product.available ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-semibold">{product.name}</h3>
        <p className="shrink-0 font-semibold text-[var(--structure)]">
          {formatPriceCents(product.priceCents, currency)}
        </p>
      </div>

      {product.description !== undefined && (
        <p className="mt-1 text-sm text-[var(--text-muted)]">{product.description}</p>
      )}

      {!product.available && (
        <p className="mt-2 inline-block rounded bg-[var(--accent-tint)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          {fr.menu.unavailable}
        </p>
      )}

      {product.optionGroups.length > 0 && (
        <dl className="mt-3 space-y-1 border-t border-[var(--line-1)] pt-2 text-xs text-[var(--text-muted)]">
          {product.optionGroups.map((group) => (
            <div key={group.id} className="flex flex-wrap gap-x-1">
              <dt className="font-medium">{group.name} :</dt>
              <dd>
                {group.options
                  .map((option) =>
                    option.extraCostCents > 0
                      ? `${option.name} +${formatPriceCents(option.extraCostCents, currency)}`
                      : option.name,
                  )
                  .join(", ")}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {product.available && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-3 min-h-11 w-full rounded-md bg-[var(--structure-tint)] font-semibold text-[var(--structure)] hover:bg-[var(--accent-tint)]"
        >
          {fr.menu.add}
        </button>
      )}

      {sheetOpen && (
        <ProductSheet product={product} currency={currency} onAdd={add} onClose={() => setSheetOpen(false)} />
      )}
    </article>
  );
}
