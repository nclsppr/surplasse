import type { DashboardOrder, OrderPage } from "@surplasse/shared";
import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { applyOrderStatusResult, nextOrderStatus } from "./orderStatus";

function order(status: DashboardOrder["status"], type: DashboardOrder["type"] = "on_site"): DashboardOrder {
  return {
    id: "0d9e8c7b-6a5f-4e3d-8c2b-1a0f9e8d7c6b",
    displayNumber: "17",
    status,
    type,
    tableLabel: type === "on_site" ? "Table 4" : undefined,
    lines: [],
    totalCents: 1600,
    currency: "EUR",
    createdAt: "2026-07-19T12:34:56Z",
  };
}

function pages(item: DashboardOrder): InfiniteData<OrderPage> {
  return {
    pages: [{ items: [item], hasMore: false }],
    pageParams: [undefined],
  };
}

describe("order status workflow", () => {
  it("selects the next valid staff action", () => {
    expect(nextOrderStatus(order("paid"))).toBe("accepted");
    expect(nextOrderStatus(order("accepted"))).toBe("preparing");
    expect(nextOrderStatus(order("preparing"))).toBe("ready");
    expect(nextOrderStatus(order("ready"))).toBe("served");
    expect(nextOrderStatus(order("ready", "takeaway"))).toBe("picked_up");
  });

  it("moves an operational order in the cached board", () => {
    const original = pages(order("paid"));

    const updated = applyOrderStatusResult(original, {
      id: original.pages[0].items[0].id,
      status: "accepted",
    });

    expect(updated?.pages[0].items[0].status).toBe("accepted");
    expect(original.pages[0].items[0].status).toBe("paid");
  });

  it("removes a terminal order from the cached board", () => {
    const original = pages(order("ready"));

    const updated = applyOrderStatusResult(original, {
      id: original.pages[0].items[0].id,
      status: "served",
    });

    expect(updated?.pages[0].items).toEqual([]);
  });
});
