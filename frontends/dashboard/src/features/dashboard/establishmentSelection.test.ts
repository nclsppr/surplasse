import type { RestaurateurEstablishment } from "@surplasse/shared";
import { describe, expect, it } from "vitest";

import {
  canonicalEstablishmentSearch,
  chooseAuthorizedEstablishmentId,
} from "./establishmentSelection";

const establishments: Array<RestaurateurEstablishment> = [
  { id: "establishment-a", name: "Le Cormoran", slug: "le-cormoran" },
  { id: "establishment-b", name: "La Jetée", slug: "la-jetee" },
];

describe("chooseAuthorizedEstablishmentId", () => {
  it("uses an authorized query selection before storage", () => {
    expect(
      chooseAuthorizedEstablishmentId(establishments, "establishment-b", "establishment-a"),
    ).toBe("establishment-b");
  });

  it("ignores unauthorized values and falls back to storage then the first establishment", () => {
    expect(
      chooseAuthorizedEstablishmentId(establishments, "outside-scope", "establishment-b"),
    ).toBe("establishment-b");
    expect(
      chooseAuthorizedEstablishmentId(establishments, "outside-scope", "also-outside-scope"),
    ).toBe("establishment-a");
  });

  it("returns no selection when the restaurateur has no establishment", () => {
    expect(chooseAuthorizedEstablishmentId([], "outside-scope", "outside-scope")).toBeNull();
  });
});

describe("canonicalEstablishmentSearch", () => {
  it("preserves unrelated parameters while replacing the establishment", () => {
    const current = new URLSearchParams("view=compact&establishment=outside-scope");

    expect(canonicalEstablishmentSearch(current, "establishment-a").toString()).toBe(
      "view=compact&establishment=establishment-a",
    );
    expect(current.get("establishment")).toBe("outside-scope");
  });

  it("removes the establishment parameter when no selection is available", () => {
    expect(
      canonicalEstablishmentSearch(new URLSearchParams("establishment=stale&view=compact"), null).toString(),
    ).toBe("view=compact");
  });
});
