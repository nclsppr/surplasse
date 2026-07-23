import assert from "node:assert/strict";
import test from "node:test";

import { createCockpitServer } from "../server.mjs";
import { CockpitOperationError } from "../system.mjs";
import { close, cockpitRoot, listen, request } from "./helpers.mjs";

const CSRF_TOKEN = "a".repeat(64);
const UPSTREAM_TOKEN = "d".repeat(64);
const COCKPIT_HOST = "local.surplasse.test";
const REPORTS_HOST = "reports.surplasse.test";
const UPSTREAM_HEADER = "X-Surplasse-Cockpit-Upstream-Token";

test("state requires the private Caddy upstream token and keeps strict security headers", async (t) => {
  const harness = await serverHarness(t);
  const response = await cockpitRequest(harness, "/api/state");

  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.match(response.headers["content-security-policy"], /object-src 'none'/u);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
  assert.equal(response.body.includes(CSRF_TOKEN), false);
  assert.equal(response.body.includes(UPSTREAM_TOKEN), false);

  for (const token of [undefined, "wrong", "e".repeat(64)]) {
    const headers = { Host: COCKPIT_HOST };
    if (token !== undefined) headers[UPSTREAM_HEADER] = token;
    const refused = await request(harness.port, { path: "/api/state", headers });
    assert.equal(refused.status, 421);
  }
  assert.equal(harness.manager.stateCalls, 1);
});

test("duplicate upstream token and hostile Host are refused before reading state", async (t) => {
  const harness = await serverHarness(t);
  const duplicate = await request(harness.port, {
    path: "/api/state",
    rawHeaders: [
      "Host", COCKPIT_HOST,
      UPSTREAM_HEADER, UPSTREAM_TOKEN,
      UPSTREAM_HEADER, UPSTREAM_TOKEN,
    ],
  });
  const hostile = await request(harness.port, {
    path: "/api/state",
    headers: {
      Host: `127.0.0.1:${harness.port}`,
      [UPSTREAM_HEADER]: UPSTREAM_TOKEN,
    },
  });

  assert.equal(duplicate.status, 421);
  assert.equal(hostile.status, 421);
  assert.equal(harness.manager.stateCalls, 0);
});

test("index receives a per-server CSRF token without unsafe inline script", async (t) => {
  const first = await serverHarness(t, { csrfToken: "b".repeat(64) });
  const second = await serverHarness(t, { csrfToken: "c".repeat(64) });

  const firstIndex = await cockpitRequest(first, "/");
  const secondIndex = await cockpitRequest(second, "/");

  assert.match(firstIndex.body, /b{64}/u);
  assert.match(secondIndex.body, /c{64}/u);
  assert.equal(firstIndex.body.includes("c".repeat(64)), false);
  assert.equal(firstIndex.body.includes(UPSTREAM_TOKEN), false);
  assert.equal(firstIndex.headers["content-security-policy"].includes("unsafe-inline"), false);
});

test("quality dashboard exposes the Playwright and Allure controls", async (t) => {
  const harness = await serverHarness(t);
  const response = await cockpitRequest(harness, "/tests");

  assert.equal(response.status, 200);
  assert.match(response.body, /Tests et rapports/u);
  assert.match(response.body, /id="run-all-tests"/u);
  assert.match(response.body, /id="allure-report"/u);
});

test("dedicated reports Host serves only the latest single-file Allure report", async (t) => {
  const report = Buffer.from("<!doctype html><title>Surplasse Allure</title>");
  const harness = await serverHarness(t, { report });

  const response = await reportRequest(harness, "/");
  const head = await reportRequest(harness, "/", { method: "HEAD" });

  assert.equal(response.status, 200);
  assert.equal(response.body, report.toString("utf8"));
  assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
  assert.equal(response.headers["content-length"], String(report.length));
  assert.equal(response.headers["cache-control"], "no-store");
  assert.match(response.headers["content-security-policy"], /script-src 'unsafe-inline'/u);
  assert.equal(response.headers["content-security-policy"].includes("unsafe-eval"), false);
  assert.equal(response.headers["x-frame-options"], "DENY");
  assert.equal(head.status, 200);
  assert.equal(head.body, "");
  assert.equal(head.headers["content-length"], String(report.length));
  assert.equal(harness.reportStore.readCalls, 2);
});

