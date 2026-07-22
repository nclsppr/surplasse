import assert from "node:assert/strict";
import {
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
  acquireTargetLock,
  exportCurrentReport,
  prepareRunWorkspace,
  publishRunArtifacts,
  removeRunWorkspace,
  resolveCurrentPublication,
} from "../support/run-artifacts.mjs";
import { executeBinary, reportOpener } from "../scripts/run.mjs";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_RUN_ID = "22222222-2222-4222-8222-222222222222";
const REPORT_ID = "report-id-one";
const SECOND_REPORT_ID = "report-id-two";

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
  assert.equal(
    reportOpener("/reports/index.html", {
      platform: "linux",
      fileExists: () => false,
    }),
    null,
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

test("target lock rejects overlap and releases only its own token", (context) => {
  const directory = temporaryDirectory(context);
  const published = publishedPaths(directory);
  const now = () => new Date("2026-07-22T10:00:00.000Z");
  const first = acquireTargetLock(published.lock, "development", {
    host: "test-host",
    now,
    pid: 101,
    token: "first-token",
  });

  assert.throws(
    () =>
      acquireTargetLock(published.lock, "development", {
        host: "test-host",
        now,
        pid: 202,
        token: "second-token",
      }),
    /already locked by PID 101/u,
  );

  first.release();
  const second = acquireTargetLock(published.lock, "development", {
    host: "test-host",
    now,
    pid: 202,
    token: "second-token",
  });
  first.release();
  assert.match(readFileSync(published.lock, "utf8"), /second-token/u);
  second.release();
});

test("an existing lock fails closed instead of racing to reclaim a dead owner", (context) => {
  const directory = temporaryDirectory(context);
  const published = publishedPaths(directory);
  const first = acquireTargetLock(published.lock, "development", {
    host: "test-host",
    pid: 101,
    token: "first-token",
  });

  assert.throws(
    () =>
      acquireTargetLock(published.lock, "development", {
        host: "test-host",
        pid: 202,
        token: "second-token",
      }),
    /Remove .*run\.lock only after confirming that no run is active/u,
  );
  assert.match(readFileSync(published.lock, "utf8"), /first-token/u);
  first.release();
});

test("workspace seeds history while the published report remains untouched", (context) => {
  const directory = temporaryDirectory(context);
  const published = publishedPaths(directory);
  const staged = runPaths(published, RUN_ID);
  mkdirSync(published.report, { recursive: true });
  writeFileSync(join(published.report, "index.html"), "<html>old</html>");
  writeFileSync(published.history, `${JSON.stringify({ uuid: "old-report" })}\n`);

  prepareRunWorkspace(published, staged);

  assert.equal(
    readFileSync(staged.history, "utf8"),
    `${JSON.stringify({ uuid: "old-report" })}\n`,
  );
  assert.equal(
    readFileSync(join(published.report, "index.html"), "utf8"),
    "<html>old</html>",
  );

  removeRunWorkspace(published, staged);
  assert.deepEqual(readdirSync(published.root).sort(), ["allure-report", "history.jsonl"]);
});

test("valid single-file report, summary, history and diagnostics become one release", (
  context,
) => {
  const directory = temporaryDirectory(context);
  const published = publishedPaths(directory);
  const staged = runPaths(published, RUN_ID);
  createPublishedArtifacts(published);
  createGeneratedRun(staged);

  const release = publishRunArtifacts(published, staged);

  assert.equal(
    readFileSync(join(release.report, "index.html"), "utf8"),
    "<!doctype html><html>new report</html>",
  );
  assert.equal(
    JSON.parse(readFileSync(join(release.report, "summary.json"), "utf8")).meta
      .reportId,
    REPORT_ID,
  );
  assert.equal(
    JSON.parse(readFileSync(release.history, "utf8")).uuid,
    REPORT_ID,
  );
  assert.equal(
    readFileSync(join(release.results, "result.json"), "utf8"),
    "new result",
  );
  assert.equal(
    readFileSync(join(release.playwright, ".last-run.json"), "utf8"),
    "new diagnostics",
  );
  assert.equal(resolveCurrentPublication(published).runId, RUN_ID);
  assert.deepEqual(JSON.parse(readFileSync(published.current, "utf8")), {
    version: 1,
    runId: RUN_ID,
  });
});

test("current single-file report can be exported for static hosting", (context) => {
  const directory = temporaryDirectory(context);
  const published = publishedPaths(directory);
  const staged = runPaths(published, RUN_ID);
  const destination = join(directory, "pages", "local-tests", "index.html");
  createGeneratedRun(staged);
  publishRunArtifacts(published, staged);

  assert.equal(exportCurrentReport(published, destination), destination);
  assert.equal(
    readFileSync(destination, "utf8"),
    "<!doctype html><html>new report</html>",
  );
});

test("report export rejects a missing publication", (context) => {
  const directory = temporaryDirectory(context);
  const published = publishedPaths(directory);

  assert.throws(
    () => exportCurrentReport(published, join(directory, "index.html")),
    /No published Allure report/u,
  );
});

test("failed report is publishable when Allure omits the zero passed counter", (context) => {
  const directory = temporaryDirectory(context);
  const published = publishedPaths(directory);
  const staged = runPaths(published, RUN_ID);
  createPublishedArtifacts(published);
  createGeneratedRun(staged, {
    status: "failed",
    stats: { total: 1, failed: 1 },
  });

  publishRunArtifacts(published, staged);

  const current = resolveCurrentPublication(published);
  const summary = JSON.parse(
    readFileSync(join(current.report, "summary.json"), "utf8"),
  );
  assert.equal(summary.status, "failed");
  assert.deepEqual(summary.stats, { total: 1, failed: 1 });
  assert.equal(
    readFileSync(join(current.report, "index.html"), "utf8"),
    "<!doctype html><html>new report</html>",
  );
});

test("an all-skipped Allure report is still a valid publication", (context) => {
  const directory = temporaryDirectory(context);
  const published = publishedPaths(directory);
  const staged = runPaths(published, RUN_ID);
  createPublishedArtifacts(published);
  createGeneratedRun(staged, {
    status: "skipped",
    stats: { total: 1, skipped: 1 },
  });

  publishRunArtifacts(published, staged);

  const current = resolveCurrentPublication(published);
  const summary = JSON.parse(readFileSync(join(current.report, "summary.json"), "utf8"));
  assert.equal(summary.status, "skipped");
});

test("a crash before the pointer switch keeps the previous release visible", (context) => {
  const directory = temporaryDirectory(context);
  const published = publishedPaths(directory);
  const first = runPaths(published, RUN_ID);
  createGeneratedRun(first);
  publishRunArtifacts(published, first);

  const second = runPaths(published, SECOND_RUN_ID);
  createGeneratedRun(second, {
    historyReportId: SECOND_REPORT_ID,
    reportId: SECOND_REPORT_ID,
  });

  assert.throws(
    () => publishRunArtifacts(published, second, {
      commitPointer() {
        throw new Error("simulated SIGKILL boundary");
      },
    }),
    /simulated SIGKILL boundary/u,
  );

  const current = resolveCurrentPublication(published);
  assert.equal(current.runId, RUN_ID);
  assert.equal(
    JSON.parse(readFileSync(join(current.report, "summary.json"), "utf8")).meta
      .reportId,
    REPORT_ID,
  );
  assert.equal(
    JSON.parse(readFileSync(join(published.releases, SECOND_RUN_ID, "history.jsonl"), "utf8")).uuid,
    SECOND_REPORT_ID,
  );
});

test("invalid Allure output leaves every published artifact unchanged", (context) => {
  const directory = temporaryDirectory(context);
  const published = publishedPaths(directory);
  const staged = runPaths(published, RUN_ID);
  createPublishedArtifacts(published);
  createGeneratedRun(staged, { historyReportId: "different-report" });

  assert.throws(
    () => publishRunArtifacts(published, staged),
    /history does not match/u,
  );
  assert.equal(
    readFileSync(join(published.report, "index.html"), "utf8"),
    "<html>old report</html>",
  );
  assert.equal(readFileSync(published.history, "utf8"), '{"uuid":"old-report"}\n');
  assert.equal(
    readFileSync(join(published.results, "result.json"), "utf8"),
    "old result",
  );
});

function temporaryDirectory(context) {
  const directory = mkdtempSync(join(tmpdir(), "surplasse-e2e-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
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

function publishedPaths(root) {
  return {
    root,
    current: join(root, "current.json"),
    results: join(root, "allure-results"),
    report: join(root, "allure-report"),
    history: join(root, "history.jsonl"),
    playwright: join(root, "playwright"),
    lock: join(root, "run.lock"),
    releases: join(root, "releases"),
    staging: join(root, "runs"),
  };
}

function runPaths(published, runId) {
  const root = join(published.staging, runId);
  return {
    root,
    results: join(root, "allure-results"),
    report: join(root, "allure-report"),
    history: join(root, "history.jsonl"),
    playwright: join(root, "playwright"),
  };
}

function createPublishedArtifacts(paths) {
  mkdirSync(paths.report, { recursive: true });
  mkdirSync(paths.results, { recursive: true });
  mkdirSync(paths.playwright, { recursive: true });
  writeFileSync(join(paths.report, "index.html"), "<html>old report</html>");
  writeFileSync(join(paths.report, "summary.json"), '{"status":"passed"}\n');
  writeFileSync(paths.history, '{"uuid":"old-report"}\n');
  writeFileSync(join(paths.results, "result.json"), "old result");
  writeFileSync(join(paths.playwright, ".last-run.json"), "old diagnostics");
}

function createGeneratedRun(
  paths,
  {
    historyReportId = REPORT_ID,
    reportId = REPORT_ID,
    stats = { total: 1, passed: 1 },
    status = "passed",
  } = {},
) {
  mkdirSync(paths.report, { recursive: true });
  mkdirSync(paths.results, { recursive: true });
  mkdirSync(paths.playwright, { recursive: true });
  writeFileSync(
    join(paths.report, "index.html"),
    "<!doctype html><html>new report</html>",
  );
  writeFileSync(
    join(paths.report, "summary.json"),
    `${JSON.stringify({
      status,
      createdAt: 1_784_688_101_071,
      duration: 2_338,
      stats,
      meta: { reportId, singleFile: true },
    })}\n`,
  );
  writeFileSync(paths.history, `${JSON.stringify({ uuid: historyReportId })}\n`);
  writeFileSync(join(paths.results, "result.json"), "new result");
  writeFileSync(join(paths.playwright, ".last-run.json"), "new diagnostics");
}
