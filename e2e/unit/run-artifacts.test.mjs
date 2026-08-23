import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  exportCurrentReport,
  prepareRunWorkspace,
  publishRunArtifacts,
  removeRunWorkspace,
} from "../support/run-artifacts.mjs";
import { executeBinary, reportOpener } from "../scripts/run.mjs";

test("single-file report uses an OS file opener instead of a report server", () => {
  assert.deepEqual(reportOpener("/reports/index.html", { platform: "darwin" }), {
    command: "/usr/bin/open",
    argumentsList: ["/reports/index.html"],
  });
  assert.deepEqual(reportOpener("C:\\reports\\index.html", { platform: "win32" }), {
    command: "explorer.exe",
    argumentsList: ["C:\\reports\\index.html"],
  });
  assert.deepEqual(
    reportOpener("/reports/index.html", {
      platform: "linux",
      fileExists: () => true,
    }),
    {
      command: "/usr/bin/wslview",
      argumentsList: ["/reports/index.html"],
    },
  );
});

test(
  "runner forwards termination to the complete child process group",
  { skip: process.platform === "win32" },
  async (context) => {
    const directory = temporaryDirectory(context);
    const grandchildPidFile = join(directory, "grandchild.pid");
    const childScript = `
      const { spawn } = require("node:child_process");
      const { writeFileSync } = require("node:fs");
      const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
        stdio: "ignore",
      });
      writeFileSync(${JSON.stringify(grandchildPidFile)}, String(child.pid));
      setInterval(() => {}, 1000);
    `;
    const initialListeners = process.listenerCount("SIGTERM");
    const execution = executeBinary(
      process.execPath,
      "fixture process",
      ["-e", childScript],
      directory,
      process.env,
    );
    const grandchildPid = await waitForPid(grandchildPidFile);

    process.emit("SIGTERM");

    await assert.rejects(execution, /signal SIGTERM/u);
    await waitForProcessExit(grandchildPid);
    assert.equal(process.listenerCount("SIGTERM"), initialListeners);
  },
);

test("workspace receives the previous history only", (context) => {
  const directory = temporaryDirectory(context);
  const published = artifactPaths(join(directory, "published"));
  const run = artifactPaths(join(directory, "run"));
  mkdirSync(published.report, { recursive: true });
  writeFileSync(join(published.report, "index.html"), "<html>old</html>");
  writeFileSync(published.history, '{"uuid":"old-report"}\n');

  prepareRunWorkspace(published, run);

  assert.equal(readFileSync(run.history, "utf8"), '{"uuid":"old-report"}\n');
  assert.deepEqual(readdirSync(run.root), ["history.jsonl"]);
});

test("first workspace starts without fabricated history", (context) => {
  const directory = temporaryDirectory(context);
  const published = artifactPaths(join(directory, "published"));
  const run = artifactPaths(join(directory, "run"));

  prepareRunWorkspace(published, run);

  assert.equal(existsSync(run.history), false);
});

test("generated report and history replace the current publication", (context) => {
  const directory = temporaryDirectory(context);
  const published = artifactPaths(join(directory, "published"));
  const run = artifactPaths(join(directory, "run"));
  createGeneratedRun(run, "new-report");

  assert.equal(publishRunArtifacts(published, run), published);
  assert.equal(
    readFileSync(join(published.report, "index.html"), "utf8"),
    "<!doctype html><html>new report</html>",
  );
  assert.equal(readFileSync(published.history, "utf8"), '{"uuid":"new-report"}\n');
  assert.equal(
    readFileSync(join(published.playwright, "trace.zip"), "utf8"),
    "diagnostic",
  );
  assert.deepEqual(readdirSync(published.root).sort(), [
    "allure-report",
    "history.jsonl",
    "test-results",
  ]);
});

test("current report can be exported for static hosting", (context) => {
  const directory = temporaryDirectory(context);
  const published = artifactPaths(join(directory, "published"));
  const destination = join(directory, "pages", "local-tests", "index.html");
  createGeneratedRun(published, "report-id");

  assert.equal(exportCurrentReport(published, destination), destination);
  assert.equal(
    readFileSync(destination, "utf8"),
    "<!doctype html><html>new report</html>",
  );
});

test("invalid output leaves the current report untouched", (context) => {
  const directory = temporaryDirectory(context);
  const published = artifactPaths(join(directory, "published"));
  const run = artifactPaths(join(directory, "run"));
  createGeneratedRun(published, "old-report");
  mkdirSync(run.report, { recursive: true });
  writeFileSync(join(run.report, "index.html"), "not html");
  writeFileSync(run.history, '{"uuid":"new-report"}\n');

  assert.throws(() => publishRunArtifacts(published, run), /not valid HTML/u);
  assert.equal(
    readFileSync(join(published.report, "index.html"), "utf8"),
    "<!doctype html><html>new report</html>",
  );
  assert.equal(readFileSync(published.history, "utf8"), '{"uuid":"old-report"}\n');
});

test("temporary workspace cleanup is recursive", (context) => {
  const directory = temporaryDirectory(context);
  const run = artifactPaths(join(directory, "run"));
  createGeneratedRun(run, "report-id");

  removeRunWorkspace(run);

  assert.equal(existsSync(run.root), false);
});

function temporaryDirectory(context) {
  const directory = mkdtempSync(join(tmpdir(), "surplasse-e2e-test-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function artifactPaths(root) {
  return {
    root,
    results: join(root, "allure-results"),
    report: join(root, "allure-report"),
    history: join(root, "history.jsonl"),
    playwright: join(root, "test-results"),
  };
}

function createGeneratedRun(paths, reportId) {
  mkdirSync(paths.report, { recursive: true });
  mkdirSync(paths.playwright, { recursive: true });
  writeFileSync(
    join(paths.report, "index.html"),
    "<!doctype html><html>new report</html>",
  );
  writeFileSync(paths.history, `${JSON.stringify({ uuid: reportId })}\n`);
  writeFileSync(join(paths.playwright, "trace.zip"), "diagnostic");
}

async function waitForPid(path) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const pid = Number.parseInt(readFileSync(path, "utf8"), 10);
      if (Number.isInteger(pid) && pid > 0) {
        return pid;
      }
    } catch {
      // The child has not written its PID yet.
    }
    await delay(10);
  }
  throw new Error("The fixture process did not publish its child PID.");
}

async function waitForProcessExit(pid) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error?.code === "ESRCH") {
        return;
      }
      throw error;
    }
    await delay(10);
  }
  throw new Error(`Fixture process ${pid} survived group termination.`);
}