test("reports Host fails closed for missing reports, paths, queries and mutation methods", async (t) => {
  const missing = await serverHarness(t, { report: null });
  assert.equal((await reportRequest(missing, "/")).status, 404);

  const available = await serverHarness(t, { report: Buffer.from("report") });
  for (const target of ["/index.html", "/api/state", "/?target=development", "/../secrets"]) {
    assert.equal((await reportRequest(available, target)).status, 404, target);
  }
  const post = await reportRequest(available, "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, "GET, HEAD");
  assert.equal(available.manager.stateCalls, 0);
});

test("cockpit Host never serves the report and reports Host never serves cockpit assets", async (t) => {
  const harness = await serverHarness(t, { report: Buffer.from("allure-report-marker") });

  const cockpitIndex = await cockpitRequest(harness, "/");
  const reportsAsset = await reportRequest(harness, "/app.js");

  assert.equal(cockpitIndex.status, 200);
  assert.equal(cockpitIndex.body.includes("allure-report-marker"), false);
  assert.equal(reportsAsset.status, 404);
});

test("module, preset and quality mutations return 202 after accepting fixed actions", async (t) => {
  const harness = await serverHarness(t);

  const module = await mutation(harness, "/api/modules/backend/start");
  const preset = await mutation(harness, "/api/presets/core/stop");
  const suite = await mutation(harness, "/api/quality/e2e-development/run");
  const all = await mutation(harness, "/api/quality/run");

  assert.equal(module.status, 202);
  assert.equal(preset.status, 202);
  assert.equal(suite.status, 202);
  assert.equal(all.status, 202);
  assert.deepEqual(harness.manager.starts, ["backend"]);
  assert.deepEqual(harness.manager.presets, [["core", "stop"]]);
  assert.deepEqual(harness.manager.qualitySuites, ["e2e-development"]);
  assert.equal(harness.manager.qualityAll, 1);
});

test("mutations require canonical cockpit Host, HTTPS Origin, CSRF and upstream token", async (t) => {
  const harness = await serverHarness(t);
  const attempts = [
    { Host: `127.0.0.1:${harness.port}`, Origin: "https://local.surplasse.test" },
    { Host: COCKPIT_HOST, Origin: `http://127.0.0.1:${harness.port}` },
    { Host: COCKPIT_HOST, Origin: null },
    { Host: REPORTS_HOST, Origin: "https://reports.surplasse.test" },
  ];

  for (const overrides of attempts) {
    const response = await mutation(harness, "/api/modules/backend/start", overrides);
    assert.ok([403, 404, 421].includes(response.status), JSON.stringify(overrides));
  }

  const missingCsrf = await request(harness.port, {
    path: "/api/modules/backend/start",
    method: "POST",
    headers: {
      Host: COCKPIT_HOST,
      Origin: "https://local.surplasse.test",
      "Content-Type": "application/json",
      [UPSTREAM_HEADER]: UPSTREAM_TOKEN,
    },
    body: "{}",
  });
  const missingUpstream = await request(harness.port, {
    path: "/api/modules/backend/start",
    method: "POST",
    headers: validMutationHeaders(harness.token),
    body: "{}",
  });

  assert.equal(missingCsrf.status, 403);
  assert.equal(missingUpstream.status, 421);
  assert.deepEqual(harness.manager.starts, []);
});

test("every mutation endpoint rejects caller-supplied parameters", async (t) => {
  const harness = await serverHarness(t);
  const paths = [
    "/api/modules/backend/start",
    "/api/modules/onboarding2/start",
    "/api/presets/core/start",
    "/api/quality/e2e-development/run",
    "/api/quality/run",
  ];

  for (const path of paths) {
    const response = await request(harness.port, {
      path,
      method: "POST",
      headers: validMutationHeaders(harness.token, true),
      body: '{"profile":"frontend-experiment","args":["dangerous"]}',
    });
    assert.equal(response.status, 400, path);
  }
  assert.deepEqual(harness.manager.starts, []);
  assert.deepEqual(harness.manager.presets, []);
  assert.deepEqual(harness.manager.qualitySuites, []);
  assert.equal(harness.manager.qualityAll, 0);
});

test("unknown identifiers, encoded traversal and unsupported methods never reach actions", async (t) => {
  const harness = await serverHarness(t);

  assert.equal((await mutation(harness, "/api/modules/unknown/start")).status, 404);
  assert.equal((await mutation(harness, "/api/modules/backend%2Fstop/start")).status, 404);
  assert.equal((await mutation(harness, "/api/presets/custom/start")).status, 404);
  assert.equal((await mutation(harness, "/api/quality/arbitrary/run")).status, 404);

  for (const method of ["GET", "OPTIONS"]) {
    const response = await request(harness.port, {
      path: "/api/modules/backend/start",
      method,
      headers: {
        Host: COCKPIT_HOST,
        [UPSTREAM_HEADER]: UPSTREAM_TOKEN,
      },
    });
    assert.equal(response.status, 405);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  }
  assert.deepEqual(harness.manager.starts, []);
});

async function serverHarness(t, options = {}) {
  const manager = new StubManager();
  const reportStore = new StubReportStore(options.report === undefined
    ? Buffer.from("<!doctype html><title>Allure</title>")
    : options.report);
  const { server } = createCockpitServer({
    manager,
    publicDirectory: `${cockpitRoot}/public`,
    configuredCockpitUrl: "https://local.surplasse.test",
    configuredReportsUrl: "https://reports.surplasse.test",
    csrfToken: options.csrfToken ?? CSRF_TOKEN,
    upstreamToken: options.upstreamToken ?? UPSTREAM_TOKEN,
    reportStore,
  });
  const port = await listen(server);
  t.after(() => close(server));
  return {
    manager,
    reportStore,
    server,
    port,
    token: options.csrfToken ?? CSRF_TOKEN,
  };
}

function cockpitRequest(harness, path, options = {}) {
  return request(harness.port, {
    ...options,
    path,
    headers: {
      Host: COCKPIT_HOST,
      [UPSTREAM_HEADER]: UPSTREAM_TOKEN,
      ...(options.headers ?? {}),
    },
  });
}

function reportRequest(harness, path, options = {}) {
  return request(harness.port, {
    ...options,
    path,
    headers: {
      Host: REPORTS_HOST,
      [UPSTREAM_HEADER]: UPSTREAM_TOKEN,
      ...(options.headers ?? {}),
    },
  });
}

function mutation(harness, path, headerOverrides = {}) {
  const headers = {
    ...validMutationHeaders(harness.token, true),
    ...headerOverrides,
  };
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) delete headers[name];
  }
  return request(harness.port, {
    path,
    method: "POST",
    headers,
    body: "{}",
  });
}

