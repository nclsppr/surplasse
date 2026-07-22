import { defineConfig, devices } from "@playwright/test";
import os from "node:os";

import { getE2eExecutionPaths, resolveE2eTarget } from "./support/target.mjs";

const target = resolveE2eTarget();
const paths = getE2eExecutionPaths(target.storageId);

export default defineConfig({
  testDir: "./specs",
  outputDir: paths.playwright,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["line"],
    [
      "allure-playwright",
      {
        resultsDir: paths.results,
        detail: true,
        environmentInfo: {
          target: target.id,
          target_kind: target.kind,
          base_domain: target.baseDomain,
          os_platform: os.platform(),
          os_release: os.release(),
          node_version: process.version,
        },
      },
    ],
  ],
  use: {
    baseURL: target.onboardingUrl,
    ignoreHTTPSErrors: target.ignoreHTTPSErrors,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      testIgnore: /commande\.smoke\.spec\.mjs/u,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      testMatch: /commande\.smoke\.spec\.mjs/u,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
