import assert from "node:assert/strict";
import test from "node:test";

import {
  CockpitOperationError,
  ComposeController,
  parseComposePs,
  runFixedCommand,
} from "../system.mjs";
import { repoRoot } from "./helpers.mjs";

const SCRIPT = `${repoRoot}/scripts/compose.sh`;
const SERVICES = Object.freeze(["edge", "backend", "commande"]);

test("Compose state parser returns an explicit missing record for every allowlisted service", () => {
  const statuses = parseComposePs("", parseOptions());

  assert.deepEqual([...statuses], [
    ["edge", missing("edge")],
    ["backend", missing("backend")],
    ["commande", missing("commande")],
  ]);
});

test("Compose state parser accepts array JSON and normalizes state and health", () => {
  const statuses = parseComposePs(
    JSON.stringify([
      composeEntry("edge", { State: "RUNNING", Health: "HEALTHY" }),
      composeEntry("backend", { State: "EXITED", Health: "", ExitCode: 17 }),
    ]),
    parseOptions(),
  );

  assert.deepEqual(statuses.get("edge"), {
    service: "edge",
    exists: true,
    state: "running",
    health: "healthy",
    exitCode: 0,
  });
  assert.deepEqual(statuses.get("backend"), {
    service: "backend",
    exists: true,
    state: "exited",
    health: "",
    exitCode: 17,
  });
  assert.deepEqual(statuses.get("commande"), missing("commande"));
});

test("Compose state parser accepts newline-delimited JSON emitted by Docker Compose", () => {
  const output = [composeEntry("edge"), composeEntry("commande")]
    .map((entry) => JSON.stringify(entry))
    .join("\n");
  const statuses = parseComposePs(output, parseOptions());

  assert.equal(statuses.get("edge").state, "running");
  assert.equal(statuses.get("commande").health, "healthy");
  assert.equal(statuses.get("backend").exists, false);
});

test("Compose state parser rejects malformed, foreign, unknown and duplicate entries", () => {
  const invalidOutputs = [
    "not-json",
    JSON.stringify(composeEntry("backend", { Project: "foreign-project" })),
    JSON.stringify(composeEntry("unknown")),
    `${JSON.stringify(composeEntry("backend"))}\n${JSON.stringify(composeEntry("backend"))}`,
  ];

  for (const output of invalidOutputs) {
    assert.throws(
      () => parseComposePs(output, parseOptions()),
      (error) => error instanceof CockpitOperationError && error.statusCode === 503,
      output,
    );
  }
});

test("Compose controller inspects only the fixed development project", async () => {
  const calls = [];
  const controller = createController(async (executable, args, options) => {
    calls.push({ executable, args, options });
    return {
      exitCode: 0,
      stdout: JSON.stringify(composeEntry("backend")),
      stderr: "",
      aborted: false,
    };
  });

  const statuses = await controller.inspectAll();

  assert.equal(statuses.get("backend").exists, true);
  assert.equal(statuses.get("edge").exists, false);
  assert.deepEqual(calls, [
    {
      executable: SCRIPT,
      args: ["development", "ps", "--all", "--format", "json"],
      options: { cwd: repoRoot, timeoutMs: 20_000, composeProfiles: [] },
    },
  ]);
});

test("Compose controller starts and stops only allowlisted services with fixed arguments", async () => {
  const calls = [];
  const controller = createController(async (executable, args, options) => {
    calls.push({ executable, args, options });
    return { exitCode: 0, stdout: "", stderr: "", aborted: false };
  });
  const controllerSignal = new AbortController();

  await controller.start(["backend", "commande"], { signal: controllerSignal.signal });
  await controller.stop(["commande", "backend"], { signal: controllerSignal.signal });

  assert.deepEqual(calls, [
    {
      executable: SCRIPT,
      args: [
        "development",
        "up",
        "--detach",
        "--build",
        "--wait",
        "backend",
        "commande",
      ],
      options: {
        cwd: repoRoot,
        signal: controllerSignal.signal,
        timeoutMs: 10 * 60_000,
        composeProfiles: [],
      },
    },
    {
      executable: SCRIPT,
      args: ["development", "stop", "--timeout", "10", "commande", "backend"],
      options: {
        cwd: repoRoot,
        signal: controllerSignal.signal,
        timeoutMs: 2 * 60_000,
        composeProfiles: [],
      },
    },
  ]);
});

