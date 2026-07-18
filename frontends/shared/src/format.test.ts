import { describe, expect, it } from "vitest";

import { formatPriceCents } from "./format";

// Intl renders narrow no-break spaces; normalize them for readable assertions.
function normalized(value: string): string {
  return value.replace(/[  ]/g, " ");
}

describe("formatPriceCents", () => {
  it("formats a whole euro amount with two decimals", () => {
    expect(normalized(formatPriceCents(400, "EUR"))).toBe("4,00 €");
  });

  it("formats cents into a comma-separated decimal part", () => {
    expect(normalized(formatPriceCents(1850, "EUR"))).toBe("18,50 €");
  });

  it("formats zero as a real price, not an empty string", () => {
    expect(normalized(formatPriceCents(0, "EUR"))).toBe("0,00 €");
  });

  it("groups thousands the French way", () => {
    expect(normalized(formatPriceCents(123_456, "EUR"))).toBe("1 234,56 €");
  });
});
