import { describe, expect, it } from "vitest";

import { fr } from "./fr";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
}

describe("French interface catalog", () => {
  it("contains no empty interface string", () => {
    expect(collectStrings(fr).every((value) => value.trim().length > 0)).toBe(true);
  });

  it("covers every state of the interactive service preview", () => {
    expect(Object.keys(fr.serviceDemo.states)).toEqual([
      "paid",
      "accepted",
      "preparing",
      "ready",
      "served",
    ]);
  });
});