test("Compose controller activates only the fixed profiles required by optional services", async () => {
  const calls = [];
  const controller = new ComposeController({
    script: SCRIPT,
    cwd: repoRoot,
    profile: "development",
    project: "surplasse",
    services: ["backend", "commande2", "onboarding2", "prometheus"],
    serviceProfiles: {
      commande2: ["frontend-experiment"],
      onboarding2: ["frontend-experiment"],
      prometheus: ["observability"],
    },
    executeCommand: async (executable, args, options) => {
      calls.push({ executable, args, options });
      return { exitCode: 0, stdout: "", stderr: "", aborted: false };
    },
  });

  await controller.inspectAll();
  await controller.start(["backend"]);
  await controller.start(["backend", "commande2", "onboarding2"]);
  await controller.stop(["onboarding2"]);

  assert.deepEqual(calls, [
    {
      executable: SCRIPT,
      args: ["development", "ps", "--all", "--format", "json"],
      options: {
        cwd: repoRoot,
        timeoutMs: 20_000,
        composeProfiles: ["frontend-experiment", "observability"],
      },
    },
    {
      executable: SCRIPT,
      args: ["development", "up", "--detach", "--build", "--wait", "backend"],
      options: {
        cwd: repoRoot,
        signal: undefined,
        timeoutMs: 10 * 60_000,
        composeProfiles: [],
      },
    },
    {
      executable: SCRIPT,
      args: [
        "development",
        "up",
        "--detach",
        "--build",
        "--wait",
        "backend",
        "commande2",
        "onboarding2",
      ],
      options: {
        cwd: repoRoot,
        signal: undefined,
        timeoutMs: 10 * 60_000,
        composeProfiles: ["frontend-experiment"],
      },
    },
    {
      executable: SCRIPT,
      args: ["development", "stop", "--timeout", "10", "onboarding2"],
      options: {
        cwd: repoRoot,
        signal: undefined,
        timeoutMs: 2 * 60_000,
        composeProfiles: ["frontend-experiment"],
      },
    },
  ]);
});

test("Compose controller rejects profile metadata outside its service allowlist", () => {
  assert.throws(
    () => new ComposeController({
      services: ["backend"],
      serviceProfiles: { unknown: ["frontend-experiment"] },
    }),
    /Invalid Compose profile mapping/u,
  );
});

test("Compose controller refuses empty, duplicate and unknown service selections before execution", async () => {
  let executions = 0;
  const controller = createController(async () => {
    executions += 1;
    return { exitCode: 0, stdout: "", stderr: "", aborted: false };
  });

  for (const selection of [[], ["backend", "backend"], ["backend", "unknown"], "backend"]) {
    await assert.rejects(
      () => controller.start(selection),
      (error) => error instanceof CockpitOperationError && [400, 404].includes(error.statusCode),
    );
  }
  assert.equal(executions, 0);
});

test("Compose controller translates command and abort failures without exposing command output", async (t) => {
  t.mock.method(console, "error", () => {});
  const secret = "POSTGRES_PASSWORD=should-not-leak";
  const failed = createController(async () => ({
    exitCode: 1,
    stdout: "",
    stderr: secret,
    aborted: false,
  }));
  const aborted = createController(async () => ({
    exitCode: null,
    stdout: "",
    stderr: "",
    aborted: true,
  }));

  await assert.rejects(
    () => failed.inspectAll(),
    (error) =>
      error instanceof CockpitOperationError &&
      error.statusCode === 503 &&
      !error.message.includes(secret),
  );
  await assert.rejects(
    () => aborted.stop(["backend"]),
    (error) => error instanceof CockpitOperationError && error.statusCode === 409,
  );
});

test("fixed command runner treats shell syntax as a literal argument", async () => {
  const shellText = "$(printf unsafe);`printf unsafe`;value|other";
  const result = await runFixedCommand(
    process.execPath,
    ["-e", "process.stdout.write(process.argv[1])", shellText],
    { cwd: repoRoot, timeoutMs: 5_000 },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, shellText);
  assert.equal(result.stderr, "");
  assert.equal(result.aborted, false);
});

test("fixed command runner passes an explicit Compose profile without shell composition", async () => {
  const result = await runFixedCommand(
    process.execPath,
    ["-e", "process.stdout.write(process.env.COMPOSE_PROFILES ?? '')"],
    {
      cwd: repoRoot,
      timeoutMs: 5_000,
      composeProfiles: ["frontend-experiment"],
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "frontend-experiment");
  assert.equal(result.stderr, "");
});

test("fixed command runner clears an ambient Compose profile for an explicit core operation", async () => {
  const previous = process.env.COMPOSE_PROFILES;
  process.env.COMPOSE_PROFILES = "ambient-profile";
  try {
    const result = await runFixedCommand(
      process.execPath,
      ["-e", "process.stdout.write(process.env.COMPOSE_PROFILES ?? '')"],
      {
        cwd: repoRoot,
        timeoutMs: 5_000,
        composeProfiles: [],
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  } finally {
    if (previous === undefined) {
      delete process.env.COMPOSE_PROFILES;
    } else {
      process.env.COMPOSE_PROFILES = previous;
    }
  }
});

test("fixed command runner preserves a complete Compose-sized response", async () => {
  const output = `${"x".repeat(32_000)}\n`;
  const result = await runFixedCommand(
    process.execPath,
    ["-e", "process.stdout.write(process.argv[1])", output],
    { cwd: repoRoot, timeoutMs: 5_000 },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, output);
  assert.equal(result.stderr, "");
});

function createController(executeCommand) {
  return new ComposeController({
    script: SCRIPT,
    cwd: repoRoot,
    profile: "development",
    project: "surplasse",
    services: SERVICES,
    executeCommand,
  });
}

function parseOptions() {
  return {
    allowedServices: new Set(SERVICES),
    project: "surplasse",
  };
}

function composeEntry(service, overrides = {}) {
  return {
    Project: "surplasse",
    Service: service,
    State: "running",
    Health: "healthy",
    ExitCode: 0,
    ...overrides,
  };
}

function missing(service) {
  return {
    service,
    exists: false,
    state: "",
    health: "",
    exitCode: null,
  };
}
