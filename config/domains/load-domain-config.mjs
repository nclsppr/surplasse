import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const domainsDirectory = fileURLToPath(new URL(".", import.meta.url));

export const DOMAIN_CONFIG_KEYS = Object.freeze([
  "APP_SCHEME",
  "APP_BASE_DOMAIN",
  "APP_BASE_URL",
  "ONBOARDING_URL",
  "DASHBOARD_URL",
  "API_URL",
  "LOCAL_CONTROL_URL",
  "DOCS_URL",
  "MAILPIT_URL",
  "COOKIE_DOMAIN",
  "RESERVED_SUBDOMAINS",
]);

const URL_KEYS = Object.freeze([
  "APP_BASE_URL",
  "ONBOARDING_URL",
  "DASHBOARD_URL",
  "API_URL",
  "LOCAL_CONTROL_URL",
  "DOCS_URL",
  "MAILPIT_URL",
]);

const RESERVED_SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function loadDomainConfig(profile) {
  if (profile !== "development" && profile !== "production") {
    throw new Error(`Unknown domain profile: ${profile}`);
  }

  const source = readFileSync(`${domainsDirectory}${profile}.env`, "utf8");
  const config = parseDotenv(source, profile);
  validateDomainConfig(config, profile);
  return Object.freeze(config);
}

export function loadFrontendDomainConfig(mode, viteEnvironment = {}) {
  const profile = mode === "production" ? "production" : "development";
  const base = loadDomainConfig(profile);
  return configureFrontendDomainConfig(base, viteEnvironment, profile);
}

export function configureFrontendDomainConfig(
  base,
  viteEnvironment = {},
  source = "custom",
) {
  const scheme = override(viteEnvironment, "VITE_APP_SCHEME", base.APP_SCHEME);
  const baseDomain = normalizeDomain(
    override(viteEnvironment, "VITE_APP_BASE_DOMAIN", base.APP_BASE_DOMAIN),
  );
  const topologyChanged = scheme !== base.APP_SCHEME || baseDomain !== base.APP_BASE_DOMAIN;
  const profileTopology = topologyChanged
    ? {
        APP_BASE_URL: `${scheme}://${baseDomain}`,
        ONBOARDING_URL: `${scheme}://${baseDomain}`,
        DASHBOARD_URL: `${scheme}://dashboard.${baseDomain}`,
        API_URL: `${scheme}://api.${baseDomain}`,
        LOCAL_CONTROL_URL:
          base.LOCAL_CONTROL_URL === "" ? "" : `${scheme}://local.${baseDomain}`,
        DOCS_URL: `${scheme}://docs.${baseDomain}`,
        MAILPIT_URL: base.MAILPIT_URL === "" ? "" : `${scheme}://mail.${baseDomain}`,
      }
    : base;

  const derived = {
    ...base,
    APP_SCHEME: scheme,
    APP_BASE_DOMAIN: baseDomain,
    APP_BASE_URL: profileTopology.APP_BASE_URL,
    ONBOARDING_URL: profileTopology.ONBOARDING_URL,
    DASHBOARD_URL: profileTopology.DASHBOARD_URL,
    API_URL: profileTopology.API_URL,
    LOCAL_CONTROL_URL: profileTopology.LOCAL_CONTROL_URL,
    DOCS_URL: profileTopology.DOCS_URL,
    MAILPIT_URL: profileTopology.MAILPIT_URL,
    COOKIE_DOMAIN: "",
  };

  for (const key of URL_KEYS) {
    derived[key] = override(viteEnvironment, `VITE_${key}`, derived[key]);
  }
  derived.API_URL = override(viteEnvironment, "VITE_API_BASE_URL", derived.API_URL);
  derived.RESERVED_SUBDOMAINS = override(
    viteEnvironment,
    "VITE_RESERVED_SUBDOMAINS",
    derived.RESERVED_SUBDOMAINS,
  );

  validateDomainConfig(derived, `${source} frontend`);
  return Object.freeze(derived);
}

export function frontendEnvironmentDefinitions(config) {
  const definitions = {};
  for (const key of DOMAIN_CONFIG_KEYS) {
    if (key !== "COOKIE_DOMAIN") {
      definitions[`import.meta.env.VITE_${key}`] = JSON.stringify(config[key]);
    }
  }
  definitions["import.meta.env.VITE_API_BASE_URL"] = JSON.stringify(config.API_URL);
  return definitions;
}

export function allowedFrontendHosts(config) {
  return Object.freeze([config.APP_BASE_DOMAIN, `.${config.APP_BASE_DOMAIN}`]);
}

function parseDotenv(source, profile) {
  const config = {};
  for (const [index, rawLine] of source.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new Error(`Invalid ${profile}.env line ${index + 1}`);
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!DOMAIN_CONFIG_KEYS.includes(key)) {
      throw new Error(`Unknown domain setting ${key} in ${profile}.env`);
    }
    if (Object.hasOwn(config, key)) {
      throw new Error(`Duplicate domain setting ${key} in ${profile}.env`);
    }
    config[key] = value;
  }

  for (const key of DOMAIN_CONFIG_KEYS) {
    if (!Object.hasOwn(config, key)) {
      throw new Error(`Missing domain setting ${key} in ${profile}.env`);
    }
  }
  return config;
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
  if (config.COOKIE_DOMAIN !== "") {
    throw new Error(`${source}: COOKIE_DOMAIN must stay empty for host-only cookies`);
  }

  for (const key of URL_KEYS) {
    const value = config[key];
    if (value === "") {
      if (key !== "LOCAL_CONTROL_URL" && key !== "MAILPIT_URL") {
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

function override(environment, name, fallback) {
  const value = environment[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}
