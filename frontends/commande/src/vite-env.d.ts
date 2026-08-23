/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_SCHEME: string;
  readonly VITE_APP_BASE_DOMAIN: string;
  readonly VITE_APP_BASE_URL: string;
  readonly VITE_ONBOARDING_URL: string;
  readonly VITE_DASHBOARD_URL: string;
  readonly VITE_API_URL: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DOCS_URL: string;
  readonly VITE_MAILPIT_URL: string;
  readonly VITE_GRAFANA_URL: string;
  readonly VITE_PROBLEM_TYPE_BASE: string;
  readonly VITE_RESERVED_SUBDOMAINS: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_SURPLASSE_RELEASE_MODE: "development" | "testers" | "public";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
