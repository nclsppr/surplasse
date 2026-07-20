import { describe, expect, it } from "vitest";

import { resolveEstablishmentSlug } from "./establishmentSlug";

const RESERVED = "www,api,dashboard,docs,app,admin,local,mail";

function resolve(hostname: string, baseDomain = "surplasse.test"): string {
  return resolveEstablishmentSlug(hostname, {
    baseDomain,
    reservedSubdomains: RESERVED,
  });
}

describe("resolveEstablishmentSlug", () => {
  it("resolves a direct local establishment subdomain", () => {
    expect(resolve("le-cormoran.surplasse.test")).toBe("le-cormoran");
  });

  it("uses the same logic with the configured production domain", () => {
    expect(resolve("le-cormoran.surplasse.com", "surplasse.com")).toBe("le-cormoran");
  });

  it("normalizes DNS casing and a trailing dot", () => {
    expect(resolve("Chez-Paul.Surplasse.Test.")).toBe("chez-paul");
  });

  it("refuses hosts outside the configured platform domain", () => {
    expect(() => resolve("preview.example")).toThrow(/outside the configured platform domain/u);
  });

  it.each(["dashboard", "api", "app", "admin", "local", "mail"])(
    "does not treat the reserved %s subdomain as an establishment",
    (reserved) => {
      expect(() => resolve(`${reserved}.surplasse.test`)).toThrow(/invalid or reserved/u);
    },
  );

  it("does not treat a nested subdomain as an establishment", () => {
    expect(() => resolve("a.b.surplasse.test")).toThrow(/invalid or reserved/u);
  });

  it.each([
    "restaurant-surplasse.test",
    "restaurant.surplasse.test.example",
    "surplasse.test.example",
  ])("rejects the deceptive hostname %s", (hostname) => {
    expect(() => resolve(hostname)).toThrow(/outside the configured platform domain/u);
  });

  it.each(["-restaurant.surplasse.test", "restaurant-.surplasse.test"])(
    "rejects the invalid slug in %s",
    (hostname) => {
      expect(() => resolve(hostname)).toThrow(/invalid or reserved/u);
    },
  );
});
