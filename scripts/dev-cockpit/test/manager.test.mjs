import assert from "node:assert/strict";
import test from "node:test";

import { CockpitOperationError } from "../system.mjs";
import {
  composeService,
  createManagerHarness,
  FakeReportStore,
  waitUntil,
} from "./helpers.mjs";

test("healthy Compose project is reflected as ready without cockpit ownership handles", async () => {
  const reportStore = new FakeReportStore({
    available: true,
    status: "passed",
    createdAt: "2026-07-22T02:00:00.000Z",
    durationMs: 2_338,
    total: 7,
    passed: 7,
  });
  const harness = createManagerHarness({ reportStore });
  harness.composeController.setAllReady();

  const state = await harness.manager.state();
  const backend = moduleById(state, "backend");
  const edge = moduleById(state, "edge");
  const postgresql = moduleById(state, "postgresql");

  assert.deepEqual(state.compose, {
    available: true,
    running: false,
    action: null,
    moduleIds: [],
    error: null,
  });
  assert.equal(backend.status, "ready");
  assert.equal(backend.ownership, "compose");
  assert.equal(backend.canStart, false);
  assert.equal(backend.canStop, true);
  assert.equal(edge.status, "ready");
  assert.equal(edge.canStart, false);
  assert.equal(edge.canStop, false);
  assert.equal(postgresql.status, "ready");
  assert.equal(postgresql.canStop, true);
  assert.deepEqual(state.reports.allureDevelopment, reportStore.reportState);
  assert.equal(state.urlConfiguration.reportsUrl, "https://reports.surplasse.test");
});

test("Compose container states map to stable cockpit statuses and controls", async (t) => {
  const cases = [
    [{ exists: false }, "stopped", true, false],
    [{ state: "running", health: "starting" }, "starting", false, true],
    [{ state: "running", health: "unhealthy" }, "degraded", false, true],
    [{ state: "running", health: "" }, "ready", false, true],
    [{ state: "created", health: "" }, "starting", false, true],
    [{ state: "exited", health: "", exitCode: 0 }, "stopped", true, false],
    [{ state: "exited", health: "", exitCode: 9 }, "failed", true, false],
    [{ state: "dead", health: "", exitCode: 9 }, "failed", true, false],
    [{ state: "paused", health: "", exitCode: null }, "degraded", false, true],
  ];

  for (const [container, expectedStatus, canStart, canStop] of cases) {
    await t.test(expectedStatus, async () => {
      const harness = createManagerHarness();
      if (container.exists === false) {
        // Missing is the default fake state.
      } else {
        harness.composeController.set("backend", container);
      }
      const backend = moduleById(await harness.manager.state(), "backend");
      assert.equal(backend.status, expectedStatus);
      assert.equal(backend.canStart, canStart);
      assert.equal(backend.canStop, canStop);
    });
  }
});

test("ready container becomes degraded when its canonical HTTPS route fails", async () => {
  const harness = createManagerHarness();
  harness.composeController.set("backend");
  harness.publicUrls.set("https://api.surplasse.test/q/health/ready", {
    state: "gateway-error",
    detail: "Caddy répond, mais la destination renvoie HTTP 502.",
    statusCode: 502,
  });

  const backend = moduleById(await harness.manager.state(), "backend");

  assert.equal(backend.status, "degraded");
  assert.equal(backend.canStop, true);
  assert.equal(backend.publicUrl.state, "gateway-error");
  assert.match(backend.detail, /Conteneur sain, accès HTTPS indisponible/u);
});

test("Compose inspection failure disables every lifecycle control", async () => {
  const harness = createManagerHarness();
  harness.composeController.inspectError = new Error("docker socket unavailable");

  const state = await harness.manager.state();

  assert.equal(state.compose.available, false);
  assert.equal(state.compose.error, "L'état du projet Docker Compose est indisponible.");
  for (const module of state.modules.filter((item) => item.kind === "compose")) {
    assert.equal(module.status, "unavailable");
    assert.equal(module.canStart, false);
    assert.equal(module.canStop, false);
  }
  await assert.rejects(
    () => harness.manager.start("backend"),
    (error) => error instanceof CockpitOperationError && error.statusCode === 503,
  );
});

