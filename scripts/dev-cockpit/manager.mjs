import { CockpitOperationError, probeHttp, probePorts } from "./system.mjs";

const MANAGED_KINDS = new Set(["process", "docker"]);

export class CockpitManager {
  constructor(registry, options) {
    this.registry = registry;
    this.processController = options.processController;
    this.mailpitController = options.mailpitController;
    this.healthProbe = options.healthProbe ?? probeHttp;
    this.portProbe = options.portProbe ?? probePorts;
    this.publicProbe = options.publicProbe ?? (async () => ({
      state: "not-configured",
      detail: "Aucune sonde HTTPS publique configurée.",
      statusCode: null,
    }));
    this.now = options.now ?? Date.now;
    this.definitions = new Map(registry.modules.map((definition) => [definition.id, definition]));
    this.records = new Map(
      registry.modules
        .filter((definition) => MANAGED_KINDS.has(definition.kind))
        .map((definition) => [definition.id, createRecord()]),
    );
    this.operations = new Map();
    this.publicResults = new Map();
  }

  async state() {
    await this.refreshAll();
    return {
      updatedAt: new Date(this.now()).toISOString(),
      urlConfiguration: {
        source: this.registry.urlConfiguration.source,
        warnings: this.registry.urlConfiguration.warnings,
        cockpitUrl: this.registry.urlConfiguration.cockpitUrl,
        wwwUrl: this.registry.urlConfiguration.wwwUrl,
        publicUrl: this.publicResults.get("@control") ?? null,
        wwwPublicUrl: this.publicResults.get("@www") ?? null,
      },
      modules: this.registry.modules.map((definition) => this.publicModule(definition)),
      presets: Object.keys(this.registry.presets),
    };
  }

