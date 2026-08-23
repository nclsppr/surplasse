import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const domainsDirectory = fileURLToPath(new URL(".", import.meta.url));

export const DOMAIN_CONFIG_KEYS = Object.freeze([
  "APP_SCHEME",
  "APP_BASE_DOMAIN",
  "APP_BASE_URL",
  "ONBOARDING_URL",
  "DASHBOARD_URL",
  "API_URL",
  "DOCS_URL",
  "MAILPIT_URL",
  "GRAFANA_URL",
  "PROBLEM_TYPE_BASE",
  "RESERVED_SUBDOMAINS",
]);

const DOMAIN_PROFILE_KEYS = Object.freeze([
  "APP_SCHEME",
  "APP_BASE_DOMAIN",
  "PROBLEM_TYPE_BASE",
  "RESERVED_SUBDOMAINS",
]);

const URL_KEYS = Object.freeze([
  "APP_BASE_URL",
  "ONBOARDING_URL",
  "DASHBOARD_URL",
  "API_URL",
  "DOCS_URL",
  "MAILPIT_URL",
  "GRAFANA_URL",
]);

const FORBIDDEN_FRONTEND_TOPOLOGY_OVERRIDES = Object.freeze([
  ...DOMAIN_CONFIG_KEYS.map((key) => `VITE_${key}`),
  "VITE_API_BASE_URL",
]);

const RESERVED_SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function loadDomainConfig(profile) {
  if (profile !== "development" && profile !== "production") {
    throw new Error(`Unknown domain profile: ${profile}`);
  }

  const source = readFileSync(`${domainsDirectory}${profile}.env`, "utf8");
  const config = deriveDomainConfig(parseDomainProfile(source, profile), profile);
  validateDomainConfig(config, profile);
  return Object.freeze(config);
}

export function loadFrontendDomainConfig(mode, viteEnvironment = {}) {
  const profile = mode === "production" ? "production" : "development";
  for (const key of FORBIDDEN_FRONTEND_TOPOLOGY_OVERRIDES) {
    if (Object.hasOwn(viteEnvironment, key)) {
      throw new Error(
        `${key} cannot override the ${profile} domain profile`,
      );
    }
  }
  return loadDomainConfig(profile);
}

export function frontendEnvironmentDefinitions(config) {
  const definitions = {};
  for (const key of DOMAIN_CONFIG_KEYS) {
    definitions[`import.meta.env.VITE_${key}`] = JSON.stringify(config[key]);
  }
  definitions["import.meta.env.VITE_API_BASE_URL"] = JSON.stringify(config.API_URL);
  return definitions;
}

export function createPagesDemoDomainConfig(config) {
  const origin = "https://pages.invalid";
  const pagesConfig = {
    ...config,
    APP_BASE_DOMAIN: "pages.invalid",
    APP_BASE_URL: origin,
    ONBOARDING_URL: origin,
    DASHBOARD_URL: origin,
    API_URL: origin,
    DOCS_URL: origin,
    MAILPIT_URL: "",
    GRAFANA_URL: "",
  };
  validateDomainConfig(pagesConfig, "pages-demo");
  return Object.freeze(pagesConfig);
}

export function allowedFrontendHosts(config) {
  return Object.freeze([config.APP_BASE_DOMAIN, `.${config.APP_BASE_DOMAIN}`]);
}

export function parseDomainProfile(source, profile) {
  let config;
  try {
    config = parseEnv(source);
  } catch (error) {
    throw new Error(`Invalid ${profile}.env: ${error.message}`);
  }
  rejectDuplicateAssignments(source, profile);
  for (const key of Object.keys(config)) {
    if (!DOMAIN_PROFILE_KEYS.includes(key)) {
      throw new Error(`Unknown domain setting ${key} in ${profile}.env`);
    }
  }

  for (const key of DOMAIN_PROFILE_KEYS) {
    if (!Object.hasOwn(config, key)) {
      throw new Error(`Missing domain setting ${key} in ${profile}.env`);
    }
  }
  return config;
}

function rejectDuplicateAssignments(source, profile) {
  const keys = new Set();
  for (const match of source.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gmu)) {
    const key = match[1];
    if (keys.has(key)) {
      throw new Error(`Duplicate domain setting ${key} in ${profile}.env`);
    }
    keys.add(key);
  }
}

function deriveDomainConfig(profileConfig, profile) {
  const scheme = profileConfig.APP_SCHEME;
  const domain = profileConfig.APP_BASE_DOMAIN;
  const development = profile === "development";
  return {
    ...profileConfig,
    APP_BASE_URL: `${scheme}://${domain}`,
    ONBOARDING_URL: `${scheme}://${domain}`,
    DASHBOARD_URL: `${scheme}://dashboard.${domain}`,
    API_URL: `${scheme}://api.${domain}`,
    DOCS_URL: `${scheme}://docs.${domain}`,
    MAILPIT_URL: development ? `${scheme}://mail.${domain}` : "",
    GRAFANA_URL: development ? `${scheme}://grafana.${domain}` : "",
  };
}

function validateDomainConfig(config, source) {
  if (config.APP_SCHEME !== "https") {
    throw new Error(`${source}: APP_SCHEME must be https`);
  }
  if (normalizeDomain(config.APP_BASE_DOMAIN) !== config.APP_BASE_DOMAIN) {
    throw new Error(`${source}: APP_BASE_DOMAIN must be a normalized hostname`);
  }
  if (!config.APP_BASE_DOMAIN.includes(".")) {
    throw new Error(`${source}: APP_BASE_DOMAIN must contain a public suffix`);
  }
  for (const key of URL_KEYS) {
    const value = config[key];
    if (value === "") {
      if (!["MAILPIT_URL", "GRAFANA_URL"].includes(key)) {
        throw new Error(`${source}: ${key} cannot be empty`);
      }
      continue;
    }
    const url = new URL(value);
    if (url.protocol !== `${config.APP_SCHEME}:` || url.pathname !== "/" || url.search || url.hash) {
      throw new Error(`${source}: ${key} must be an HTTPS origin without a path`);
    }
    if (url.hostname !== config.APP_BASE_DOMAIN && !url.hostname.endsWith(`.${config.APP_BASE_DOMAIN}`)) {
      throw new Error(`${source}: ${key} must belong to APP_BASE_DOMAIN`);
    }
  }

  const problemTypeBase = new URL(config.PROBLEM_TYPE_BASE);
  if (
    problemTypeBase.protocol !== "https:" ||
    problemTypeBase.pathname !== "/problems/" ||
    problemTypeBase.search ||
    problemTypeBase.hash ||
    problemTypeBase.username ||
    problemTypeBase.password ||
    problemTypeBase.port
  ) {
    throw new Error(`${source}: PROBLEM_TYPE_BASE must be a canonical HTTPS /problems/ URL`);
  }

  const reserved = config.RESERVED_SUBDOMAINS.split(",");
  if (reserved.length === 0 || reserved.some((label) => !RESERVED_SUBDOMAIN_PATTERN.test(label))) {
    throw new Error(`${source}: RESERVED_SUBDOMAINS contains an invalid label`);
  }
  if (new Set(reserved).size !== reserved.length) {
    throw new Error(`${source}: RESERVED_SUBDOMAINS contains duplicates`);
  }
}

function normalizeDomain(value) {
  return value.trim().toLowerCase().replace(/\.$/u, "");
}
