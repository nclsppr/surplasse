import { renderToStaticMarkup } from "react-dom/server";
import { ProductionTestersNotice } from "@surplasse/shared";
import { describe, expect, it } from "vitest";

describe("ProductionTestersNotice", () => {
  it("limits the release to test data without charging a real card", () => {
    const markup = renderToStaticMarkup(<ProductionTestersNotice mode="testers" />);

    expect(markup).toContain("Production réservée aux testeurs");
    expect(markup).toContain("Commandes et données de test uniquement");
    expect(markup).toContain("Stripe ne débite aucune carte bancaire réelle");
  });

  it("is absent from development and future public releases", () => {
    expect(renderToStaticMarkup(<ProductionTestersNotice mode="development" />)).toBe("");
    expect(renderToStaticMarkup(<ProductionTestersNotice mode="public" />)).toBe("");
  });

  it("fails closed when the compiled release mode is invalid", () => {
    const markup = renderToStaticMarkup(
      <ProductionTestersNotice mode={"invalid" as never} />,
    );

    expect(markup).toContain("Production réservée aux testeurs");
  });
});
