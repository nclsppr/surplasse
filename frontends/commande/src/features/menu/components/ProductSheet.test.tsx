import { renderToStaticMarkup } from "react-dom/server";
import type { MenuProduct } from "@surplasse/shared";
import { describe, expect, it, vi } from "vitest";

import { ProductSheet } from "./ProductSheet";

const product: MenuProduct = {
  id: "burrata",
  name: "Burrata des Pouilles",
  description: "Tomates confites et basilic",
  priceCents: 1300,
  available: true,
  optionGroups: [],
};

describe("ProductSheet", () => {
  it("renders a native dialog with an accessible name and initial focus target", () => {
    const markup = renderToStaticMarkup(
      <ProductSheet product={product} currency="EUR" onAdd={vi.fn()} onClose={vi.fn()} />,
    );

    expect(markup).toContain("<dialog");
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain("aria-describedby=");
    expect(markup).toContain("autofocus");
    expect(markup).toContain(">Fermer</button>");
  });
});
