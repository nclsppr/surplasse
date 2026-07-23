import { describe, expect, it } from "vitest";

import { createDomainLinks, createPagesDomainLinks } from "./domainLinks";

describe("createDomainLinks", () => {
  it("derives every external destination from central profile origins", () => {
    expect(
      createDomainLinks({
        onboardingUrl: "https://surplasse.test",
        dashboardUrl: "https://dashboard.surplasse.test",
        docsUrl: "https://docs.surplasse.test",
      }),
    ).toEqual({
      originalCreate: "https://surplasse.test/creer.html",
      dashboardLogin: "https://dashboard.surplasse.test/auth/login",
      docs: "https://docs.surplasse.test/",
      productVision: "https://docs.surplasse.test/produit/vision/",
      roadmap: "https://docs.surplasse.test/roadmap/",
    });
  });

  it("rejects missing or non-HTTPS origins instead of inventing a fallback", () => {
    expect(() =>
      createDomainLinks({
        onboardingUrl: "",
        dashboardUrl: "https://dashboard.surplasse.test",
        docsUrl: "https://docs.surplasse.test",
      }),
    ).toThrow(/VITE_ONBOARDING_URL is missing/u);

    expect(() =>
      createDomainLinks({
        onboardingUrl: "http://surplasse.test",
        dashboardUrl: "https://dashboard.surplasse.test",
        docsUrl: "https://docs.surplasse.test",
      }),
    ).toThrow(/HTTPS origin/u);
  });

  it("keeps every Pages destination inside the public project publication", () => {
    expect(
      createPagesDomainLinks(
        "https://nclsppr.github.io/surplasse/_experiments/untitled/onboarding/",
      ),
    ).toEqual({
      originalCreate: "https://nclsppr.github.io/surplasse/creer.html",
      dashboardLogin:
        "https://nclsppr.github.io/surplasse/_experiments/untitled/dashboard/",
      docs: "https://nclsppr.github.io/surplasse/docs/",
      productVision: "https://nclsppr.github.io/surplasse/docs/produit/vision/",
      roadmap: "https://nclsppr.github.io/surplasse/docs/roadmap/",
    });
  });

  it("rejects a Pages URL outside the explicit Onboarding2 directory", () => {
    expect(() =>
      createPagesDomainLinks("https://nclsppr.github.io/surplasse/_experiments/untitled/"),
    ).toThrow(/canonical HTTPS directory/u);
  });
});
