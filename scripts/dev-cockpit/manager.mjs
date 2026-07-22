import { CockpitOperationError } from "./system.mjs";

const E2E_SUITE_ID = "e2e-development";
const E2E_REQUIRED_MODULES = Object.freeze([
  "edge",
  "backend",
  "commande",
  "dashboard",
  "onboarding",
]);

export class CockpitManager {
  constructor(registry, options) {
    this.registry = registry;
    this.composeController = options.composeController;
    this.publicProbe = options.publicProbe ?? (async () => ({
      state: "not-configured",
      detail: "Aucune sonde HTTPS publique configurée.",
      statusCode: null,
    }));
    this.qualityRunner = options.qualityRunner ?? null;
    this.reportStore = options.reportStore ?? null;
    this.now = options.now ?? Date.now;
    this.definitions = new Map(registry.modules.map((definition) => [definition.id, definition]));
    this.composeState = new Map();
    this.composeAvailable = false;
    this.composeError = null;
    this.records = new Map(
      registry.modules
        .filter((definition) => definition.kind === "compose")
        .map((definition) => [definition.id, createRecord()]),
    );
    this.lifecycleOperation = null;
    this.actionReserved = false;
    this.publicResults = new Map();
  }

  async state() {
    await this.refreshAll();
    const [quality, report] = await Promise.all([
      this.qualityRunner ? this.qualityRunner.state() : null,
      this.reportStore ? this.reportStore.state() : null,
    ]);
    return {
      updatedAt: new Date(this.now()).toISOString(),
      urlConfiguration: {
        source: this.registry.urlConfiguration.source,
        warnings: this.registry.urlConfiguration.warnings,
        cockpitUrl: this.registry.urlConfiguration.cockpitUrl,
        reportsUrl: this.registry.urlConfiguration.reportsUrl,
        wwwUrl: this.registry.urlConfiguration.wwwUrl,
        publicUrl: this.publicResults.get("@control") ?? null,
        wwwPublicUrl: this.publicResults.get("@www") ?? null,
      },
      compose: {
        available: this.composeAvailable,
        running: this.lifecycleOperation !== null,
        action: this.lifecycleOperation?.action ?? null,
        moduleIds: this.lifecycleOperation?.ids ?? [],
        error: this.composeError,
      },
      modules: this.registry.modules.map((definition) => this.publicModule(definition)),
      presets: Object.keys(this.registry.presets),
      quality,
      reports: report ? { allureDevelopment: report } : null,
    };
  }

  async runQualitySuite(id) {
    return this.withActionReservation(async () => {
      this.requireQualityRunner();
      this.assertLifecycleIdle();
      if (id === E2E_SUITE_ID) {
        await this.assertE2ePlatformReady();
      }
      return this.qualityRunner.startSuite(id);
    });
  }

  async runAllQualitySuites() {
    return this.withActionReservation(async () => {
      this.requireQualityRunner();
      this.assertLifecycleIdle();
      await this.assertE2ePlatformReady();
      return this.qualityRunner.startAll();
    });
  }

  async start(id) {
    return this.withActionReservation(async () => {
      await this.assertQualityIdle();
      this.assertLifecycleIdle();
      const definition = this.requireControllable(id);
      await this.refreshCompose();
      this.requireComposeAvailable();
      const current = this.composeState.get(definition.composeService);
      if (["ready", "starting", "degraded"].includes(composeStatus(current))) {
        return this.publicModule(definition);
      }
      this.beginLifecycle("start", [definition]);
      return this.publicModule(definition);
    });
  }

  async stop(id) {
    return this.withActionReservation(async () => {
      await this.assertQualityIdle();
      this.assertLifecycleIdle();
      const definition = this.requireControllable(id);
      await this.refreshCompose();
      this.requireComposeAvailable();
      const current = composeStatus(this.composeState.get(definition.composeService));
      if (["stopped", "failed"].includes(current)) {
        return this.publicModule(definition);
      }
      this.beginLifecycle("stop", [definition]);
      return this.publicModule(definition);
    });
  }

