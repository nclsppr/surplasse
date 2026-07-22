import { spawn } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { CockpitOperationError } from "./system.mjs";

const MAX_OUTPUT_LENGTH = 8_000;
const STATE_VERSION = 1;

export class QualityRunner {
  constructor(suites, options) {
    this.suites = suites;
    this.definitions = new Map(suites.map((suite) => [suite.id, suite]));
    this.stateFile = options.stateFile;
    this.executeCommand = options.executeCommand ?? runCommand;
    this.now = options.now ?? Date.now;
    this.records = new Map(suites.map((suite) => [suite.id, emptyRecord()]));
    this.active = null;
    this.loadPromise = this.load();
  }

  async state() {
    await this.loadPromise;
    const suites = this.suites.map((definition) => publicSuite(definition, this.records.get(definition.id)));
    return {
      status: overallStatus(suites),
      running: this.active !== null,
      updatedAt: latestUpdate(suites),
      suites,
    };
  }

  async startSuite(id) {
    await this.loadPromise;
    const definition = this.definitions.get(id);
    if (!definition) {
      throw new CockpitOperationError("Suite de vérification inconnue.", 404);
    }
    return this.start([definition]);
  }

  async startAll() {
    await this.loadPromise;
    return this.start(this.suites);
  }

  async stop() {
    await this.loadPromise;
    if (!this.active) {
      return;
    }
    this.active.controller.abort();
    await this.active.promise;
  }

  async start(definitions) {
    if (this.active) {
      throw new CockpitOperationError("Une vérification de la plateforme est déjà en cours.", 409);
    }

    const controller = new AbortController();
    for (const definition of definitions) {
      this.records.set(definition.id, {
        ...emptyRecord(),
        status: "queued",
      });
    }
    const first = definitions[0];
    this.records.set(first.id, runningRecord(this.now()));
    await this.persist();

    const promise = this.execute(definitions, controller.signal).finally(() => {
      this.active = null;
    });
    this.active = { controller, promise };
    return this.state();
  }

  async execute(definitions, signal) {
    for (const definition of definitions) {
      if (signal.aborted) {
        await this.markRemainingInterrupted(definitions, definition.id);
        return;
      }
      if (this.records.get(definition.id).status === "queued") {
        this.records.set(definition.id, runningRecord(this.now()));
        await this.persist();
      }
      await this.executeSuite(definition, signal);
    }
  }

  async executeSuite(definition, signal) {
    const startedAt = this.now();
    let output = "";
    let completedSteps = 0;
    let failedStep = null;
    let exitCode = 0;

    for (const command of definition.commands) {
      if (signal.aborted) {
        failedStep = "Vérification interrompue";
        exitCode = null;
        break;
      }
      let streamed = false;
      let result;
      try {
        result = await this.executeCommand(command, {
          signal,
          onOutput: (chunk) => {
            streamed = true;
            output = appendOutput(output, chunk);
          },
        });
      } catch (error) {
        result = { exitCode: 1, output: safeError(error) };
      }
      if (!streamed) {
        output = appendOutput(output, result.output ?? "");
      }
      if (result.exitCode !== 0) {
        failedStep = command.label;
        exitCode = result.exitCode;
        break;
      }
      completedSteps += 1;
    }

    const completedAt = this.now();
    const interrupted = signal.aborted;
    this.records.set(definition.id, {
      status: interrupted ? "interrupted" : failedStep ? "failed" : "passed",
      startedAt: new Date(startedAt).toISOString(),
      completedAt: new Date(completedAt).toISOString(),
      durationMs: Math.max(0, completedAt - startedAt),
      completedSteps,
      totalSteps: definition.commands.length,
      failedStep,
      exitCode,
      output: sanitizeOutput(output),
    });
    await this.persist();
  }

  async markRemainingInterrupted(definitions, fromId) {
    let found = false;
    for (const definition of definitions) {
      found ||= definition.id === fromId;
      if (found && this.records.get(definition.id).status === "queued") {
        this.records.set(definition.id, { ...emptyRecord(), status: "interrupted" });
      }
    }
    await this.persist();
  }

