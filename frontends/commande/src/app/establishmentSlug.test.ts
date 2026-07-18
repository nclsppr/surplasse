import { describe, expect, it } from "vitest";

import { resolveEstablishmentSlug } from "./establishmentSlug";

describe("resolveEstablishmentSlug", () => {
  it("resolves the slug from the mini-site subdomain in production", () => {
    expect(resolveEstablishmentSlug("le-cormoran.surplasse.com", undefined)).toBe("le-cormoran");
  });

  it("falls back to the configured slug on localhost", () => {
    expect(resolveEstablishmentSlug("localhost", "chez-marco")).toBe("chez-marco");
  });

  it("falls back to the demo establishment when nothing is configured", () => {
    expect(resolveEstablishmentSlug("localhost", undefined)).toBe("le-cormoran");
  });

  it("does not treat a reserved subdomain as an establishment", () => {
    expect(resolveEstablishmentSlug("dashboard.surplasse.com", undefined)).toBe("le-cormoran");
  });

  it("does not treat a nested subdomain as an establishment", () => {
    expect(resolveEstablishmentSlug("a.b.surplasse.com", undefined)).toBe("le-cormoran");
  });
});
