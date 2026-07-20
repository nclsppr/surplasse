import type { MenuCategory } from "@surplasse/shared";

import { ProductCard } from "./ProductCard";

type Props = {
  category: MenuCategory;
  currency: string;
  acceptingOrders: boolean;
};

export function CategorySection({ category, currency, acceptingOrders }: Props) {
  return (
    <section aria-labelledby={`category-${category.id}`}>
      <h2
        id={`category-${category.id}`}
        className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]"
      >
        {category.name}
      </h2>
      <ul className="space-y-3">
        {category.products.map((product) => (
          <li key={product.id}>
            <ProductCard
              product={product}
              currency={currency}
              acceptingOrders={acceptingOrders}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