test("module start is asynchronous, globally serialized and delegated to Compose", async () => {
  const harness = createManagerHarness();
  const operation = harness.composeController.deferNextOperation();

  const accepted = await harness.manager.start("backend");
  await waitUntil(() => harness.composeController.starts.length === 1);
  const during = await harness.manager.state();

  assert.equal(accepted.status, "starting");
  assert.deepEqual(harness.composeController.starts, [["backend"]]);
  assert.equal(during.compose.running, true);
  assert.equal(during.compose.action, "start");
  assert.deepEqual(during.compose.moduleIds, ["backend"]);
  assert.equal(moduleById(during, "backend").status, "starting");
  assert.equal(moduleById(during, "commande").canStart, false);
  await assert.rejects(
    () => harness.manager.stop("commande"),
    (error) => error instanceof CockpitOperationError && error.statusCode === 409,
  );

  operation.resolve();
  await waitUntil(async () => !(await harness.manager.state()).compose.running);
  const completed = await harness.manager.state();
  assert.equal(moduleById(completed, "backend").status, "ready");
  assert.equal(moduleById(completed, "backend").canStop, true);
});

test("module stop is asynchronous and delegates the exact service to Compose", async () => {
  const harness = createManagerHarness();
  harness.composeController.set("dashboard");
  const operation = harness.composeController.deferNextOperation();

  const accepted = await harness.manager.stop("dashboard");
  await waitUntil(() => harness.composeController.stops.length === 1);

  assert.equal(accepted.status, "stopping");
  assert.deepEqual(harness.composeController.stops, [["dashboard"]]);
  operation.resolve();
  await waitUntil(async () => !(await harness.manager.state()).compose.running);
  assert.equal(moduleById(await harness.manager.state(), "dashboard").status, "stopped");
});

test("lifecycle failure is sanitized, persisted and exposed as a retryable module failure", async () => {
  const harness = createManagerHarness();
  harness.composeController.startError = new Error("build failed\nexit 1");

  await harness.manager.start("commande");
  await waitUntil(async () => !(await harness.manager.state()).compose.running);
  const commande = moduleById(await harness.manager.state(), "commande");

  assert.equal(commande.status, "failed");
  assert.equal(commande.canStart, true);
  assert.equal(commande.lastError, "build failed exit 1");
});

test("start preset skips ready services and submits remaining services in registry order", async () => {
  const harness = createManagerHarness();
  harness.composeController.set("postgresql");
  harness.composeController.set("backend");
  const operation = harness.composeController.deferNextOperation();

  const accepted = await harness.manager.runPreset("all", "start");
  await waitUntil(() => harness.composeController.starts.length === 1);

  assert.deepEqual(
    accepted.results.map((result) => [result.id, result.skipped]),
    [
      ["postgresql", true],
      ["mailpit", false],
      ["backend", true],
      ["commande", false],
      ["commande2", false],
      ["dashboard", false],
      ["dashboard2", false],
      ["onboarding", false],
      ["onboarding2", false],
      ["docs", false],
      ["prometheus", false],
      ["grafana", false],
    ],
  );
  assert.deepEqual(harness.composeController.starts, [[
    "mailpit",
    "commande",
    "commande2",
    "dashboard",
    "dashboard2",
    "onboarding",
    "onboarding2",
    "docs",
    "prometheus",
    "grafana",
  ]]);
  operation.resolve();
  await waitUntil(async () => !(await harness.manager.state()).compose.running);
});