  async refreshAll() {
    const managed = this.registry.modules.filter((definition) => MANAGED_KINDS.has(definition.kind));
    const publicDefinitions = this.registry.modules.filter((definition) => definition.kind !== "derived");
    await Promise.all([
      ...managed.map((definition) => this.refreshManaged(definition)),
      ...publicDefinitions.map((definition) =>
        this.refreshPublic(definition.id, definition.publicHealth),
      ),
      this.refreshPublic("@control", this.registry.urlConfiguration.controlHealth),
      this.refreshPublic("@www", this.registry.urlConfiguration.wwwHealth),
    ]);
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

  async start(id) {
    return this.withOperation(id, async () => {
      const definition = this.requireManaged(id);
      await this.refreshManaged(definition, true);
      const record = this.records.get(id);

      if (record.owned && ["starting", "ready", "degraded"].includes(record.status)) {
        return this.publicModule(definition);
      }
      if (record.status === "external") {
        throw new CockpitOperationError(`${definition.label} est déjà lancé hors de ce cockpit.`, 409);
      }
      if (record.status === "conflict") {
        throw new CockpitOperationError(`Un port de ${definition.label} est déjà occupé.`, 409);
      }
      if (definition.requiresDocker && !(await this.mailpitController.isDockerAvailable())) {
        throw new CockpitOperationError("Docker doit être démarré avant le Backend.", 409);
      }

      record.status = "starting";
      record.detail = "Démarrage en cours.";
      record.lastError = null;
      record.startedAt = this.now();
      const generation = record.generation + 1;
      record.generation = generation;

      try {
        if (definition.kind === "process") {
          const handle = await this.processController.start(definition, (exit) =>
            this.processExited(id, generation, exit),
          );
          if (record.generation !== generation || !handle.running) {
            throw new Error(`${definition.label} s'est arrêté pendant son démarrage.`);
          }
          record.handle = handle;
        } else {
          if (!(await this.mailpitController.isDockerAvailable())) {
            throw new CockpitOperationError("Docker doit être démarré avant Mailpit.", 409);
          }
          record.handle = await this.mailpitController.start(definition);
        }
        record.owned = true;
      } catch (error) {
        record.status = "failed";
        record.detail = "Le démarrage a échoué.";
        record.lastError = safeError(error);
        record.owned = false;
        record.handle = null;
        throw error;
      }

      return this.publicModule(definition);
    });
  }

  async stop(id) {
    return this.withOperation(id, async () => {
      const definition = this.requireManaged(id);
      await this.refreshManaged(definition, true);
      const record = this.records.get(id);

      if (!record.owned) {
        if (record.status === "stopped" || record.status === "failed") {
          return this.publicModule(definition);
        }
        throw new CockpitOperationError(`${definition.label} ne sera pas arrêté car il n'appartient pas à ce cockpit.`, 409);
      }

      record.stopping = true;
      record.status = "stopping";
      record.detail = "Arrêt en cours.";
      try {
        if (definition.kind === "process") {
          await this.processController.stop(record.handle);
        } else {
          await this.mailpitController.stop(definition, record.handle);
        }
        record.handle = null;
        record.owned = false;
        record.status = "stopped";
        record.detail = "Arrêté.";
        record.startedAt = null;
      } finally {
        record.stopping = false;
      }
      return this.publicModule(definition);
    });
  }

  async runPreset(name, action) {
    const ids = this.registry.presets[name];
    if (!ids || !["start", "stop"].includes(action)) {
      throw new CockpitOperationError("Preset inconnu.", 404);
    }

    const orderedIds = action === "stop" ? [...ids].reverse() : [...ids];
    const results = [];
    for (const id of orderedIds) {
      const definition = this.definitions.get(id);
      await this.refreshManaged(definition, true);
      const record = this.records.get(id);
      try {
        if (action === "start") {
          if (record.status === "external" || (record.owned && ["starting", "ready", "degraded"].includes(record.status))) {
            results.push({ id, ok: true, skipped: true });
            continue;
          }
          await this.start(id);
        } else {
          if (!record.owned) {
            results.push({ id, ok: true, skipped: true });
            continue;
          }
          await this.stop(id);
        }
        results.push({ id, ok: true, skipped: false });
      } catch (error) {
        results.push({ id, ok: false, error: safeError(error) });
      }
    }
    return { preset: name, action, results };
  }

  async stopAllOwned() {
    const allIds = [...this.registry.presets.all].reverse();
    for (const id of allIds) {
      const record = this.records.get(id);
      if (!record?.owned) {
        continue;
      }
      try {
        await this.stop(id);
      } catch {
        // Shutdown remains best-effort while preserving the ownership checks.
      }
    }
  }

  async refreshManaged(definition, force = false) {
    if (!definition || !MANAGED_KINDS.has(definition.kind)) {
      return;
    }
    const record = this.records.get(definition.id);
    if ((!force && this.operations.has(definition.id)) || record.status === "stopping") {
      return;
    }

    const healthy = await this.healthProbe(definition.health);
    if (definition.kind === "process" && record.owned && record.handle?.running) {
      if (healthy) {
        record.status = "ready";
        record.detail = "Prêt et piloté par ce cockpit.";
      } else if (this.now() - record.startedAt <= definition.startupTimeoutMs) {
        record.status = "starting";
        record.detail = "Le processus tourne, la sonde attend encore.";
      } else {
        record.status = "degraded";
        record.detail = "Le processus tourne mais sa sonde ne répond pas.";
      }
      return;
    }

    if (definition.kind === "docker") {
      const container = record.handle?.containerId
        ? await this.mailpitController.inspect(definition, record.handle.containerId)
        : await this.mailpitController.inspect(definition);
      if (
        container.exists &&
        container.managedByCockpit &&
        container.ownedByCurrent &&
        container.id === record.handle?.containerId &&
        container.name === definition.docker.name &&
        container.image === definition.docker.image &&
        container.running
      ) {
        record.owned = true;
        record.status = healthy ? "ready" : "starting";
        record.detail = healthy ? "Prêt et piloté par ce cockpit." : "Le conteneur démarre.";
        return;
      }
      if (record.handle?.containerId && !container.exists) {
        record.handle = null;
        record.owned = false;
      }

      const namedContainer = record.handle?.containerId ? await this.mailpitController.inspect(definition) : container;
      if (namedContainer.exists) {
        record.owned = false;
        const recognizedExternal = namedContainer.managedByCockpit && namedContainer.running && healthy;
        record.status = recognizedExternal ? "external" : "conflict";
        record.detail = recognizedExternal
          ? "Conteneur d'un autre cockpit, arrêt interdit."
          : "Le nom de conteneur est déjà utilisé hors de ce cockpit.";
        return;
      }
      record.owned = false;
    }

    if (healthy) {
      record.owned = false;
      record.status = "external";
      record.detail = "Service lancé hors de ce cockpit, arrêt interdit.";
      return;
    }

    const occupied = await this.portProbe(definition.ports);
    if (occupied) {
      record.owned = false;
      record.status = "conflict";
      record.detail = "Un port attendu est occupé par un autre service.";
      return;
    }

    record.owned = false;
    record.handle = null;
    if (record.status !== "failed") {
      record.status = "stopped";
      record.detail = "Arrêté.";
      record.startedAt = null;
    }
  }

  processExited(id, generation, exit) {
    const record = this.records.get(id);
    if (!record || record.generation !== generation) {
      return;
    }
    record.handle = null;
    record.owned = false;
    if (record.stopping) {
      record.status = "stopped";
      record.detail = "Arrêté.";
      record.startedAt = null;
      return;
    }
    record.status = "failed";
    record.detail = "Le processus s'est arrêté de façon inattendue.";
    record.lastError = exit.error
      ? safeError(exit.error)
      : `Sortie ${exit.code ?? "inconnue"}${exit.signal ? `, signal ${exit.signal}` : ""}.`;
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
    if (definition.kind === "derived") {
      const source = this.records.get(definition.derivedFrom);
      const status = deriveStatus(source?.status);
      return publicShape(definition, {
        status,
        detail: status === "ready" ? "Disponible avec le Backend, sans processus autonome." : definition.description,
        publicUrl: null,
        ownership: "derived",
        canStart: false,
        canStop: false,
      });
    }

    const record = this.records.get(definition.id);
    const publicUrl = this.publicResults.get(definition.id) ?? null;
    const routeUnavailable =
      record.status === "ready" && publicUrl !== null && publicUrl.state !== "available";
    return publicShape(definition, {
      status: routeUnavailable ? "degraded" : record.status,
      detail: routeUnavailable
        ? `Service interne prêt, accès public indisponible. ${publicUrl.detail}`
        : record.detail,
      publicUrl,
      ownership: record.owned ? "cockpit" : record.status === "external" ? "external" : "none",
      canStart: ["stopped", "failed"].includes(record.status),
      canStop: record.owned && ["starting", "ready", "degraded"].includes(record.status),
      startedAt: record.startedAt ? new Date(record.startedAt).toISOString() : null,
      lastError: record.lastError,
    });
  }

  requireManaged(id) {
    const definition = this.definitions.get(id);
    if (!definition || !MANAGED_KINDS.has(definition.kind)) {
      throw new CockpitOperationError("Module inconnu ou non pilotable.", 404);
    }
    return definition;
  }

  withOperation(id, operation) {
    if (this.operations.has(id)) {
      throw new CockpitOperationError("Une opération est déjà en cours pour ce module.", 409);
    }
    const promise = Promise.resolve().then(operation);
    this.operations.set(id, promise);
    return promise.finally(() => this.operations.delete(id));
  }
}

function createRecord() {
  return {
    status: "stopped",
    detail: "Arrêté.",
    owned: false,
    handle: null,
    stopping: false,
    startedAt: null,
    lastError: null,
    generation: 0,
  };
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

function deriveStatus(sourceStatus) {
  if (["ready", "external"].includes(sourceStatus)) {
    return "ready";
  }
  if (["starting", "stopping"].includes(sourceStatus)) {
    return sourceStatus;
  }
  if (["failed", "degraded", "conflict"].includes(sourceStatus)) {
    return "degraded";
  }
  return "stopped";
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
