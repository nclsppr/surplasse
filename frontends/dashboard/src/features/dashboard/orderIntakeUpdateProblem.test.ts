import { ResponseError } from "@surplasse/shared";
import { describe, expect, it } from "vitest";

import {
  normalizeOrderIntakeUpdateError,
  OrderIntakeUpdateProblem,
  type OrderIntakeUpdateProblemReason,
} from "./orderIntakeUpdateProblem";

function problem(type: string): ResponseError {
  return new ResponseError(
    new Response(JSON.stringify({ type, detail: "This text is deliberately ignored." }), {
      status: 422,
      headers: { "content-type": "application/problem+json" },
    }),
  );
}

describe("normalizeOrderIntakeUpdateError", () => {
  const problemTypeBase = import.meta.env.VITE_PROBLEM_TYPE_BASE;

  it.each<[string, OrderIntakeUpdateProblemReason]>([
    ["order-intake-establishment-not-active", "establishment_not_active"],
    ["order-intake-configuration-unavailable", "configuration_unavailable"],
    ["order-intake-payments-unavailable", "payments_unavailable"],
  ])("maps the stable %s type without reading detail", async (suffix, reason) => {
    await expect(
      normalizeOrderIntakeUpdateError(problem(`${problemTypeBase}${suffix}`)),
    ).resolves.toMatchObject({ reason });
  });

  it("keeps a safe generic prerequisite fallback for an unknown 422 type", async () => {
    await expect(
      normalizeOrderIntakeUpdateError(problem("https://surplasse.com/problems/new-prerequisite")),
    ).resolves.toMatchObject({ reason: "prerequisites_unavailable" });
  });

  it("rejects a non-canonical development-host identifier", async () => {
    await expect(
      normalizeOrderIntakeUpdateError(
        problem("https://surplasse.test/problems/order-intake-payments-unavailable"),
      ),
    ).resolves.toMatchObject({ reason: "prerequisites_unavailable" });
  });

  it("preserves non-422 failures as uncertain outcomes", async () => {
    const networkError = new TypeError("Network request failed");

    await expect(normalizeOrderIntakeUpdateError(networkError)).resolves.toBe(networkError);
    expect(networkError).not.toBeInstanceOf(OrderIntakeUpdateProblem);
  });
});