  async load() {
    try {
      const persisted = JSON.parse(await readFile(this.stateFile, "utf8"));
      if (persisted.version !== STATE_VERSION || typeof persisted.suites !== "object") {
        return;
      }
      for (const definition of this.suites) {
        const record = persisted.suites[definition.id];
        if (isPersistedRecord(record)) {
          this.records.set(definition.id, ["running", "queued"].includes(record.status)
            ? { ...record, status: "interrupted", completedAt: new Date(this.now()).toISOString() }
            : record);
        }
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn("Persisted cockpit quality results could not be loaded.");
      }
    }
  }

  async persist() {
    const directory = dirname(this.stateFile);
    const temporaryFile = `${this.stateFile}.tmp`;
    const suites = Object.fromEntries(this.records);
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryFile, `${JSON.stringify({ version: STATE_VERSION, suites }, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporaryFile, this.stateFile);
  }
}

export function runCommand(command, options = {}) {
  return new Promise((resolveRun) => {
    if (options.signal?.aborted) {
      resolveRun({ exitCode: null, output: "Vérification interrompue avant son démarrage." });
      return;
    }
    const detached = process.platform !== "win32";
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd,
      env: process.env,
      detached,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    let forceTimer = null;
    const collect = (chunk) => {
      const text = chunk.toString("utf8");
      output = appendOutput(output, text);
      options.onOutput?.(text);
    };
    const finish = (exitCode) => {
      if (settled) {
        return;
      }
      settled = true;
      if (forceTimer) {
        clearTimeout(forceTimer);
      }
      options.signal?.removeEventListener("abort", abort);
      resolveRun({ exitCode: options.signal?.aborted ? null : exitCode, output });
    };
    const abort = () => {
      terminateProcessTree(child, "SIGTERM", detached);
      forceTimer = setTimeout(() => terminateProcessTree(child, "SIGKILL", detached), 5_000);
      forceTimer.unref?.();
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", (error) => {
      collect(error.message);
      finish(1);
    });
    child.once("close", (code) => finish(code));
    options.signal?.addEventListener("abort", abort, { once: true });
  });
}

function terminateProcessTree(child, signal, detached) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  try {
    if (process.platform === "win32") {
      const argumentsList = ["/pid", String(child.pid), "/t"];
      if (signal === "SIGKILL") {
        argumentsList.push("/f");
      }
      const killer = spawn("taskkill.exe", argumentsList, {
        detached: false,
        shell: false,
        stdio: "ignore",
        windowsHide: true,
      });
      killer.unref();
      return;
    }
    process.kill(detached ? -child.pid : child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") {
      console.warn("A cockpit quality process could not be terminated.");
    }
  }
}

function emptyRecord() {
  return {
    status: "not-run",
    startedAt: null,
    completedAt: null,
    durationMs: null,
    completedSteps: 0,
    totalSteps: 0,
    failedStep: null,
    exitCode: null,
    output: "",
  };
}

function runningRecord(now) {
  return {
    ...emptyRecord(),
    status: "running",
    startedAt: new Date(now).toISOString(),
  };
}

function publicSuite(definition, record) {
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    hint: definition.hint,
    stepCount: definition.commands.length,
    ...record,
  };
}

function overallStatus(suites) {
  if (suites.some((suite) => ["running", "queued"].includes(suite.status))) {
    return "running";
  }
  if (suites.some((suite) => ["failed", "interrupted"].includes(suite.status))) {
    return "failed";
  }
  if (suites.every((suite) => suite.status === "passed")) {
    return "passed";
  }
  return "not-run";
}

function latestUpdate(suites) {
  const values = suites
    .flatMap((suite) => [suite.completedAt, suite.startedAt])
    .filter(Boolean)
    .sort();
  return values.at(-1) ?? null;
}

function appendOutput(current, addition) {
  return `${current}${addition}`.slice(-MAX_OUTPUT_LENGTH * 2);
}

function sanitizeOutput(value) {
  return value
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "")
    .replace(/\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+\b/gu, "[SECRET STRIPE MASQUÉ]")
    .replace(/\bwhsec_[A-Za-z0-9]+\b/gu, "[SECRET WEBHOOK MASQUÉ]")
    .replace(/\b(authorization:\s*bearer)\s+\S+/giu, "$1 [JETON MASQUÉ]")
    .replace(/\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY)[A-Z0-9_]*=)\S+/gu, "$1[VALEUR MASQUÉE]")
    .slice(-MAX_OUTPUT_LENGTH);
}

function isPersistedRecord(record) {
  return record && typeof record === "object" && typeof record.status === "string";
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}
