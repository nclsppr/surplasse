import assert from "node:assert/strict";
import test from "node:test";

import {
  getE2eExecutionPaths,
  getE2ePaths,
  resolveE2eTarget,
} from "../support/target.mjs";

test("known profile derives every URL from the central domain config", () => {
  const development = resolveE2eTarget("development", {
    SURPLASSE_E2E_BASE_DOMAIN: "ignored.example.org",
  });
  const production = resolveE2eTarget("production", {
    SURPLASSE_E2E_BASE_DOMAIN: "ignored.example.org",
  });

  for (const target of [development, production]) {
    assert.equal(new URL(target.apiUrl).hostname, `api.${target.baseDomain}`);
    assert.equal(
      new URL(target.dashboardUrl).hostname,
      `dashboard.${target.baseDomain}`,
    );
    assert.equal(new URL(target.onboardingUrl).hostname, target.baseDomain);
    assert.notEqual(target.baseDomain, "ignored.example.org");
  }
  assert.notEqual(development.baseDomain, production.baseDomain);
  assert.equal(development.ignoreHTTPSErrors, true);
  assert.equal(production.ignoreHTTPSErrors, false);
  assert.equal(development.publicReadinessStatus, 200);
  assert.equal(production.publicReadinessStatus, 404);
});

test("custom target requires an isolated ID and derives HTTPS origins", () => {
  const target = resolveE2eTarget("custom", {
    SURPLASSE_E2E_TARGET_ID: "uat-one",
    SURPLASSE_E2E_BASE_DOMAIN: "uat.example.org",
    SURPLASSE_E2E_ESTABLISHMENT_SLUG: "monitoring-restaurant",
  });

  assert.equal(target.onboardingUrl, "https://uat.example.org");
  assert.equal(target.apiUrl, "https://api.uat.example.org");
  assert.equal(
    target.establishmentUrl,
    "https://monitoring-restaurant.uat.example.org",
  );
  assert.match(target.storageId, /^uat-one-[a-f0-9]{12}$/u);
  assert.equal(target.ignoreHTTPSErrors, false);
  assert.equal(target.publicReadinessStatus, 404);
});

test("custom history identity includes the normalized base domain", () => {
  const first = resolveE2eTarget("custom", {
    SURPLASSE_E2E_TARGET_ID: "uat-one",
    SURPLASSE_E2E_BASE_DOMAIN: "uat-one.example.org",
  });
  const second = resolveE2eTarget("custom", {
    SURPLASSE_E2E_TARGET_ID: "uat-one",
    SURPLASSE_E2E_BASE_DOMAIN: "uat-two.example.org",
  });

  assert.notEqual(first.storageId, second.storageId);
  assert.notEqual(getE2ePaths(first.storageId).root, getE2ePaths(second.storageId).root);
});

test("target validation rejects implicit, unsafe and colliding targets", () => {
  assert.throws(() => resolveE2eTarget(undefined, {}), /Missing E2E target/u);
  assert.throws(
    () =>
      resolveE2eTarget("custom", {
        SURPLASSE_E2E_TARGET_ID: "../uat",
        SURPLASSE_E2E_BASE_DOMAIN: "uat.example.org",
      }),
    /kebab-case/u,
  );
  assert.throws(
    () =>
      resolveE2eTarget("custom", {
        SURPLASSE_E2E_TARGET_ID: "uat",
        SURPLASSE_E2E_BASE_DOMAIN: "https://uat.example.org/path",
      }),
    /normalized lowercase hostname|hostname only/u,
  );
});

test("artifact paths stay isolated under a validated target ID", () => {
  const first = getE2ePaths("production");
  const second = getE2ePaths("uat-one");

  assert.notEqual(first.root, second.root);
  assert.match(first.history, /production\/history\.jsonl$/u);
  assert.match(second.history, /uat-one\/history\.jsonl$/u);
  assert.match(first.report, /production\/allure-report$/u);
  assert.match(first.playwright, /production\/test-results$/u);
  assert.throws(() => getE2ePaths("../outside"), /kebab-case/u);
});

test("execution paths use an explicit temporary workspace", () => {
  const canonical = getE2ePaths("development");
  const selected = getE2eExecutionPaths("development", {
    SURPLASSE_E2E_WORKSPACE: "/tmp/surplasse-e2e-development-test",
  });

  assert.equal(selected.root, "/tmp/surplasse-e2e-development-test");
  assert.equal(selected.history, "/tmp/surplasse-e2e-development-test/history.jsonl");
  assert.equal(getE2eExecutionPaths("development", {}).root, canonical.root);
  assert.equal(getE2ePaths("development").root, canonical.root);
  assert.throws(
    () => getE2eExecutionPaths("development", { SURPLASSE_E2E_WORKSPACE: "relative" }),
    /absolute path/u,
  );
});
