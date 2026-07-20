import { describe, expect, it } from "vitest";

import { fr } from "./fr";

describe("French accessibility labels", () => {
  it("names quantity controls with their action and product", () => {
    expect(fr.cart.decreaseQuantity("Burrata")).toBe("Diminuer la quantité de Burrata");
    expect(fr.cart.increaseQuantity("Burrata")).toBe("Augmenter la quantité de Burrata");
  });
});
