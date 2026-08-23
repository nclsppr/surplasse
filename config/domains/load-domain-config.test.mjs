import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import {
  allowedFrontendHosts,
  createPagesDemoDomainConfig,
  frontendEnvironmentDefinitions,
  loadDomainConfig,
  loadFrontendDomainConfig,
  parseDomainProfile,
} from "./load-domain-config.mjs";

test("development exposes the complete local HTTPS topology", () => {
  const config = loadDomainConfig("development");

  assert.equal(config.APP_BASE_DOMAIN, "surplasse.test");
  assert.equal(config.API_URL, "https://api.surplasse.test");
  assert.equal(config.PROBLEM_TYPE_BASE, "https://surplasse.com/problems/");
  assert.equal(config.GRAFANA_URL, "https://grafana.surplasse.test");
  assert.equal(
    config.RESERVED_SUBDOMAINS,
    "www,api,dashboard,docs,app,admin,local,mail,autoconfig,autodiscover,mta-sts,smtp,imap,pop,pop3,webmail,status,reports,grafana",
  );
});

test("domain profiles store one base domain and derive every application URL", () => {
  for (const profile of ["development", "production"]) {
    const source = readFileSync(new URL(`./${profile}.env`, import.meta.url), "utf8");
    assert.match(source, /^APP_BASE_DOMAIN=/mu);
    assert.doesNotMatch(
      source,
      /^(?:APP_BASE_URL|ONBOARDING_URL|DASHBOARD_URL|API_URL|DOCS_URL|MAILPIT_URL|GRAFANA_URL)=/mu,
    );
  }
});

test("production keeps development-only services disabled", () => {
  const config = loadFrontendDomainConfig("production");

  assert.equal(config.APP_BASE_DOMAIN, "surplasse.com");
  assert.equal(config.API_URL, "https://api.surplasse.com");
  assert.equal(config.PROBLEM_TYPE_BASE, "https://surplasse.com/problems/");
  assert.equal(config.MAILPIT_URL, "");
  assert.equal(config.GRAFANA_URL, "");
});

test("frontend topology overrides fail closed", () => {
  for (const key of ["VITE_APP_BASE_DOMAIN", "VITE_API_BASE_URL", "VITE_DASHBOARD_URL"]) {
    assert.throws(
      () => loadFrontendDomainConfig("development", { [key]: "https://override.invalid" }),
      new RegExp(`${key} cannot override the development domain profile`, "u"),
    );
  }

  const config = loadFrontendDomainConfig("development", {
    VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_public",
  });
  assert.deepEqual(allowedFrontendHosts(config), ["surplasse.test", ".surplasse.test"]);
});

test("frontend definitions expose the generated API alias", () => {
  const definitions = frontendEnvironmentDefinitions(loadDomainConfig("development"));

  assert.equal(
    definitions["import.meta.env.VITE_API_BASE_URL"],
    JSON.stringify("https://api.surplasse.test"),
  );
});

test("Pages demos replace local topology with a non-routable neutral profile", () => {
  const development = loadDomainConfig("development");
  const pages = createPagesDemoDomainConfig(development);
  const definitions = frontendEnvironmentDefinitions(pages);

  assert.equal(pages.APP_BASE_DOMAIN, "pages.invalid");
  assert.equal(pages.API_URL, "https://pages.invalid");
  assert.equal(pages.PROBLEM_TYPE_BASE, "https://surplasse.com/problems/");
  assert.equal(development.APP_BASE_DOMAIN, "surplasse.test");
  assert.doesNotMatch(JSON.stringify(definitions), /\.test\b/u);
});

test("unknown profiles fail closed", () => {
  assert.throws(() => loadDomainConfig("staging"), /Unknown domain profile/u);
});

test("domain profiles reject duplicate settings", () => {
  assert.throws(
    () => parseDomainProfile(
      "APP_SCHEME=https\nAPP_SCHEME=http\nAPP_BASE_DOMAIN=example.test\nPROBLEM_TYPE_BASE=https://surplasse.com/problems/\nRESERVED_SUBDOMAINS=api\n",
      "fixture",
    ),
    /Duplicate domain setting APP_SCHEME/u,
  );
});

test("onboarding refuses direct loopback previews", () => {
  for (const hostname of ["localhost", "127.0.0.1", "::1", "[::1]"]) {
    assert.throws(
      () => onboardingRuntimeConfig(hostname),
      /Direct loopback previews are forbidden/u,
    );
  }
});

test("onboarding selects development only from the configured local domain", () => {
  for (const hostname of ["surplasse.test", "le-cormoran.surplasse.test"]) {
    const { config, releaseMode } = onboardingRuntimeConfig(hostname);
    assert.equal(config.PROFILE, "development");
    assert.equal(config.APP_BASE_DOMAIN, "surplasse.test");
    assert.equal(config.API_URL, "https://api.surplasse.test");
    assert.equal(config.SURPLASSE_RELEASE_MODE, "development");
    assert.equal(releaseMode, "development");
  }
});

test("onboarding exposes the versioned tester notice mode on production hosts", () => {
  const { config, releaseMode } = onboardingRuntimeConfig("surplasse.com");

  assert.equal(config.PROFILE, "production");
  assert.equal(config.SURPLASSE_RELEASE_MODE, "testers");
  assert.equal(releaseMode, "testers");
});

