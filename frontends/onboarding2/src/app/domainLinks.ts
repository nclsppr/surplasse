export interface DomainOrigins {
  onboardingUrl: string;
  dashboardUrl: string;
  docsUrl: string;
}

export interface DomainLinks {
  originalCreate: string;
  dashboardLogin: string;
  docs: string;
  productVision: string;
  roadmap: string;
}

const PAGES_ONBOARDING_PATH = "/_experiments/untitled/onboarding/";

function requireHttpsOrigin(name: string, value: string): URL {
  if (value.trim() === "") {
    throw new Error(`${name} is missing from the selected domain profile`);
  }

  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new Error(`${name} must be an HTTPS origin without a path`);
  }

  return url;
}

export function createDomainLinks(origins: DomainOrigins): DomainLinks {
  const onboarding = requireHttpsOrigin("VITE_ONBOARDING_URL", origins.onboardingUrl);
  const dashboard = requireHttpsOrigin("VITE_DASHBOARD_URL", origins.dashboardUrl);
  const docs = requireHttpsOrigin("VITE_DOCS_URL", origins.docsUrl);

  return Object.freeze({
    originalCreate: new URL("/creer.html", onboarding).toString(),
    dashboardLogin: new URL("/auth/login", dashboard).toString(),
    docs: docs.toString(),
    productVision: new URL("/produit/vision/", docs).toString(),
    roadmap: new URL("/roadmap/", docs).toString(),
  });
}

export function createPagesDomainLinks(onboardingDemoUrl: string): DomainLinks {
  const onboardingDemo = new URL(onboardingDemoUrl);
  if (
    onboardingDemo.protocol !== "https:" ||
    onboardingDemo.username !== "" ||
    onboardingDemo.password !== "" ||
    onboardingDemo.port !== "" ||
    onboardingDemo.search !== "" ||
    onboardingDemo.hash !== "" ||
    !onboardingDemo.pathname.endsWith(PAGES_ONBOARDING_PATH)
  ) {
    throw new Error("The Pages Onboarding2 URL must be its canonical HTTPS directory.");
  }

  const publicationRoot = new URL("../../../", onboardingDemo);
  const docs = new URL("docs/", publicationRoot);
  return Object.freeze({
    originalCreate: new URL("creer.html", publicationRoot).toString(),
    dashboardLogin: new URL("../dashboard/", onboardingDemo).toString(),
    docs: docs.toString(),
    productVision: new URL("produit/vision/", docs).toString(),
    roadmap: new URL("roadmap/", docs).toString(),
  });
}
