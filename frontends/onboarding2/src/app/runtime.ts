import { createDomainLinks, createPagesDomainLinks } from "./domainLinks";

export const pagesDemoEnabled = import.meta.env.VITE_UI2_PAGES_DEMO === "true";

export const domainLinks = pagesDemoEnabled
  ? createPagesDomainLinks(new URL(import.meta.env.BASE_URL, window.location.origin).toString())
  : createDomainLinks({
      onboardingUrl: import.meta.env.VITE_ONBOARDING_URL,
      dashboardUrl: import.meta.env.VITE_DASHBOARD_URL,
      docsUrl: import.meta.env.VITE_DOCS_URL,
    });
