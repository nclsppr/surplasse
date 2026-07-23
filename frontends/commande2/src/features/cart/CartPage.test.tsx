import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CartCheckoutAction } from "./CartCheckoutAction";

describe("CartCheckoutAction", () => {
  it("keeps the cart visible while neutralizing checkout during a pause", () => {
    const html = renderToStaticMarkup(
      <CartCheckoutAction
        availability="paused"
        hasSession
        submitting={false}
        onCheckout={vi.fn()}
      />,
    );

    expect(html).toContain("Votre panier est conservé ici");
    expect(html).toContain('role="status"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("Commandes en pause");
    expect(html).toContain('aria-describedby="cart-order-intake-status"');
  });

  it("waits for the first availability read before enabling checkout", () => {
    const html = renderToStaticMarkup(
      <CartCheckoutAction
        availability="checking"
        hasSession
        submitting={false}
        onCheckout={vi.fn()}
      />,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Vérification de la disponibilité…");
    expect(html).toContain('disabled=""');
  });

  it("keeps the backend race fallback reachable when availability is unknown", () => {
    const html = renderToStaticMarkup(
      <CartCheckoutAction
        availability="unknown"
        hasSession
        submitting={false}
        onCheckout={vi.fn()}
      />,
    );

    expect(html).toContain("sera vérifiée à nouveau lors de la validation");
    expect(html).not.toContain('disabled=""');
  });
});
