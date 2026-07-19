import assert from "node:assert/strict";
import test from "node:test";

import { CockpitOperationError } from "../system.mjs";
import { createManagerHarness } from "./helpers.mjs";

test("stopped module starts as an owned process and becomes ready after health succeeds", async () => {
  const harness = createManagerHarness();
  const starting = await harness.manager.start("commande");

  assert.equal(starting.status, "starting");
  assert.equal(starting.ownership, "cockpit");
  assert.equal(harness.processController.starts.length, 1);
  assert.equal(harness.processController.starts[0].definition.id, "commande");

  harness.health.set("http://127.0.0.1:5173/", true);
  const state = await harness.manager.state();
  const commande = state.modules.find((module) => module.id === "commande");
  assert.equal(commande.status, "ready");
  assert.equal(commande.canStop, true);
});

test("healthy service without owned handle is external and can never be stopped", async () => {
  const harness = createManagerHarness();
  harness.health.set("http://127.0.0.1:5174/", true);

  const state = await harness.manager.state();
  const dashboard = state.modules.find((module) => module.id === "dashboard");
  assert.equal(dashboard.status, "external");
  assert.equal(dashboard.ownership, "external");
  assert.equal(dashboard.canStop, false);

  await assert.rejects(() => harness.manager.stop("dashboard"), CockpitOperationError);
  assert.equal(harness.processController.stops.length, 0);
});

test("occupied port with failing health is a conflict and cannot spawn", async () => {
  const harness = createManagerHarness();
  harness.occupiedPorts.add(5173);

  const state = await harness.manager.state();
  assert.equal(state.modules.find((module) => module.id === "commande").status, "conflict");
  await assert.rejects(() => harness.manager.start("commande"), /déjà occupé/u);
  assert.equal(harness.processController.starts.length, 0);
});

test("owned process is the only process sent to stop", async () => {
  const harness = createManagerHarness();
  await harness.manager.start("docs");
  await harness.manager.stop("docs");

  assert.equal(harness.processController.stops.length, 1);
  const state = await harness.manager.state();
  assert.equal(state.modules.find((module) => module.id === "docs").status, "stopped");
});

test("unexpected child exit marks failure and stale generation cannot break replacement", async () => {
  const harness = createManagerHarness();
  await harness.manager.start("commande");
  const firstHandle = harness.processController.starts[0].handle;
  harness.processController.exit(firstHandle, { code: 7, signal: null, error: null });

  let state = await harness.manager.state();
  assert.equal(state.modules.find((module) => module.id === "commande").status, "failed");

  await harness.manager.start("commande");
  const secondHandle = harness.processController.starts[1].handle;
  harness.processController.exit(firstHandle, { code: 9, signal: null, error: null });
  harness.health.set("http://127.0.0.1:5173/", true);

  state = await harness.manager.state();
  const commande = state.modules.find((module) => module.id === "commande");
  assert.equal(commande.status, "ready");
  assert.equal(secondHandle.running, true);
});

test("living process whose startup deadline elapsed becomes degraded", async () => {
  const harness = createManagerHarness();
  await harness.manager.start("onboarding");
  harness.advance(20_001);

  const state = await harness.manager.state();
  assert.equal(state.modules.find((module) => module.id === "onboarding").status, "degraded");
});

test("PostgreSQL state is derived and never exposes controls", async () => {
  const harness = createManagerHarness();
  harness.health.set("http://127.0.0.1:8080/q/health/ready", true);

  const state = await harness.manager.state();
  const postgresql = state.modules.find((module) => module.id === "postgresql");
  assert.equal(postgresql.status, "ready");
  assert.equal(postgresql.ownership, "derived");
  assert.equal(postgresql.canStart, false);
  assert.equal(postgresql.canStop, false);
  await assert.rejects(() => harness.manager.stop("postgresql"), /non pilotable/u);
});

test("backend refuses to start when Docker is unavailable and never installs it", async () => {
  const harness = createManagerHarness();
  harness.mailpitController.available = false;

  await assert.rejects(() => harness.manager.start("backend"), /Docker doit être démarré/u);
  assert.equal(harness.processController.starts.length, 0);
});

test("Mailpit loses ownership when immutable container metadata changes", async () => {
  const harness = createManagerHarness();
  await harness.manager.start("mailpit");
  harness.health.set("http://127.0.0.1:8025/readyz", true);
  harness.mailpitController.container.image = "unexpected/mailpit:latest";

  const state = await harness.manager.state();
  const mailpit = state.modules.find((module) => module.id === "mailpit");
  assert.equal(mailpit.status, "external");
  assert.equal(mailpit.ownership, "external");
  assert.equal(mailpit.canStop, false);

  await assert.rejects(() => harness.manager.stop("mailpit"), /n'appartient pas/u);
  assert.equal(harness.mailpitController.stops.length, 0);
});

test("internally ready module is degraded when its public HTTPS route is broken", async () => {
  const harness = createManagerHarness();
  await harness.manager.start("backend");
  harness.health.set("http://127.0.0.1:8080/q/health/ready", true);
  harness.publicUrls.set("https://api.surplasse.test/q/health/ready", {
    state: "gateway-error",
    detail: "Caddy répond, mais la destination renvoie HTTP 502.",
    statusCode: 502,
  });

  const state = await harness.manager.state();
  const backend = state.modules.find((module) => module.id === "backend");
  assert.equal(backend.status, "degraded");
  assert.equal(backend.ownership, "cockpit");
  assert.equal(backend.canStop, true);
  assert.equal(backend.publicUrl.state, "gateway-error");
  assert.match(backend.detail, /Service interne prêt, accès public indisponible/u);
});

test("state exposes expected reserved, cockpit and www public URL diagnostics", async () => {
  const harness = createManagerHarness();

  const state = await harness.manager.state();
  const app = state.modules.find((module) => module.id === "app");
  assert.equal(app.status, "reserved");
  assert.equal(app.publicUrl.state, "reserved");
  assert.equal(app.publicUrl.statusCode, 503);
  assert.equal(state.urlConfiguration.publicUrl.state, "available");
  assert.equal(state.urlConfiguration.wwwUrl, "https://www.surplasse.test");
  assert.equal(state.urlConfiguration.wwwPublicUrl.state, "redirect");
  assert.equal(state.urlConfiguration.wwwPublicUrl.statusCode, 308);
});

test("preset skips external services, starts allowlisted modules and stops only owned modules", async () => {
  const harness = createManagerHarness();
  harness.health.set("http://127.0.0.1:8025/readyz", true);

  const started = await harness.manager.runPreset("core", "start");
  assert.deepEqual(
    started.results.map((result) => [result.id, result.ok, result.skipped]),
    [
      ["mailpit", true, true],
      ["backend", true, false],
      ["commande", true, false],
      ["dashboard", true, false],
    ],
  );
  assert.equal(harness.mailpitController.starts.length, 0);

  const stopped = await harness.manager.runPreset("core", "stop");
  assert.equal(stopped.results.every((result) => result.ok), true);
  assert.equal(harness.mailpitController.stops.length, 0);
  assert.equal(harness.processController.stops.length, 3);
});

test("state response never exposes commands, paths, handles, pids or Docker owner", async () => {
  const harness = createManagerHarness();
  await harness.manager.start("commande");
  const serialized = JSON.stringify(await harness.manager.state());

  for (const forbidden of [
    '"command":',
    '"environment":',
    '"env":',
    '"cwd":',
    "mvnw",
    "--host",
    "COOKIE_DOMAIN",
    "container-current",
    "current-owner",
    '"pid":',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
