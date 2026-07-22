import { expect, test } from "@playwright/test";

import { resolveE2eTarget } from "../support/target.mjs";

const target = resolveE2eTarget();

test("onboarding landing exposes its primary content and configured dashboard link", async ({
  page,
}) => {
  const response = await page.goto(target.onboardingUrl);

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Surplasse/u);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Vos commandes. Vos clients. Votre restaurant.",
    }),
  ).toBeVisible();

  const logo = page.locator(".sp-brand__logo");
  await expect(logo).toBeVisible();
  expect(
    await logo.evaluate((image) => image.complete && image.naturalWidth > 0),
  ).toBe(true);

  const dashboardLink = page.getByRole("link", { name: "Se connecter" });
  await expect(dashboardLink).toBeVisible();
  await expect(dashboardLink).toHaveAttribute(
    "href",
    `${target.dashboardUrl}/auth/login`,
  );
});
