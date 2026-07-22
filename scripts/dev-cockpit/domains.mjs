import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { loadDomainConfig } from "../../config/domains/load-domain-config.mjs";

export function loadDevelopmentUrls(repoRoot, options = {}) {
  const envPath = resolve(repoRoot, "config/domains/development.env");
  const fileExists = options.existsSync ?? existsSync;
  if (!fileExists(envPath)) {
    throw new Error(`Missing central domain profile: ${envPath}`);
  }

  const configLoader = options.loadDomainConfig ?? loadDomainConfig;
  const config = configLoader("development");
  if (!config.LOCAL_CONTROL_URL || !config.MAILPIT_URL || !config.REPORTS_URL || !config.GRAFANA_URL) {
    throw new Error(
      "development.env must define LOCAL_CONTROL_URL, MAILPIT_URL, REPORTS_URL and GRAFANA_URL for the local cockpit.",
    );
  }

  const reserved = new Set(config.RESERVED_SUBDOMAINS.split(","));
  for (const required of ["app", "admin", "local", "mail", "reports", "grafana"]) {
    if (!reserved.has(required)) {
      throw new Error(`development.env must reserve the ${required} subdomain.`);
    }
  }

  const urls = Object.freeze({
    cockpit: config.LOCAL_CONTROL_URL,
    backend: config.API_URL,
    commande: `${config.APP_SCHEME}://le-cormoran.${config.APP_BASE_DOMAIN}`,
    dashboard: config.DASHBOARD_URL,
    onboarding: config.ONBOARDING_URL,
    docs: config.DOCS_URL,
    mailpit: config.MAILPIT_URL,
    reports: config.REPORTS_URL,
    grafana: config.GRAFANA_URL,
    app: `${config.APP_SCHEME}://app.${config.APP_BASE_DOMAIN}`,
    admin: `${config.APP_SCHEME}://admin.${config.APP_BASE_DOMAIN}`,
  });

  return Object.freeze({
    urls,
    source: "config/domains/development.env",
    path: envPath,
    warnings: Object.freeze([]),
    baseDomain: config.APP_BASE_DOMAIN,
    certificateFile: resolve(repoRoot, ".certs", `${config.APP_BASE_DOMAIN}.pem`),
  });
}
