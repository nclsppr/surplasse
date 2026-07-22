import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AllureReportStore } from "../allure-report-store.mjs";

const REPORT_URL = "https://reports.surplasse.test";

test("missing Allure report has an explicit not-run public state", async () => {
  const fixture = await reportFixture();

  assert.deepEqual(await fixture.store.state(), {
    available: false,
    url: REPORT_URL,
    status: "not-run",
    createdAt: null,
    durationMs: null,
    total: 0,
    passed: 0,
    skipped: 0,
  });
  assert.equal(await fixture.store.read(), null);
});

test("single-file Allure report and summary are exposed with normalized metadata", async () => {
  const fixture = await reportFixture();
  const report = Buffer.from("<!doctype html><title>Allure</title>");
  await writeFile(fixture.reportFile, report);
  await writeFile(
    fixture.summaryFile,
    JSON.stringify({
      status: "passed",
      createdAt: Date.parse("2026-07-22T02:00:00.000Z"),
      duration: 2_338,
      stats: { total: 7, passed: 6, skipped: 1 },
    }),
  );

  assert.deepEqual(await fixture.store.state(), {
    available: true,
    url: REPORT_URL,
    status: "passed",
    createdAt: "2026-07-22T02:00:00.000Z",
    durationMs: 2_338,
    total: 7,
    passed: 6,
    skipped: 1,
  });
  assert.deepEqual(await fixture.store.read(), report);
});

test("available report survives a missing, malformed or invalid summary", async (t) => {
  const summaryCases = [
    [null, null],
    ["not-json", null],
    [JSON.stringify({
      status: "invented",
      createdAt: "yesterday",
      duration: -1,
      stats: { total: 1.5, passed: -2 },
    }), 0],
  ];

  for (const [index, [summary, expectedDuration]] of summaryCases.entries()) {
    await t.test(`summary-${index}`, async () => {
      const fixture = await reportFixture();
      await writeFile(fixture.reportFile, "<!doctype html>");
      if (summary !== null) {
        await writeFile(fixture.summaryFile, summary);
      }

      const state = await fixture.store.state();
      assert.equal(state.available, true);
      assert.equal(state.status, "unknown");
      assert.equal(state.createdAt, null);
      assert.equal(state.durationMs, expectedDuration);
      assert.equal(state.total, 0);
      assert.equal(state.passed, 0);
      assert.equal(state.skipped, 0);
    });
  }
});

test("report store refuses report symlinks and paths traversing a symlinked directory", async (t) => {
  await t.test("report symlink", async () => {
    const fixture = await reportFixture();
    const target = join(fixture.directory, "outside.html");
    await writeFile(target, "outside");
    await symlink(target, fixture.reportFile);

    assert.equal((await fixture.store.state()).available, false);
    assert.equal(await fixture.store.read(), null);
  });

  await t.test("symlinked report directory", async () => {
    const directory = await mkdtemp(join(await realpath(tmpdir()), "surplasse-allure-store-"));
    const actualDirectory = join(directory, "actual-report");
    const aliasDirectory = join(directory, "report-alias");
    await mkdir(actualDirectory);
    await writeFile(join(actualDirectory, "index.html"), "report");
    await symlink(actualDirectory, aliasDirectory);
    const store = new AllureReportStore({
      reportFile: join(aliasDirectory, "index.html"),
      summaryFile: join(aliasDirectory, "summary.json"),
      publicPath: REPORT_URL,
    });

    assert.equal((await store.state()).available, false);
  });
});

test("report store refuses empty and oversized report files", async (t) => {
  await t.test("empty", async () => {
    const fixture = await reportFixture();
    await writeFile(fixture.reportFile, "");
    assert.equal((await fixture.store.state()).available, false);
  });

  await t.test("oversized", async () => {
    const fixture = await reportFixture();
    await writeFile(fixture.reportFile, "x");
    await truncate(fixture.reportFile, 256 * 1024 * 1024 + 1);
    assert.equal((await fixture.store.state()).available, false);
  });
});

test("summary symlink is ignored while the regular report remains available", async () => {
  const fixture = await reportFixture();
  const outsideSummary = join(fixture.directory, "outside-summary.json");
  await writeFile(fixture.reportFile, "<!doctype html>");
  await writeFile(outsideSummary, JSON.stringify({ status: "passed", stats: { total: 7, passed: 7 } }));
  await symlink(outsideSummary, fixture.summaryFile);

  const state = await fixture.store.state();
  assert.equal(state.available, true);
  assert.equal(state.status, "unknown");
  assert.equal(state.total, 0);
});

test("versioned publication follows only the atomic current pointer", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "surplasse-allure-store-"));
  const currentRun = "11111111-1111-4111-8111-111111111111";
  const orphanRun = "22222222-2222-4222-8222-222222222222";
  const currentReportDirectory = join(directory, "releases", currentRun, "allure-report");
  const orphanReportDirectory = join(directory, "releases", orphanRun, "allure-report");
  await mkdir(currentReportDirectory, { recursive: true });
  await mkdir(orphanReportDirectory, { recursive: true });
  await writeFile(join(currentReportDirectory, "index.html"), "current report");
  await writeFile(
    join(currentReportDirectory, "summary.json"),
    JSON.stringify({ status: "passed", stats: { total: 1, passed: 1 } }),
  );
  await writeFile(join(orphanReportDirectory, "index.html"), "orphan report");
  await writeFile(
    join(orphanReportDirectory, "summary.json"),
    JSON.stringify({ status: "failed", stats: { total: 1, failed: 1 } }),
  );
  await writeFile(
    join(directory, "current.json"),
    JSON.stringify({ version: 1, runId: currentRun }),
  );

  const store = new AllureReportStore({ targetRoot: directory, publicPath: REPORT_URL });
  assert.equal((await store.state()).status, "passed");
  assert.equal((await store.read()).toString("utf8"), "current report");
});

async function reportFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "surplasse-allure-store-"));
  const reportDirectory = join(directory, "allure-report");
  const reportFile = join(reportDirectory, "index.html");
  const summaryFile = join(reportDirectory, "summary.json");
  await mkdir(reportDirectory);
  return {
    directory,
    reportDirectory,
    reportFile,
    summaryFile,
    store: new AllureReportStore({
      reportFile,
      summaryFile,
      publicPath: REPORT_URL,
    }),
  };
}
