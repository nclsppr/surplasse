import assert from "node:assert/strict";
import test from "node:test";

import { loadDevelopmentUrls } from "../domains.mjs";
import { createQualitySuites } from "../quality-suites.mjs";
import { createRegistry, EXPECTED_MODULE_IDS } from "../registry.mjs";
import { configuredDevelopmentUrls, repoRoot } from "./helpers.mjs";

test("development domain catalog is consumed without aliases or local fallback", () => {
  const loaded = loadDevelopmentUrls(repoRoot);

  assert.equal(loaded.source, "config/domains/development.env");
  assert.equal(loaded.urls.cockpit, "https://local.surplasse.test");
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

test("present but invalid development domain catalog fails closed", () => {
  assert.throws(
    () =>
      loadDevelopmentUrls(repoRoot, {
        existsSync: () => true,
        loadDomainConfig: () => ({
          LOCAL_CONTROL_URL: "",
          MAILPIT_URL: "",
        }),
      }),
    /must define LOCAL_CONTROL_URL/u,
  );
});

test("registry contains only executable allowlist, derived PostgreSQL and reserved domains", () => {
  const registry = createRegistry(repoRoot, configuredDevelopmentUrls());

  assert.deepEqual(
    registry.modules.map((module) => module.id),
    EXPECTED_MODULE_IDS,
  );
  assert.equal(registry.modules.find((module) => module.id === "postgresql").kind, "derived");
  assert.equal(registry.modules.find((module) => module.id === "postgresql").derivedFrom, "backend");
  assert.equal(registry.modules.find((module) => module.id === "app").kind, "reserved");
  assert.equal(registry.modules.find((module) => module.id === "admin").kind, "reserved");
  assert.equal(registry.modules.some((module) => ["caddy", "dnsmasq", "mkcert"].includes(module.id)), false);
});

test("registry fixes commands, loopback probes, ports and Mailpit image", () => {
  const registry = createRegistry(repoRoot, configuredDevelopmentUrls());
  const backend = registry.modules.find((module) => module.id === "backend");
  const commande = registry.modules.find((module) => module.id === "commande");
  const onboarding = registry.modules.find((module) => module.id === "onboarding");
  const mailpit = registry.modules.find((module) => module.id === "mailpit");

  assert.equal(backend.command.executable, `${repoRoot}/scripts/run-with-domain-profile.sh`);
  assert.deepEqual(backend.command.args, [
    "development",
    "./mvnw",
    "quarkus:dev",
    "-Ddebug=5006",
    "-Dquarkus.http.host=127.0.0.1",
  ]);
  assert.deepEqual(backend.ports, [8080, 5006, 5432]);
  assert.deepEqual(commande.command.args, ["run", "dev", "--", "--host", "127.0.0.1"]);
  assert.equal(onboarding.command.executable, process.execPath);
  assert.deepEqual(onboarding.command.args, [`${repoRoot}/scripts/dev-cockpit/onboarding-server.mjs`]);
  assert.equal(mailpit.docker.image, "axllent/mailpit:v1.30.4");
  assert.deepEqual(mailpit.ports, [1025, 8025]);
  for (const module of registry.modules.filter((item) => item.health)) {
    assert.equal(new URL(module.health.url).hostname, "127.0.0.1");
  }

  const managedPorts = registry.modules
    .filter((module) => ["process", "docker"].includes(module.kind))
    .flatMap((module) => module.ports);
  assert.equal(new Set(managedPorts).size, managedPorts.length);
});

test("Backend is launched through the fixed central domain profile wrapper", () => {
  const registry = createRegistry(repoRoot, configuredDevelopmentUrls());
  const backend = registry.modules.find((module) => module.id === "backend");

  assert.equal(backend.command.executable, `${repoRoot}/scripts/run-with-domain-profile.sh`);
  assert.equal(backend.command.args[0], "development");
  assert.equal(backend.command.args[1], "./mvnw");
  assert.equal(Object.hasOwn(backend.command, "environment"), false);
});

test("public probes target canonical HTTPS routes and reserved domains expect 503", () => {
  const registry = createRegistry(repoRoot, configuredDevelopmentUrls());
  const byId = Object.fromEntries(registry.modules.map((module) => [module.id, module]));

  assert.equal(byId.backend.publicHealth.url, "https://api.surplasse.test/q/health/ready");
  assert.equal(byId.backend.publicHealth.bodyExpectation, "quarkus-up");
  assert.equal(byId.commande.publicHealth.url, "https://le-cormoran.surplasse.test");
  assert.equal(byId.mailpit.publicHealth.url, "https://mail.surplasse.test/readyz");
  assert.deepEqual(byId.app.publicHealth.expectedStatusCodes, [503]);
  assert.equal(byId.app.publicHealth.expectation, "reserved");
  assert.equal(registry.urlConfiguration.controlHealth.url, "https://local.surplasse.test/styles.css");
  assert.equal(registry.urlConfiguration.wwwUrl, "https://www.surplasse.test");
  assert.equal(registry.urlConfiguration.wwwHealth.url, "https://www.surplasse.test");
  assert.deepEqual(registry.urlConfiguration.wwwHealth.expectedStatusCodes, [308]);
  assert.equal(registry.urlConfiguration.wwwHealth.expectation, "redirect");
});

test("browser links use canonical surplasse.test domains", () => {
  const registry = createRegistry(repoRoot, configuredDevelopmentUrls());
  const allLinks = registry.modules.flatMap((module) => module.links.map((item) => item.url));

  assert.ok(allLinks.includes("https://api.surplasse.test"));
  assert.ok(allLinks.some((url) => url.startsWith("https://le-cormoran.surplasse.test/?table=")));
  assert.ok(allLinks.includes("https://mail.surplasse.test"));
  assert.equal(allLinks.some((url) => url.includes("cockpit.surplasse.test")), false);
  assert.equal(allLinks.some((url) => url.includes("mailpit.surplasse.test")), false);
});

test("quality suites expose a fixed command allowlist without shell composition", () => {
  const suites = createQualitySuites(repoRoot);

  assert.deepEqual(suites.map((suite) => suite.id), [
    "backend-integration",
    "frontend-contracts",
    "local-platform",
  ]);
  assert.equal(suites.every((suite) => suite.commands.length > 0), true);
  for (const command of suites.flatMap((suite) => suite.commands)) {
    assert.ok(["npm"].includes(command.executable));
    assert.equal(command.cwd, repoRoot);
    assert.equal(command.args.some((argument) => /[;&|`]/u.test(argument)), false);
  }
});
