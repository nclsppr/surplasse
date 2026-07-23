import assert from "node:assert/strict";
import test from "node:test";

import { loadDevelopmentUrls } from "../domains.mjs";
import { createQualitySuites } from "../quality-suites.mjs";
import { createRegistry, EXPECTED_MODULE_IDS } from "../registry.mjs";
import { configuredDevelopmentUrls, repoRoot } from "./helpers.mjs";

test("development domain catalog exposes cockpit, reports and application URLs without fallback", () => {
  const loaded = loadDevelopmentUrls(repoRoot);

  assert.equal(loaded.source, "config/domains/development.env");
  assert.equal(loaded.urls.cockpit, "https://local.surplasse.test");
  assert.equal(loaded.urls.reports, "https://reports.surplasse.test");
  assert.equal(loaded.urls.grafana, "https://grafana.surplasse.test");
  assert.equal(loaded.urls.backend, "https://api.surplasse.test");
  assert.equal(loaded.urls.commande, "https://le-cormoran.surplasse.test");
  assert.equal(loaded.urls.mailpit, "https://mail.surplasse.test");
  assert.equal(loaded.urls.app, "https://app.surplasse.test");
  assert.equal(loaded.baseDomain, "surplasse.test");
  assert.equal(loaded.certificateFile, `${repoRoot}/.certs/surplasse.test.pem`);
  assert.deepEqual(loaded.warnings, []);
});

test("missing development domain catalog fails closed without URL fallbacks", () => {
  assert.throws(
    () => loadDevelopmentUrls(repoRoot, { existsSync: () => false }),
    /Missing central domain profile/u,
  );
});

test("development catalog requires cockpit, mail, reports and Grafana URLs", () => {
  for (const missingKey of ["LOCAL_CONTROL_URL", "MAILPIT_URL", "REPORTS_URL", "GRAFANA_URL"]) {
    assert.throws(
      () =>
        loadDevelopmentUrls(repoRoot, {
          existsSync: () => true,
          loadDomainConfig: () => ({ ...domainConfigFixture(), [missingKey]: "" }),
        }),
      /must define LOCAL_CONTROL_URL, MAILPIT_URL, REPORTS_URL and GRAFANA_URL/u,
      missingKey,
    );
  }
});

test("development catalog requires every local control subdomain to stay reserved", () => {
  for (const missingReservation of ["app", "admin", "local", "mail", "reports", "grafana"]) {
    assert.throws(
      () =>
        loadDevelopmentUrls(repoRoot, {
          existsSync: () => true,
          loadDomainConfig: () => ({
            ...domainConfigFixture(),
            RESERVED_SUBDOMAINS: ["app", "admin", "local", "mail", "reports", "grafana"]
              .filter((item) => item !== missingReservation)
              .join(","),
          }),
        }),
      new RegExp(`must reserve the ${missingReservation} subdomain`, "u"),
    );
  }
});

test("registry maps every local runtime to an allowlisted Compose service", () => {
  const registry = createRegistry(repoRoot, configuredDevelopmentUrls());
  const composeModules = registry.modules.filter((module) => module.kind === "compose");

  assert.deepEqual(registry.modules.map((module) => module.id), EXPECTED_MODULE_IDS);
  assert.deepEqual(registry.composeServices, [
    "edge",
    "backend",
    "commande",
    "commande2",
    "dashboard",
    "dashboard2",
    "onboarding",
    "onboarding2",
    "docs",
    "mailpit",
    "prometheus",
    "grafana",
    "postgresql",
  ]);
  assert.deepEqual(
    composeModules.map((module) => module.composeService),
    registry.composeServices,
  );
  assert.equal(new Set(registry.composeServices).size, registry.composeServices.length);
  assert.equal(composeModules.every((module) => module.id === module.composeService), true);
  assert.deepEqual(registry.composeServiceProfiles, {
    commande2: ["frontend-experiment"],
    dashboard2: ["frontend-experiment"],
    grafana: ["observability"],
    onboarding2: ["frontend-experiment"],
    prometheus: ["observability"],
  });
  assert.equal(registry.modules.find((module) => module.id === "app").kind, "reserved");
  assert.equal(registry.modules.find((module) => module.id === "admin").kind, "reserved");
});

