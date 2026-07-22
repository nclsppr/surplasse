import http from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CockpitManager } from "../manager.mjs";
import { createRegistry } from "../registry.mjs";

export const cockpitRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = resolve(cockpitRoot, "../..");

export function configuredDevelopmentUrls() {
  return {
    source: "config/domains/development.env",
    warnings: Object.freeze([]),
    baseDomain: "surplasse.test",
    certificateFile: `${repoRoot}/.certs/surplasse.test.pem`,
    urls: Object.freeze({
      cockpit: "https://local.surplasse.test",
      backend: "https://api.surplasse.test",
      commande: "https://le-cormoran.surplasse.test",
      dashboard: "https://dashboard.surplasse.test",
      onboarding: "https://surplasse.test",
      docs: "https://docs.surplasse.test",
      mailpit: "https://mail.surplasse.test",
      reports: "https://reports.surplasse.test",
      grafana: "https://grafana.surplasse.test",
      app: "https://app.surplasse.test",
      admin: "https://admin.surplasse.test",
    }),
  };
}

export function createManagerHarness(options = {}) {
  const registry = createRegistry(repoRoot, configuredDevelopmentUrls());
  const composeController = options.composeController ?? new FakeComposeController(
    registry.composeServices,
  );
  const publicUrls = options.publicUrls ?? new Map();
  const qualityRunner = options.qualityRunner ?? new FakeQualityRunner();
  const reportStore = options.reportStore ?? new FakeReportStore();
  let now = options.now ?? 1_700_000_000_000;
  const manager = new CockpitManager(registry, {
    composeController,
    publicProbe: async (healthProbe) =>
      publicUrls.get(healthProbe.url) ?? defaultPublicResult(healthProbe),
    qualityRunner,
    reportStore,
    now: () => now,
  });
  return {
    manager,
    registry,
    composeController,
    publicUrls,
    qualityRunner,
    reportStore,
    advance(milliseconds) {
      now += milliseconds;
    },
  };
}

function defaultPublicResult(healthProbe) {
  if (healthProbe.expectation === "reserved") {
    return {
      state: "reserved",
      detail: "Domaine réservé, réponse HTTP 503 attendue.",
      statusCode: 503,
    };
  }
  if (healthProbe.expectation === "redirect") {
    return {
      state: "redirect",
      detail: "Redirection publique HTTP 308 conforme.",
      statusCode: 308,
    };
  }
  return {
    state: "available",
    detail: "DNS, certificat TLS, Caddy et route répondent en HTTP 200.",
    statusCode: 200,
  };
}

export class FakeComposeController {
  constructor(services = []) {
    this.services = new Set(services);
    this.states = new Map(services.map((service) => [service, missingComposeService(service)]));
    this.starts = [];
    this.stops = [];
    this.inspectError = null;
    this.startError = null;
    this.stopError = null;
    this.operation = null;
    this.aborted = false;
  }

  set(service, overrides = {}) {
    if (!this.services.has(service)) {
      throw new Error(`Unknown fake Compose service: ${service}`);
    }
    this.states.set(service, composeService(service, overrides));
  }

  setAllReady() {
    for (const service of this.services) {
      this.set(service);
    }
  }

  async inspectAll() {
    if (this.inspectError) {
      throw this.inspectError;
    }
    return new Map(this.states);
  }

  deferNextOperation() {
    this.operation = deferred();
    return this.operation;
  }

  async start(services, options = {}) {
    this.starts.push([...services]);
    await this.waitForOperation(options.signal);
    if (this.startError) {
      throw this.startError;
    }
    for (const service of services) {
      this.set(service);
    }
  }

  async stop(services, options = {}) {
    this.stops.push([...services]);
    await this.waitForOperation(options.signal);
    if (this.stopError) {
      throw this.stopError;
    }
    for (const service of services) {
      this.states.set(service, missingComposeService(service));
    }
  }

  async waitForOperation(signal) {
    if (!this.operation) {
      return;
    }
    if (signal?.aborted) {
      this.aborted = true;
      throw abortError();
    }
    let onAbort;
    const aborted = new Promise((_, reject) => {
      onAbort = () => {
        this.aborted = true;
        reject(abortError());
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
    try {
      await Promise.race([this.operation.promise, aborted]);
    } finally {
      signal?.removeEventListener("abort", onAbort);
      this.operation = null;
    }
  }
}

export class FakeQualityRunner {
  constructor() {
    this.running = false;
    this.suiteStarts = [];
    this.allStarts = 0;
    this.stops = 0;
  }

  async state() {
    return {
      status: this.running ? "running" : "not-run",
      running: this.running,
      updatedAt: null,
      suites: [],
    };
  }

  async startSuite(id) {
    this.suiteStarts.push(id);
    this.running = true;
    return this.state();
  }

  async startAll() {
    this.allStarts += 1;
    this.running = true;
    return this.state();
  }

  async stop() {
    this.stops += 1;
    this.running = false;
  }
}

export class FakeReportStore {
  constructor(state = {}) {
    this.reportState = {
      available: false,
      url: "https://reports.surplasse.test",
      status: "not-run",
      createdAt: null,
      durationMs: null,
      total: 0,
      passed: 0,
      ...state,
    };
  }

  async state() {
    return { ...this.reportState };
  }
}

export function composeService(service, overrides = {}) {
  return Object.freeze({
    service,
    exists: true,
    state: "running",
    health: "healthy",
    exitCode: 0,
    ...overrides,
  });
}

export function missingComposeService(service) {
  return Object.freeze({
    service,
    exists: false,
    state: "",
    health: "",
    exitCode: null,
  });
}

export function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function abortError() {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

export async function waitUntil(predicate, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolveWait) => setImmediate(resolveWait));
  }
  throw new Error("Condition was not reached before the test timeout.");
}

export async function listen(server) {
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  return server.address().port;
}

export async function close(server) {
  if (!server.listening) {
    return;
  }
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
}

export function request(port, options = {}) {
  const body = options.body ?? "";
  const headers = options.rawHeaders ?? { ...(options.headers ?? {}) };
  if (body && !options.rawHeaders && !headers["Content-Length"]) {
    headers["Content-Length"] = Buffer.byteLength(body);
  }
  return new Promise((resolveRequest, rejectRequest) => {
    const outgoing = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: options.path ?? "/",
        method: options.method ?? "GET",
        headers,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolveRequest({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    outgoing.once("error", rejectRequest);
    outgoing.end(body);
  });
}
