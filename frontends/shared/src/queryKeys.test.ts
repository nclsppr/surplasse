import { describe, expect, it } from "vitest";

import { queryKeys } from "./queryKeys";

describe("queryKeys", () => {
  it("builds the current restaurateur session key", () => {
    expect(queryKeys.session()).toEqual(["session", "current"]);
  });

  it("scopes operational orders to an establishment", () => {
    expect(queryKeys.orderList("establishment-id")).toEqual([
      "order",
      "list",
      "establishment-id",
    ]);
  });

  it("scopes order intake to an establishment", () => {
    expect(queryKeys.orderIntake("establishment-id")).toEqual([
      "establishment",
      "establishment-id",
      "order-intake",
    ]);
  });
});