test("onboarding keeps the tester notice visible until an explicit safe mode loads", () => {
  const stylesheet = readFileSync(
    new URL("../../frontends/onboarding/index.css", import.meta.url),
    "utf8",
  );
  assert.match(
    stylesheet,
    /\.production-testers-notice\s*\{[^}]*display:\s*grid;/su,
  );
  assert.match(
    stylesheet,
    /data-surplasse-release-mode="development"[^}]*data-surplasse-release-mode="public"[^}]*display:\s*none;/su,
  );

  for (const page of ["connect.html", "creer.html"]) {
    const source = readFileSync(
      new URL(`../../frontends/onboarding/${page}`, import.meta.url),
      "utf8",
    );
    assert.match(source, /\.production-testers-notice\{display:grid;/u);
    assert.match(source, /data-surplasse-release-mode="development"/u);
    assert.match(source, /data-surplasse-release-mode="public"/u);
  }
});

test("onboarding refuses unknown public hosts instead of falling back to production", () => {
  assert.throws(
    () => onboardingRuntimeConfig("preview.example.net"),
    /Hostname does not belong to a configured domain profile/u,
  );
});

test("backend wrapper exports one coherent profile without Java URL defaults", () => {
  const script = fileURLToPath(
    new URL("../../scripts/run-with-domain-profile.sh", import.meta.url),
  );
  const command = [
    "printf '%s\\n' \"$APP_BASE_DOMAIN\" \"$SURPLASSE_PLATFORM_API_URL\" \"$ONBOARDING_URL\" \"$SURPLASSE_PLATFORM_DASHBOARD_URL\" \"$SURPLASSE_PLATFORM_PROBLEM_TYPE_BASE\" \"$GRAFANA_URL\" \"$CORS_PUBLIC_ORIGINS\"",
  ];

  const development = execFileSync(script, ["development", "bash", "-c", ...command], {
    encoding: "utf8",
  }).trim().split("\n");
  const production = execFileSync(script, ["production", "bash", "-c", ...command], {
    encoding: "utf8",
  }).trim().split("\n");

  assert.deepEqual(development, [
    "surplasse.test",
    "https://api.surplasse.test",
    "https://surplasse.test",
    "https://dashboard.surplasse.test",
    "https://surplasse.com/problems/",
    "https://grafana.surplasse.test",
    "https://surplasse.test,/https:\\/\\/[a-z0-9-]+\\.surplasse\\.test/",
  ]);
  assert.deepEqual(production, [
    "surplasse.com",
    "https://api.surplasse.com",
    "https://surplasse.com",
    "https://dashboard.surplasse.com",
    "https://surplasse.com/problems/",
    "",
    "https://surplasse.com,/https:\\/\\/[a-z0-9-]+\\.surplasse\\.com/",
  ]);
});

test("backend CORS stays public and without credentials in every runtime profile", () => {
  const properties = readFileSync(
    new URL("../../backend/application/src/main/resources/application.properties", import.meta.url),
    "utf8",
  );

  for (const profile of ["dev", "prod", "test"]) {
    assert.match(
      properties,
      new RegExp(`%${profile}\\.quarkus\\.http\\.cors\\.origins=\\$\\{CORS_PUBLIC_ORIGINS\\}`, "u"),
    );
    assert.match(
      properties,
      new RegExp(`%${profile}\\.quarkus\\.http\\.cors\\.access-control-allow-credentials=false`, "u"),
    );
  }
  assert.doesNotMatch(properties, /access-control-allow-credentials=true/u);
});

test("backend development mailer honors the injected SMTP service", () => {
  const properties = readFileSync(
    new URL("../../backend/application/src/main/resources/application.properties", import.meta.url),
    "utf8",
  );

  assert.match(properties, /^%dev\.quarkus\.mailer\.host=\$\{SMTP_HOST:localhost\}$/mu);
  assert.match(properties, /^%dev\.quarkus\.mailer\.port=\$\{SMTP_PORT:1025\}$/mu);
  assert.match(
    properties,
    /^%dev\.quarkus\.mailer\.start-tls=\$\{SMTP_START_TLS:DISABLED\}$/mu,
  );
});

test("runtime configuration code contains no hard-coded Surplasse environment", () => {
  const runtimeConfigurationFiles = [
    "../../backend/application/src/main/resources/application.properties",
    "../../backend/common/src/main/java/com/surplasse/common/config/PlatformConfig.java",
    "../../backend/identity/src/main/java/com/surplasse/identity/config/IdentityConfig.java",
    "../../frontends/commande/src/app/api.ts",
    "../../frontends/dashboard/src/app/runtime.ts",
  ];

  for (const relativePath of runtimeConfigurationFiles) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.doesNotMatch(source, /surplasse\.(?:test|com)\b/u, relativePath);
  }
});

test("browser runtime code contains no loopback URL literal", () => {
  const browserRuntimeFiles = [
    "../../frontends/commande/src/app/api.ts",
    "../../frontends/commande/src/app/establishmentSlug.ts",
    "../../frontends/dashboard/src/app/runtime.ts",
    "../../frontends/onboarding/connect.js",
  ];

  for (const relativePath of browserRuntimeFiles) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.doesNotMatch(source, /(?:localhost|127\.0\.0\.1|\[?::1\]?)/u, relativePath);
  }
});

test("generated API clients cannot fall back to a hard-coded environment", () => {
  const runtime = readFileSync(
    new URL("../../frontends/shared/src/api/generated/runtime.ts", import.meta.url),
    "utf8",
  );

  assert.match(runtime, /export const BASE_PATH = "";/u);
  assert.doesNotMatch(runtime, /(?:localhost|surplasse\.(?:test|com))/u);
});

function onboardingRuntimeConfig(hostname) {
  const source = readFileSync(
    new URL("../../frontends/onboarding/runtime-config.js", import.meta.url),
    "utf8",
  );
  const window = { location: { hostname } };
  const document = { documentElement: { dataset: {} } };
  runInNewContext(source, { document, window });
  return {
    config: window.SURPLASSE_DOMAIN_CONFIG,
    releaseMode: document.documentElement.dataset.surplasseReleaseMode,
  };
}