test("registry never exposes native or raw Docker launch metadata", () => {
  const registry = createRegistry(repoRoot, configuredDevelopmentUrls());
  const serialized = JSON.stringify(registry);

  for (const forbidden of [
    '"command":',
    '"executable":',
    '"cwd":',
    '"docker":',
    "quarkus:dev",
    "docs:watch",
    "--host",
    "axllent/mailpit",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("Caddy is visible but read-only while every other Compose module is controllable", () => {
  const registry = createRegistry(repoRoot, configuredDevelopmentUrls());
  const composeModules = registry.modules.filter((module) => module.kind === "compose");
  const edge = composeModules.find((module) => module.id === "edge");

  assert.equal(edge.controllable, false);
  assert.equal(edge.group, "infrastructure");
  assert.equal(
    composeModules.filter((module) => module.id !== "edge").every((module) => module.controllable),
    true,
  );
  assert.equal(registry.presets.core.includes("edge"), false);
  assert.equal(registry.presets.all.includes("edge"), false);
  assert.deepEqual(registry.presets.core, [
    "postgresql",
    "mailpit",
    "backend",
    "commande",
    "dashboard",
  ]);
  assert.equal(registry.presets.all.includes("commande2"), true);
  assert.equal(registry.presets.all.includes("dashboard2"), true);
  assert.equal(registry.presets.all.includes("onboarding2"), true);
});

test("public probes target canonical HTTPS routes including the dedicated reports host", () => {
  const registry = createRegistry(repoRoot, configuredDevelopmentUrls());
  const byId = Object.fromEntries(registry.modules.map((module) => [module.id, module]));

  assert.equal(byId.edge.publicHealth.url, "https://surplasse.test/.well-known/surplasse-edge");
  assert.equal(byId.backend.publicHealth.url, "https://api.surplasse.test/q/health/ready");
  assert.equal(byId.backend.publicHealth.bodyExpectation, "quarkus-up");
  assert.equal(byId.commande.publicHealth.url, "https://le-cormoran.surplasse.test");
  assert.equal(
    byId.commande2.publicHealth.url,
    "https://le-cormoran.surplasse.test/_experiments/untitled/",
  );
  assert.equal(
    byId.dashboard2.publicHealth.url,
    "https://dashboard.surplasse.test/_experiments/untitled/auth/login",
  );
  assert.equal(
    byId.onboarding2.publicHealth.url,
    "https://surplasse.test/_experiments/untitled/",
  );
  assert.equal(byId.mailpit.publicHealth.url, "https://mail.surplasse.test/readyz");
  assert.equal(byId.prometheus.publicHealth, null);
  assert.equal(byId.grafana.publicHealth.url, "https://grafana.surplasse.test/api/health");
  assert.equal(byId.postgresql.publicHealth, null);
  assert.deepEqual(byId.app.publicHealth.expectedStatusCodes, [503]);
  assert.equal(registry.urlConfiguration.controlHealth.url, "https://local.surplasse.test/styles.css");
  assert.equal(registry.urlConfiguration.reportsUrl, "https://reports.surplasse.test");
  assert.equal(registry.urlConfiguration.wwwUrl, "https://www.surplasse.test");
  assert.deepEqual(registry.urlConfiguration.wwwHealth.expectedStatusCodes, [308]);
});

test("browser links use only canonical HTTPS domains", () => {
  const registry = createRegistry(repoRoot, configuredDevelopmentUrls());
  const allLinks = registry.modules.flatMap((module) => module.links.map((item) => item.url));

  assert.ok(allLinks.includes("https://api.surplasse.test"));
  assert.ok(allLinks.some((url) => url.startsWith("https://le-cormoran.surplasse.test/?table=")));
  assert.ok(
    allLinks.some((url) =>
      url.startsWith("https://le-cormoran.surplasse.test/_experiments/untitled/?table="),
    ),
  );
  assert.ok(allLinks.includes("https://dashboard.surplasse.test/_experiments/untitled/auth/login"));
  assert.ok(allLinks.includes("https://surplasse.test/_experiments/untitled/"));
  assert.ok(allLinks.includes("https://mail.surplasse.test"));
  assert.ok(allLinks.includes("https://grafana.surplasse.test"));
  assert.equal(allLinks.every((url) => new URL(url).protocol === "https:"), true);
  assert.equal(allLinks.some((url) => url.includes("localhost")), false);
  assert.equal(allLinks.some((url) => url.includes("127.0.0.1")), false);
});

test("quality suites include a fixed local Playwright command without shell composition", () => {
  const suites = createQualitySuites(repoRoot);

  assert.deepEqual(suites.map((suite) => suite.id), [
    "backend-integration",
    "frontend-contracts",
    "local-platform",
    "e2e-development",
  ]);
  const e2e = suites.find((suite) => suite.id === "e2e-development");
  assert.equal(e2e.label, "Parcours Playwright");
  assert.deepEqual(e2e.commands, [
    {
      label: "Smokes Playwright et rapport Allure 3",
      executable: "npm",
      args: ["run", "e2e:test", "--", "development"],
      cwd: repoRoot,
    },
  ]);
  for (const command of suites.flatMap((suite) => suite.commands)) {
    assert.equal(command.executable, "npm");
    assert.equal(command.cwd, repoRoot);
    assert.equal(command.args.some((argument) => /[;&|`]/u.test(argument)), false);
  }
});

function domainConfigFixture() {
  return {
    LOCAL_CONTROL_URL: "https://local.surplasse.test",
    MAILPIT_URL: "https://mail.surplasse.test",
    REPORTS_URL: "https://reports.surplasse.test",
    GRAFANA_URL: "https://grafana.surplasse.test",
    RESERVED_SUBDOMAINS: "app,admin,local,mail,reports,grafana",
    APP_SCHEME: "https",
    APP_BASE_DOMAIN: "surplasse.test",
    API_URL: "https://api.surplasse.test",
    DASHBOARD_URL: "https://dashboard.surplasse.test",
    ONBOARDING_URL: "https://surplasse.test",
    DOCS_URL: "https://docs.surplasse.test",
  };
}
