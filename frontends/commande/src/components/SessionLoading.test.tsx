import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SessionLoading } from "./SessionLoading";

describe("SessionLoading", () => {
  it("exposes an accessible busy status while the visual skeleton stays decorative", () => {
    const markup = renderToStaticMarkup(<SessionLoading />);

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Ouverture de la carte...");
    expect(markup).toContain('aria-hidden="true"');
  });
});
