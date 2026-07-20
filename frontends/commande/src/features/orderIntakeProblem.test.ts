import { ResponseError } from "@surplasse/shared";
import { describe, expect, it } from "vitest";

import { isOrderIntakePausedProblem } from "./orderIntakeProblem";

function conflict(type: string): ResponseError {
  return new ResponseError(
    new Response(JSON.stringify({ type, title: "Conflict", status: 409 }), {
      status: 409,
      headers: { "content-type": "application/problem+json" },
    }),
  );
}

describe("isOrderIntakePausedProblem", () => {
  const problemTypeBase = import.meta.env.VITE_PROBLEM_TYPE_BASE;

  it("recognizes the stable RFC 9457 order-intake type", async () => {
    await expect(
      isOrderIntakePausedProblem(conflict(`${problemTypeBase}order-intake-paused`)),
    ).resolves.toBe(true);
  });

  it("does not confuse another 409 with an intake pause", async () => {
    await expect(
      isOrderIntakePausedProblem(
        conflict("https://surplasse.com/problems/product-unavailable"),
      ),
    ).resolves.toBe(false);
  });

  it("rejects a non-canonical development-host identifier", async () => {
    await expect(
      isOrderIntakePausedProblem(
        conflict("https://surplasse.test/problems/order-intake-paused"),
      ),
    ).resolves.toBe(false);
  });
});
