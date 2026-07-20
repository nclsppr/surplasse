import assert from "node:assert/strict";
import test from "node:test";

import { createCockpitServer } from "../server.mjs";
import { CockpitOperationError } from "../system.mjs";
import { close, cockpitRoot, listen, request } from "./helpers.mjs";

const TOKEN = "a".repeat(64);

test("state is available only through accepted hosts and exposes strict security headers", async (t) => {
  const harness = await serverHarness(t);
  const response = await request(harness.port, {
    path: "/api/state",
    headers: { Host: "local.surplasse.test" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.match(response.headers["content-security-policy"], /object-src 'none'/u);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
  assert.equal(response.body.includes(TOKEN), false);

  const hostile = await request(harness.port, {
    path: "/api/state",
    headers: { Host: `127.0.0.1:${harness.port}` },
  });
  assert.equal(hostile.status, 421);
  assert.equal(harness.manager.stateCalls, 1);
});

test("index receives a per-server CSRF token without unsafe inline script", async (t) => {
  const first = await serverHarness(t, { csrfToken: "b".repeat(64) });
  const second = await serverHarness(t, { csrfToken: "c".repeat(64) });

  const firstIndex = await request(first.port, { headers: { Host: "local.surplasse.test" } });
  const secondIndex = await request(second.port, { headers: { Host: "local.surplasse.test" } });

  assert.match(firstIndex.body, /b{64}/u);
  assert.match(secondIndex.body, /c{64}/u);
  assert.equal(firstIndex.body.includes("c".repeat(64)), false);
  assert.equal(firstIndex.headers["content-security-policy"].includes("unsafe-inline"), false);
});

test("quality dashboard is served from the canonical cockpit route", async (t) => {
  const harness = await serverHarness(t);
  const response = await request(harness.port, {
    path: "/tests",
    headers: { Host: "local.surplasse.test" },
  });

  assert.equal(response.status, 200);
  assert.match(response.body, /État de la plateforme/u);
  assert.match(response.body, /id="run-all-tests"/u);
});

test("canonical HTTPS Host Origin and token can start an allowlisted module", async (t) => {
  const harness = await serverHarness(t);
  const response = await mutation(harness, "/api/modules/backend/start");

  assert.equal(response.status, 200);
  assert.deepEqual(harness.manager.starts, ["backend"]);
});

test("configured local.surplasse.test Host and HTTPS Origin are accepted as one pair", async (t) => {
  const harness = await serverHarness(t);
  const response = await mutation(harness, "/api/modules/docs/start", {
    Host: "local.surplasse.test",
    Origin: "https://local.surplasse.test",
  });

  assert.equal(response.status, 200);
  assert.deepEqual(harness.manager.starts, ["docs"]);
});

test("crossed Host Origin pairs, absent Origin and hostile Host are refused before actions", async (t) => {
  const harness = await serverHarness(t);
  const attempts = [
    { Host: `localhost:${harness.port}`, Origin: "https://local.surplasse.test" },
    { Host: "local.surplasse.test", Origin: `http://localhost:${harness.port}` },
    { Host: "local.surplasse.test", Origin: null },
    { Host: `evil.test:${harness.port}`, Origin: `http://localhost:${harness.port}` },
  ];

  for (const headers of attempts) {
    const response = await mutation(harness, "/api/modules/backend/start", headers);
    assert.ok([403, 421].includes(response.status), JSON.stringify(headers));
  }
  assert.deepEqual(harness.manager.starts, []);
});

test("bad or missing CSRF token is refused and no CORS header is emitted", async (t) => {
  const harness = await serverHarness(t);
  const baseHeaders = {
    Host: "local.surplasse.test",
    Origin: "https://local.surplasse.test",
    "Content-Type": "application/json",
  };
  const missing = await request(harness.port, {
    path: "/api/modules/backend/start",
    method: "POST",
    headers: baseHeaders,
    body: "{}",
  });
  const invalid = await request(harness.port, {
    path: "/api/modules/backend/start",
    method: "POST",
    headers: { ...baseHeaders, "X-Surplasse-Cockpit-Token": "wrong" },
    body: "{}",
  });

  assert.equal(missing.status, 403);
  assert.equal(invalid.status, 403);
  assert.equal(invalid.headers["access-control-allow-origin"], undefined);
  assert.deepEqual(harness.manager.starts, []);
});

test("mutation rejects command parameters, unknown IDs and encoded traversal", async (t) => {
  const harness = await serverHarness(t);
  const parameterized = await request(harness.port, {
    path: "/api/modules/backend/start",
    method: "POST",
    headers: validMutationHeaders(harness.token),
    body: '{"args":["dangerous"]}',
  });
  const unknown = await mutation(harness, "/api/modules/unknown/start");
  const traversal = await mutation(harness, "/api/modules/backend%2Fstop/start");

  assert.equal(parameterized.status, 400);
  assert.equal(unknown.status, 404);
  assert.equal(traversal.status, 404);
  assert.deepEqual(harness.manager.starts, []);
});

test("mutation routes refuse GET and OPTIONS without enabling CORS", async (t) => {
  const harness = await serverHarness(t);
  for (const method of ["GET", "OPTIONS"]) {
    const response = await request(harness.port, {
      path: "/api/modules/backend/start",
      method,
      headers: { Host: "local.surplasse.test" },
    });
    assert.equal(response.status, 405);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  }
});

test("preset endpoint accepts only fixed preset and action names", async (t) => {
  const harness = await serverHarness(t);
  const valid = await mutation(harness, "/api/presets/core/start");
  const invalid = await mutation(harness, "/api/presets/custom/start");

  assert.equal(valid.status, 200);
  assert.equal(invalid.status, 404);
  assert.deepEqual(harness.manager.presets, [["core", "start"]]);
});

test("quality endpoints run only fixed suites and accept no arguments", async (t) => {
  const harness = await serverHarness(t);
  const suite = await mutation(harness, "/api/quality/backend-integration/run");
  const all = await mutation(harness, "/api/quality/run");
  const unknown = await mutation(harness, "/api/quality/arbitrary/run");
  const parameterized = await request(harness.port, {
    path: "/api/quality/backend-integration/run",
    method: "POST",
    headers: validMutationHeaders(harness.token),
    body: '{"command":"dangerous"}',
  });

  assert.equal(suite.status, 202);
  assert.equal(all.status, 202);
  assert.equal(unknown.status, 404);
  assert.equal(parameterized.status, 400);
  assert.deepEqual(harness.manager.qualitySuites, ["backend-integration"]);
  assert.equal(harness.manager.qualityAll, 1);
});

async function serverHarness(t, options = {}) {
  const manager = new StubManager();
  const { server } = createCockpitServer({
    manager,
    publicDirectory: `${cockpitRoot}/public`,
    configuredCockpitUrl: "https://local.surplasse.test",
    csrfToken: options.csrfToken ?? TOKEN,
  });
  const port = await listen(server);
  t.after(() => close(server));
  return { manager, server, port, token: options.csrfToken ?? TOKEN };
}

function mutation(harness, path, headerOverrides = {}) {
  const headers = { ...validMutationHeaders(harness.token), ...headerOverrides };
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) {
      delete headers[name];
    }
  }
  return request(harness.port, {
    path,
    method: "POST",
    headers,
    body: "{}",
  });
}

function validMutationHeaders(token = TOKEN) {
  return {
    Host: "local.surplasse.test",
    Origin: "https://local.surplasse.test",
    "Content-Type": "application/json",
    "X-Surplasse-Cockpit-Token": token,
  };
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
    return { updatedAt: "2026-07-19T00:00:00.000Z", modules: [], presets: [], urlConfiguration: {} };
  }

  async start(id) {
    if (!["backend", "docs"].includes(id)) {
      throw new CockpitOperationError("Module inconnu ou non pilotable.", 404);
    }
    this.starts.push(id);
    return { id };
  }

  async stop(id) {
    this.stops.push(id);
    return { id };
  }

  async runPreset(name, action) {
    if (name !== "core") {
      throw new CockpitOperationError("Preset inconnu.", 404);
    }
    this.presets.push([name, action]);
    return { preset: name, action, results: [] };
  }

  async runQualitySuite(id) {
    if (id !== "backend-integration") {
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
