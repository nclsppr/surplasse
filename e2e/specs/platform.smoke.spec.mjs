import { expect, test } from "@playwright/test";

import { resolveE2eTarget } from "../support/target.mjs";

const target = resolveE2eTarget();

test.describe("Platform availability", () => {
  test("edge identity and security headers are exposed", async ({ request }) => {
    const response = await request.get(
      new URL("/.well-known/surplasse-edge", target.onboardingUrl).toString(),
    );

    expect(response.status()).toBe(200);
    expect(await response.text()).toBe("surplasse-edge-v1");
    expect(response.headers()["strict-transport-security"]).toContain("max-age=31536000");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("backend readiness is up", async ({ request }) => {
    const response = await request.get(
      new URL("/q/health/ready", target.apiUrl).toString(),
    );

    expect(response.status()).toBe(200);
    const health = await response.json();
    expect(health.status).toBe("UP");
    expect(Array.isArray(health.checks)).toBe(true);
    expect(health.checks.length).toBeGreaterThan(0);
    expect(
      health.checks.some((check) => /database/u.test(check.name.toLowerCase())),
    ).toBe(true);
    for (const check of health.checks) {
      expect(check.status, check.name).toBe("UP");
    }
  });

  test("www redirects to the canonical onboarding origin", async ({ request }) => {
    const source = new URL("/__surplasse-e2e?probe=redirect", target.wwwUrl);
    const response = await request.get(source.toString(), { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(
      new URL(`${source.pathname}${source.search}`, target.onboardingUrl).toString(),
    );
  });

  test("unused app subdomain stays closed", async ({ request }) => {
    const response = await request.get(target.reservedAppUrl);

    expect(response.status()).toBe(503);
    expect(await response.text()).toContain("reserved but has no service");
  });
});