test("stop preset submits running services in reverse dependency order", async () => {
  const harness = createManagerHarness();
  harness.composeController.setAllReady();
  const operation = harness.composeController.deferNextOperation();

  await harness.manager.runPreset("all", "stop");
  await waitUntil(() => harness.composeController.stops.length === 1);

  assert.deepEqual(harness.composeController.stops, [[
    "grafana",
    "prometheus",
    "docs",
    "onboarding2",
    "onboarding",
    "dashboard2",
    "dashboard",
    "commande2",
    "commande",
    "backend",
    "mailpit",
    "postgresql",
  ]]);
  operation.resolve();
  await waitUntil(async () => !(await harness.manager.state()).compose.running);
});

test("unknown, reserved and read-only modules cannot reach Compose", async () => {
  const harness = createManagerHarness();

  for (const id of ["unknown", "app", "edge"]) {
    await assert.rejects(
      () => harness.manager.start(id),
      (error) => error instanceof CockpitOperationError && error.statusCode === 404,
    );
  }
  assert.deepEqual(harness.composeController.starts, []);
});

test("running quality checks and Compose lifecycle operations exclude each other", async () => {
  const qualityHarness = createManagerHarness();
  qualityHarness.qualityRunner.running = true;
  await assert.rejects(
    () => qualityHarness.manager.start("backend"),
    (error) => error instanceof CockpitOperationError && error.statusCode === 409,
  );

  const lifecycleHarness = createManagerHarness();
  const operation = lifecycleHarness.composeController.deferNextOperation();
  await lifecycleHarness.manager.start("backend");
  await waitUntil(() => lifecycleHarness.composeController.starts.length === 1);
  await assert.rejects(
    () => lifecycleHarness.manager.runQualitySuite("backend-integration"),
    (error) => error instanceof CockpitOperationError && error.statusCode === 409,
  );
  operation.resolve();
  await waitUntil(async () => !(await lifecycleHarness.manager.state()).compose.running);
});

test("Playwright suite and full quality run require the complete smoke platform to be healthy", async () => {
  const blocked = createManagerHarness();
  for (const service of ["edge", "backend", "commande", "dashboard"]) {
    blocked.composeController.set(service);
  }

  await assert.rejects(
    () => blocked.manager.runQualitySuite("e2e-development"),
    (error) =>
      error instanceof CockpitOperationError &&
      error.statusCode === 409 &&
      error.message.includes("onboarding"),
  );
  assert.deepEqual(blocked.qualityRunner.suiteStarts, []);

  const ready = createManagerHarness();
  ready.composeController.setAllReady();
  const suiteState = await ready.manager.runQualitySuite("e2e-development");
  assert.equal(suiteState.running, true);
  assert.deepEqual(ready.qualityRunner.suiteStarts, ["e2e-development"]);

  const all = createManagerHarness();
  all.composeController.setAllReady();
  await all.manager.runAllQualitySuites();
  assert.equal(all.qualityRunner.allStarts, 1);
});

test("manager shutdown aborts cockpit operations without stopping Compose services", async () => {
  const harness = createManagerHarness();
  const operation = harness.composeController.deferNextOperation();
  await harness.manager.start("backend");
  await waitUntil(() => harness.composeController.starts.length === 1);

  await harness.manager.shutdown();

  assert.equal(harness.composeController.aborted, true);
  assert.equal(harness.qualityRunner.stops, 1);
  assert.deepEqual(harness.composeController.stops, []);
  operation.resolve();
});

test("state never exposes Compose commands, service identifiers or controller internals", async () => {
  const harness = createManagerHarness();
  harness.composeController.set("backend", composeService("backend"));

  const serialized = JSON.stringify(await harness.manager.state());

  for (const forbidden of [
    '"composeService":',
    '"command":',
    '"environment":',
    '"cwd":',
    "scripts/compose.sh",
    "docker compose",
    "frontend-experiment",
    "observability",
    '"signal":',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal(serialized.includes("https://reports.surplasse.test"), true);
});

function moduleById(state, id) {
  return state.modules.find((module) => module.id === id);
}
