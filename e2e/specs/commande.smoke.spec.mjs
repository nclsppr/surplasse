import { expect, test } from "@playwright/test";

import { resolveE2eTarget } from "../support/target.mjs";

const target = resolveE2eTarget();

test("configured establishment menu is readable without creating a table session", async ({
  page,
}) => {
  test.skip(
    !target.establishmentUrl,
    "SURPLASSE_E2E_ESTABLISHMENT_SLUG is not configured for this target.",
  );

  const mutatingRequests = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      mutatingRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  const response = await page.goto(target.establishmentUrl);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.getByRole("heading", { level: 2 }).count()).toBeGreaterThan(0);
  expect(await page.locator("main article").count()).toBeGreaterThan(0);
  expect(mutatingRequests).toEqual([]);
});
