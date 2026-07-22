import { expect, test } from "@playwright/test";

import { resolveE2eTarget } from "../support/target.mjs";

const target = resolveE2eTarget();

test("unauthenticated dashboard access leads to login without sending a magic link", async ({
  page,
}) => {
  const response = await page.goto(`${target.dashboardUrl}/service`);

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(`${target.dashboardUrl}/auth/login`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Heureux de vous revoir" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Adresse email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recevoir mon lien" })).toBeEnabled();
});
