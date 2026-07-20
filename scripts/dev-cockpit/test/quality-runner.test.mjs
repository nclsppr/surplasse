import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { QualityRunner } from "../quality-runner.mjs";
import { CockpitOperationError } from "../system.mjs";

test("quality runner persists successful results without exposing commands", async () => {
  const directory = await mkdtemp(join(tmpdir(), "surplasse-quality-"));
  const stateFile = join(directory, "results.json");
  const executed = [];
  let now = 1_700_000_000_000;
  const runner = new QualityRunner(suites(), {
    stateFile,
    now: () => (now += 500),
    executeCommand: async (command) => {
      executed.push(command.label);
      return { exitCode: 0, output: `${command.label} passed\n` };
    },
  });

  await runner.startSuite("backend-integration");
  await waitUntilIdle(runner);
  const state = await runner.state();

  assert.deepEqual(executed, ["Compile", "Tests"]);
  assert.equal(state.status, "passed");
  assert.equal(state.suites[0].completedSteps, 2);
  assert.equal(state.suites[0].output, "Compile passed\nTests passed\n");
  assert.equal(JSON.stringify(state).includes("secret-command"), false);
  assert.equal(JSON.parse(await readFile(stateFile, "utf8")).version, 1);
});

test("quality runner stops a suite on its first failed fixed step", async () => {
  const directory = await mkdtemp(join(tmpdir(), "surplasse-quality-"));
  const executed = [];
  const runner = new QualityRunner(suites(), {
    stateFile: join(directory, "results.json"),
    executeCommand: async (command) => {
      executed.push(command.label);
      return command.label === "Compile"
        ? { exitCode: 2, output: "\u001b[31mcompile failed sk_test_123secret\u001b[0m\n" }
        : { exitCode: 0, output: "unexpected" };
    },
  });

  await runner.startSuite("backend-integration");
  await waitUntilIdle(runner);
  const suite = (await runner.state()).suites[0];

  assert.deepEqual(executed, ["Compile"]);
  assert.equal(suite.status, "failed");
  assert.equal(suite.failedStep, "Compile");
  assert.equal(suite.exitCode, 2);
  assert.equal(suite.output, "compile failed [SECRET STRIPE MASQUÉ]\n");
});

test("quality runner serializes runs and rejects unknown suites", async () => {
  const directory = await mkdtemp(join(tmpdir(), "surplasse-quality-"));
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const runner = new QualityRunner(suites(), {
    stateFile: join(directory, "results.json"),
    executeCommand: async () => {
      await pending;
      return { exitCode: 0, output: "done" };
    },
  });

  await runner.startSuite("backend-integration");
  await assert.rejects(() => runner.startAll(), (error) => error instanceof CockpitOperationError && error.statusCode === 409);
  await assert.rejects(() => runner.startSuite("unknown"), (error) => error instanceof CockpitOperationError && error.statusCode === 404);
  release();
  await waitUntilIdle(runner);
});

function suites() {
  return [
    {
      id: "backend-integration",
      label: "Backend integrated",
      description: "Backend checks.",
      hint: "Stop dev mode.",
      commands: [
        { label: "Compile", executable: "secret-command", args: ["--secret"], cwd: "/tmp" },
        { label: "Tests", executable: "secret-command", args: ["test"], cwd: "/tmp" },
      ],
    },
  ];
}

async function waitUntilIdle(runner) {
  while ((await runner.state()).running) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
