import { useState } from "react";
import { formatPriceCents } from "@surplasse/shared";
import type { MenuProduct } from "@surplasse/shared";
import { Badge, Button } from "@surplasse/design-system2";
import { Plus } from "lucide-react";

import { fr } from "../../../i18n/fr";
import { useCart } from "../../cart/hooks/useCart";
import type { CartOption } from "../../cart/hooks/useCart";
import { ProductSheet } from "./ProductSheet";

type Props = {
  product: MenuProduct;
  currency: string;
  acceptingOrders: boolean;
};

export function ProductCard({ product, currency, acceptingOrders }: Props) {
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
    <article className={`product-row ${product.available ? "" : "product-row-unavailable"}`}>
      <div className="product-copy">
        <div className="product-heading">
          <h3>{product.name}</h3>
          <p className="product-price">
          {formatPriceCents(product.priceCents, currency)}
          </p>
        </div>

        {product.description !== undefined ? <p className="product-description">{product.description}</p> : null}

        {!product.available ? <Badge tone="danger">{fr.menu.unavailable}</Badge> : null}

        {product.optionGroups.length > 0 ? (
          <dl className="product-options">
            {product.optionGroups.map((group) => (
              <div key={group.id}>
                <dt>{group.name}</dt>
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
        ) : null}
      </div>

      {product.available ? (
        <Button
          className="product-add"
          color="secondary"
          size="sm"
          iconLeading={<Plus aria-hidden="true" />}
          isDisabled={!acceptingOrders}
          onPress={() => setSheetOpen(true)}
        >
          {acceptingOrders ? fr.menu.add : fr.menu.orderIntakePausedAction}
        </Button>
      ) : null}

      {sheetOpen && (
        <ProductSheet
          product={product}
          currency={currency}
          acceptingOrders={acceptingOrders}
          onAdd={add}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </article>
  );
}
