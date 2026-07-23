import type { MenuCategory } from "@surplasse/shared";

import { ProductCard } from "./ProductCard";

type Props = {
  category: MenuCategory;
  currency: string;
  acceptingOrders: boolean;
};

export function CategorySection({ category, currency, acceptingOrders }: Props) {
  return (
    <section className="menu-category" aria-labelledby={`category-${category.id}`}>
      <div className="category-heading">
        <h2 id={`category-${category.id}`}>{category.name}</h2>
      </div>
      <ul className="category-products">
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