function validMutationHeaders(token = CSRF_TOKEN, includeUpstream = false) {
  return {
    Host: COCKPIT_HOST,
    Origin: "https://local.surplasse.test",
    "Content-Type": "application/json",
    "X-Surplasse-Cockpit-Token": token,
    ...(includeUpstream ? { [UPSTREAM_HEADER]: UPSTREAM_TOKEN } : {}),
  };
}

class StubReportStore {
  constructor(report) {
    this.report = report;
    this.readCalls = 0;
  }

  async read() {
    this.readCalls += 1;
    return this.report;
  }
}

class StubManager {
  constructor() {
    this.starts = [];
    this.stops = [];
    this.presets = [];
    this.stateCalls = 0;
    this.qualitySuites = [];
    this.qualityAll = 0;
  }

  async state() {
    this.stateCalls += 1;
    return {
      updatedAt: "2026-07-22T00:00:00.000Z",
      modules: [],
      presets: [],
      urlConfiguration: {},
    };
  }

  async start(id) {
    if (id !== "backend") {
      throw new CockpitOperationError("Module inconnu ou non pilotable.", 404);
    }
    this.starts.push(id);
    return { id, status: "starting" };
  }

  async stop(id) {
    this.stops.push(id);
    return { id, status: "stopping" };
  }

  async runPreset(name, action) {
    if (name !== "core") {
      throw new CockpitOperationError("Preset inconnu.", 404);
    }
    this.presets.push([name, action]);
    return { preset: name, action, results: [] };
  }

  async runQualitySuite(id) {
    if (id !== "e2e-development") {
      throw new CockpitOperationError("Suite de vérification inconnue.", 404);
    }
    this.qualitySuites.push(id);
    return { status: "running", suites: [] };
  }

  async runAllQualitySuites() {
    this.qualityAll += 1;
    return { status: "running", suites: [] };
  }
}