  async runPreset(name, action) {
    return this.withActionReservation(async () => {
      await this.assertQualityIdle();
      this.assertLifecycleIdle();
      const ids = this.registry.presets[name];
      if (!ids || !["start", "stop"].includes(action)) {
        throw new CockpitOperationError("Preset inconnu.", 404);
      }
      await this.refreshCompose();
      this.requireComposeAvailable();

      const definitions = ids.map((id) => this.requireControllable(id));
      const selected = definitions.filter((definition) => {
        const status = composeStatus(this.composeState.get(definition.composeService));
        return action === "start"
          ? ["stopped", "failed"].includes(status)
          : ["ready", "starting", "degraded"].includes(status);
      });
      const selectedIds = new Set(selected.map((definition) => definition.id));
      const results = definitions.map((definition) => ({
        id: definition.id,
        ok: true,
        skipped: !selectedIds.has(definition.id),
      }));
      if (selected.length > 0) {
        this.beginLifecycle(action, action === "stop" ? [...selected].reverse() : selected);
      }
      return { preset: name, action, results };
    });
  }

  async shutdown() {
    const operations = [];
    if (this.lifecycleOperation) {
      this.lifecycleOperation.controller.abort();
      operations.push(this.lifecycleOperation.promise);
    }
    if (this.qualityRunner) {
      operations.push(this.qualityRunner.stop());
    }
    await Promise.allSettled(operations);
  }

  async refreshAll() {
    const publicDefinitions = this.registry.modules.filter((definition) => definition.publicHealth);
    await Promise.all([
      this.refreshCompose(),
      ...publicDefinitions.map((definition) =>
        this.refreshPublic(definition.id, definition.publicHealth),
      ),
      this.refreshPublic("@control", this.registry.urlConfiguration.controlHealth),
      this.refreshPublic("@www", this.registry.urlConfiguration.wwwHealth),
    ]);
  }

  async refreshCompose() {
    try {
      this.composeState = await this.composeController.inspectAll();
      this.composeAvailable = true;
      this.composeError = null;
      for (const definition of this.registry.modules.filter((item) => item.kind === "compose")) {
        const status = composeStatus(this.composeState.get(definition.composeService));
        if (["ready", "starting", "degraded"].includes(status)) {
          this.records.get(definition.id).lastError = null;
        }
      }
    } catch {
      this.composeAvailable = false;
      this.composeError = "L'état du projet Docker Compose est indisponible.";
    }
  }

  async refreshPublic(key, health) {
    if (!health) {
      this.publicResults.set(key, {
        state: "not-configured",
        detail: "Aucune URL HTTPS publique configurée.",
        statusCode: null,
      });
      return;
    }
    try {
      const result = await this.publicProbe(health);
      this.publicResults.set(key, sanitizePublicResult(result));
    } catch {
      this.publicResults.set(key, {
        state: "unavailable",
        detail: "La sonde HTTPS publique a échoué.",
        statusCode: null,
      });
    }
  }

  beginLifecycle(action, definitions) {
    const controller = new AbortController();
    const ids = definitions.map((definition) => definition.id);
    for (const definition of definitions) {
      const record = this.records.get(definition.id);
      record.intent = action === "start" ? "starting" : "stopping";
      record.lastError = null;
    }

    const services = definitions.map((definition) => definition.composeService);
    const promise = Promise.resolve()
      .then(() => this.composeController[action](services, { signal: controller.signal }))
      .catch((error) => {
        const message = safeError(error);
        for (const definition of definitions) {
          this.records.get(definition.id).lastError = message;
        }
      })
      .finally(async () => {
        for (const definition of definitions) {
          this.records.get(definition.id).intent = null;
        }
        await this.refreshCompose();
        this.lifecycleOperation = null;
      });
    this.lifecycleOperation = { action, ids: Object.freeze(ids), controller, promise };
  }

  publicModule(definition) {
    if (definition.kind === "reserved") {
      return publicShape(definition, {
        status: "reserved",
        detail: definition.description,
        publicUrl: this.publicResults.get(definition.id) ?? null,
        ownership: "none",
        canStart: false,
        canStop: false,
      });
    }

    const record = this.records.get(definition.id);
    const container = this.composeState.get(definition.composeService);
    const internalStatus = !this.composeAvailable
      ? "unavailable"
      : record.intent ?? (record.lastError && !container?.exists ? "failed" : composeStatus(container));
    const publicUrl = this.publicResults.get(definition.id) ?? null;
    const routeUnavailable =
      internalStatus === "ready" && publicUrl !== null && publicUrl.state !== "available";
    const status = routeUnavailable ? "degraded" : internalStatus;
    return publicShape(definition, {
      status,
      detail: routeUnavailable
        ? `Conteneur sain, accès HTTPS indisponible. ${publicUrl.detail}`
        : composeDetail(status, definition.controllable),
      publicUrl,
      ownership: "compose",
      canStart:
        this.composeAvailable &&
        definition.controllable &&
        !this.lifecycleOperation &&
        ["stopped", "failed"].includes(internalStatus),
      canStop:
        this.composeAvailable &&
        definition.controllable &&
        !this.lifecycleOperation &&
        ["ready", "starting", "degraded"].includes(internalStatus),
      startedAt: null,
      lastError: record.lastError,
    });
  }

