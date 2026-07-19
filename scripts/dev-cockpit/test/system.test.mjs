import assert from "node:assert/strict";
import test from "node:test";

import { MailpitController, ProcessController } from "../system.mjs";
import { createRegistry } from "../registry.mjs";
import { configuredDevelopmentUrls, FakeChild, repoRoot } from "./helpers.mjs";

test("process controller spawns fixed command detached and without shell", async () => {
  const definition = createRegistry(repoRoot, configuredDevelopmentUrls()).modules.find(
    (module) => module.id === "commande",
  );
  const child = new FakeChild();
  let invocation;
  const controller = new ProcessController({
    spawnImpl: (executable, args, options) => {
      invocation = { executable, args, options };
      queueMicrotask(() => child.emit("spawn"));
      return child;
    },
    stdout: null,
    stderr: null,
  });

  const handle = await controller.start(definition, () => {});

  assert.equal(handle.pid, child.pid);
  assert.equal(invocation.executable, "npm");
  assert.deepEqual(invocation.args, ["run", "dev", "--", "--host", "127.0.0.1"]);
  assert.equal(invocation.options.detached, true);
  assert.equal(invocation.options.shell, false);
  assert.deepEqual(invocation.options.stdio, ["ignore", "pipe", "pipe"]);
  assert.equal(invocation.options.cwd, definition.command.cwd);
});

test("process controller stops only owned process group with SIGTERM", async () => {
  const definition = createRegistry(repoRoot, configuredDevelopmentUrls()).modules.find(
    (module) => module.id === "docs",
  );
  const child = new FakeChild(7890);
  const signals = [];
  const controller = new ProcessController({
    spawnImpl: () => {
      queueMicrotask(() => child.emit("spawn"));
      return child;
    },
    killImpl: (pid, signal) => {
      signals.push([pid, signal]);
      queueMicrotask(() => child.emit("exit", 0, signal));
    },
    stdout: null,
    stderr: null,
  });
  const handle = await controller.start(definition, () => {});

  await controller.stop(handle);

  assert.deepEqual(signals, [[-7890, "SIGTERM"]]);
});

test("process controller escalates the same owned group when SIGTERM is ignored", async () => {
  const definition = createRegistry(repoRoot, configuredDevelopmentUrls()).modules.find(
    (module) => module.id === "docs",
  );
  const child = new FakeChild(7891);
  const signals = [];
  const controller = new ProcessController({
    spawnImpl: () => {
      queueMicrotask(() => child.emit("spawn"));
      return child;
    },
    killImpl: (pid, signal) => {
      signals.push([pid, signal]);
      if (signal === "SIGKILL") {
        queueMicrotask(() => child.emit("exit", null, signal));
      }
    },
    setTimer: (callback) => {
      queueMicrotask(callback);
      return 1;
    },
    clearTimer: () => {},
    stdout: null,
    stderr: null,
  });
  const handle = await controller.start(definition, () => {});

  await controller.stop(handle);

  assert.deepEqual(signals, [
    [-7891, "SIGTERM"],
    [-7891, "SIGKILL"],
  ]);
});

test("Mailpit start uses immutable image, loopback ports and two ownership labels", async () => {
  const definition = createRegistry(repoRoot, configuredDevelopmentUrls()).modules.find(
    (module) => module.id === "mailpit",
  );
  const calls = [];
  const controller = new MailpitController({
    instanceId: "owner-123",
    execFile: async (file, args) => {
      calls.push([file, args]);
      if (args[0] === "inspect") {
        throw new Error("not found");
      }
      return { stdout: "container-id\n", stderr: "" };
    },
  });

  const handle = await controller.start(definition);
  const runArgs = calls.find(([, args]) => args[0] === "run")[1];

  assert.deepEqual(handle, { containerId: "container-id" });
  assert.ok(runArgs.includes("axllent/mailpit:v1.30.4"));
  assert.ok(runArgs.includes("127.0.0.1:1025:1025"));
  assert.ok(runArgs.includes("127.0.0.1:8025:8025"));
  assert.ok(runArgs.includes("com.surplasse.dev-cockpit.managed=true"));
  assert.ok(runArgs.includes("com.surplasse.dev-cockpit.owner=owner-123"));
  assert.equal(runArgs.includes("--volume"), false);
  assert.equal(runArgs.includes("--env"), false);
});

test("Mailpit stop rechecks immutable id and never stops a replacement", async () => {
  const definition = createRegistry(repoRoot, configuredDevelopmentUrls()).modules.find(
    (module) => module.id === "mailpit",
  );
  const calls = [];
  const controller = new MailpitController({
    instanceId: "owner-123",
    execFile: async (file, args) => {
      calls.push([file, args]);
      if (args[0] === "inspect") {
        return {
          stdout: "replacement|/surplasse-mailpit|axllent/mailpit:v1.30.4|true|other-owner|true\n",
          stderr: "",
        };
      }
      throw new Error("docker stop must never be called");
    },
  });

  await assert.rejects(() => controller.stop(definition, { containerId: "original" }), /ne sera pas arrêté/u);
  assert.equal(calls.some(([, args]) => args[0] === "stop"), false);
  assert.equal(calls[0][1].at(-1), "original");
});

test("Mailpit stop addresses the verified container id, never its reusable name", async () => {
  const definition = createRegistry(repoRoot, configuredDevelopmentUrls()).modules.find(
    (module) => module.id === "mailpit",
  );
  const calls = [];
  const controller = new MailpitController({
    instanceId: "owner-123",
    execFile: async (file, args) => {
      calls.push([file, args]);
      if (args[0] === "inspect") {
        return {
          stdout: "original|/surplasse-mailpit|axllent/mailpit:v1.30.4|true|owner-123|true\n",
          stderr: "",
        };
      }
      return { stdout: "original\n", stderr: "" };
    },
  });

  await controller.stop(definition, { containerId: "original" });

  const stopArgs = calls.find(([, args]) => args[0] === "stop")[1];
  assert.deepEqual(stopArgs, ["stop", "--time", "5", "original"]);
});
