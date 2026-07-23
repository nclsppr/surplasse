import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PausedPaymentNotice } from "./PausedPaymentNotice";

describe("PausedPaymentNotice", () => {
  it("explains the pause and exposes an explicit retry action", () => {
    const html = renderToStaticMarkup(<PausedPaymentNotice onRetry={vi.fn()} />);

    expect(html).toContain('role="alert"');
    expect(html).toContain("Aucun nouveau paiement ne peut démarrer");
    expect(html).toContain("Réessayer");
    expect(html).toContain("ui2-button-secondary");
  });
});