  async assertE2ePlatformReady() {
    await this.refreshCompose();
    this.requireComposeAvailable();
    const unavailable = E2E_REQUIRED_MODULES.filter((id) => {
      const definition = this.definitions.get(id);
      return composeStatus(this.composeState.get(definition.composeService)) !== "ready";
    });
    if (unavailable.length > 0) {
      throw new CockpitOperationError(
        `Le smoke Playwright exige un cluster sain. Modules indisponibles : ${unavailable.join(", ")}.`,
        409,
      );
    }
  }

  requireControllable(id) {
    const definition = this.definitions.get(id);
    if (!definition || definition.kind !== "compose" || !definition.controllable) {
      throw new CockpitOperationError("Module inconnu ou non pilotable.", 404);
    }
    return definition;
  }

  requireComposeAvailable() {
    if (!this.composeAvailable) {
      throw new CockpitOperationError(
        "Docker Compose est indisponible. Démarrez Docker puis actualisez le cockpit.",
        503,
      );
    }
  }

  requireQualityRunner() {
    if (!this.qualityRunner) {
      throw new CockpitOperationError("Les vérifications ne sont pas configurées.", 503);
    }
  }

  assertLifecycleIdle() {
    if (this.lifecycleOperation) {
      throw new CockpitOperationError("Une opération Docker Compose est déjà en cours.", 409);
    }
  }

  async assertQualityIdle() {
    if (this.qualityRunner && (await this.qualityRunner.state()).running) {
      throw new CockpitOperationError(
        "Une vérification est en cours. Attendez son résultat avant de modifier le cluster.",
        409,
      );
    }
  }

  async withActionReservation(operation) {
    if (this.actionReserved) {
      throw new CockpitOperationError("Une action du cockpit est déjà en préparation.", 409);
    }
    this.actionReserved = true;
    try {
      return await operation();
    } finally {
      this.actionReserved = false;
    }
  }
}

function createRecord() {
  return {
    intent: null,
    lastError: null,
  };
}

function composeStatus(container) {
  if (!container?.exists) {
    return "stopped";
  }
  if (container.state === "running") {
    if (container.health === "unhealthy") return "degraded";
    if (container.health === "starting") return "starting";
    return "ready";
  }
  if (container.state === "restarting" || container.state === "created") {
    return "starting";
  }
  if (container.state === "exited") {
    return container.exitCode === 0 ? "stopped" : "failed";
  }
  if (container.state === "dead" || container.state === "removing") {
    return "failed";
  }
  return "degraded";
}

function composeDetail(status, controllable) {
  const suffix = controllable ? " Piloté par Docker Compose." : " Lecture seule dans ce cockpit.";
  const labels = {
    stopped: "Conteneur arrêté.",
    starting: "Opération Docker Compose en cours.",
    ready: "Conteneur sain.",
    degraded: "Conteneur démarré mais dégradé.",
    failed: "Le dernier conteneur s'est arrêté en échec.",
    stopping: "Arrêt Docker Compose en cours.",
    unavailable: "État Docker Compose indisponible.",
  };
  return `${labels[status] ?? "État inconnu."}${suffix}`;
}

function publicShape(definition, state) {
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    group: definition.group,
    kind: definition.kind,
    ports: definition.ports,
    links: definition.links.filter((item) => item.url),
    ...state,
  };
}

function safeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\u0000-\u001f\u007f]/gu, " ").slice(0, 500);
}

function sanitizePublicResult(result) {
  const allowedStates = new Set([
    "available",
    "redirect",
    "reserved",
    "not-configured",
    "misconfigured",
    "certificate-missing",
    "certificate-error",
    "certificate-mismatch",
    "dns-error",
    "dns-misdirected",
    "tls-error",
    "timeout",
    "proxy-error",
    "gateway-error",
    "http-error",
    "unavailable",
  ]);
  const state = allowedStates.has(result?.state) ? result.state : "unavailable";
  return {
    state,
    detail: safeError(result?.detail ?? "La route HTTPS publique est indisponible."),
    statusCode: Number.isInteger(result?.statusCode) ? result.statusCode : null,
  };
}
