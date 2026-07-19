import { EventEmitter } from "node:events";
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
      app: "https://app.surplasse.test",
      admin: "https://admin.surplasse.test",
    }),
  };
}

export function createManagerHarness(options = {}) {
  const registry = createRegistry(repoRoot, configuredDevelopmentUrls());
  const health = options.health ?? new Map();
  const occupiedPorts = options.occupiedPorts ?? new Set();
  const processController = options.processController ?? new FakeProcessController();
  const mailpitController = options.mailpitController ?? new FakeMailpitController();
  const publicUrls = options.publicUrls ?? new Map();
  let now = options.now ?? 1_700_000_000_000;
  const manager = new CockpitManager(registry, {
    processController,
    mailpitController,
    healthProbe: async (probe) => health.get(probe.url) ?? false,
    portProbe: async (ports) => ports.some((port) => occupiedPorts.has(port)),
    publicProbe: async (healthProbe) =>
      publicUrls.get(healthProbe.url) ?? defaultPublicResult(healthProbe),
    now: () => now,
  });
  return {
    manager,
    registry,
    health,
    occupiedPorts,
    processController,
    mailpitController,
    publicUrls,
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

export class FakeProcessController {
  constructor() {
    this.starts = [];
    this.stops = [];
    this.callbacks = new Map();
    this.nextPid = 10_000;
  }

  async start(definition, onExit) {
    const handle = {
      pid: this.nextPid++,
      running: true,
      exitPromise: Promise.resolve(),
    };
    this.starts.push({ definition, handle });
    this.callbacks.set(handle, onExit);
    return handle;
  }

  async stop(handle) {
    this.stops.push(handle);
    handle.running = false;
    this.callbacks.get(handle)?.({ code: 0, signal: "SIGTERM", error: null });
  }

  exit(handle, exit = { code: 1, signal: null, error: null }) {
    handle.running = false;
    this.callbacks.get(handle)?.(exit);
  }
}

export class FakeMailpitController {
  constructor() {
    this.available = true;
    this.container = null;
    this.starts = [];
    this.stops = [];
    this.instanceId = "current-owner";
  }

  async isDockerAvailable() {
    return this.available;
  }

  async inspect(definition, reference = definition.docker.name) {
    if (!this.container) {
      return missingContainer();
    }
    if (reference !== definition.docker.name && reference !== this.container.id) {
      return missingContainer();
    }
    return { ...this.container };
  }

  async start(definition) {
    this.starts.push(definition);
    this.container = {
      exists: true,
      id: "container-current",
      name: definition.docker.name,
      image: definition.docker.image,
      running: true,
      managedByCockpit: true,
      ownedByCurrent: true,
      owner: this.instanceId,
    };
    return { containerId: this.container.id };
  }

  async stop(definition, handle) {
    if (!this.container?.ownedByCurrent || handle.containerId !== this.container.id) {
      throw new Error("not owned");
    }
    this.stops.push({ definition, handle });
    this.container = null;
  }
}

export class FakeChild extends EventEmitter {
  constructor(pid = 4567) {
    super();
    this.pid = pid;
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
  }
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
  const headers = { ...(options.headers ?? {}) };
  if (body && !headers["Content-Length"]) {
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

function missingContainer() {
  return {
    exists: false,
    id: "",
    name: "",
    image: "",
    running: false,
    managedByCockpit: false,
    ownedByCurrent: false,
    owner: "",
  };
}
