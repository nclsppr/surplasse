import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import {
  allowedFrontendHosts,
  configureFrontendDomainConfig,
  frontendEnvironmentDefinitions,
  loadDomainConfig,
  loadFrontendDomainConfig,
} from "./load-domain-config.mjs";

test("development exposes the complete local HTTPS topology", () => {
  const config = loadDomainConfig("development");

  assert.equal(config.APP_BASE_DOMAIN, "surplasse.test");
  assert.equal(config.API_URL, "https://api.surplasse.test");
  assert.equal(config.COOKIE_DOMAIN, "");
  assert.equal(config.RESERVED_SUBDOMAINS, "www,api,dashboard,docs,app,admin,local,mail");
});

test("production keeps development-only services disabled", () => {
  const config = loadFrontendDomainConfig("production");

  assert.equal(config.APP_BASE_DOMAIN, "surplasse.com");
  assert.equal(config.API_URL, "https://api.surplasse.com");
  assert.equal(config.LOCAL_CONTROL_URL, "");
  assert.equal(config.MAILPIT_URL, "");
});

test("frontend overrides derive a coherent topology from the base domain", () => {
  const config = loadFrontendDomainConfig("development", {
    VITE_APP_BASE_DOMAIN: "example.test",
    VITE_API_BASE_URL: "https://gateway.example.test",
  });

  assert.equal(config.APP_BASE_URL, "https://example.test");
  assert.equal(config.DASHBOARD_URL, "https://dashboard.example.test");
  assert.equal(config.API_URL, "https://gateway.example.test");
  assert.deepEqual(allowedFrontendHosts(config), ["example.test", ".example.test"]);
});

test("frontend keeps every canonical URL declared by the selected profile", () => {
  const base = loadDomainConfig("development");
  const profile = {
    ...base,
    DASHBOARD_URL: "https://portal.surplasse.test",
    API_URL: "https://gateway.surplasse.test",
  };

  const config = configureFrontendDomainConfig(profile, {}, "custom development");

  assert.equal(config.DASHBOARD_URL, profile.DASHBOARD_URL);
  assert.equal(config.API_URL, profile.API_URL);
});

test("frontend definitions never expose a cookie domain", () => {
  const definitions = frontendEnvironmentDefinitions(loadDomainConfig("development"));

  assert.equal(definitions["import.meta.env.VITE_COOKIE_DOMAIN"], undefined);
  assert.equal(
    definitions["import.meta.env.VITE_API_BASE_URL"],
    JSON.stringify("https://api.surplasse.test"),
  );
});

test("unknown profiles fail closed", () => {
  assert.throws(() => loadDomainConfig("staging"), /Unknown domain profile/u);
});

test("onboarding selects development for direct loopback previews", () => {
  for (const hostname of ["localhost", "127.0.0.1", "::1", "[::1]"]) {
    const config = onboardingRuntimeConfig(hostname);
    assert.equal(config.PROFILE, "development");
    assert.equal(config.APP_BASE_DOMAIN, "surplasse.test");
  }
});

test("onboarding keeps unknown public hosts on the production profile", () => {
  const config = onboardingRuntimeConfig("preview.example.net");

  assert.equal(config.PROFILE, "production");
  assert.equal(config.APP_BASE_DOMAIN, "surplasse.com");
});

test("backend wrapper exports one coherent profile without Java URL defaults", () => {
  const script = fileURLToPath(
    new URL("../../scripts/run-with-domain-profile.sh", import.meta.url),
  );
  const command = [
    "printf '%s\\n' \"$APP_BASE_DOMAIN\" \"$SURPLASSE_PLATFORM_API_URL\" \"$ONBOARDING_URL\" \"$SURPLASSE_PLATFORM_DASHBOARD_URL\" \"$CORS_PUBLIC_ORIGINS\"",
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
    "https://surplasse.test,/https:\\/\\/[a-z0-9-]+\\.surplasse\\.test/",
  ]);
  assert.deepEqual(production, [
    "surplasse.com",
    "https://api.surplasse.com",
    "https://surplasse.com",
    "https://dashboard.surplasse.com",
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

test("runtime configuration code contains no Surplasse environment literal", () => {
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
  runInNewContext(source, { window });
  return window.SURPLASSE_DOMAIN_CONFIG;
}
