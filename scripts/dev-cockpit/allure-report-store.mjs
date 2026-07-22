import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const MAX_POINTER_BYTES = 4 * 1024;
const MAX_REPORT_BYTES = 256 * 1024 * 1024;
const MAX_SUMMARY_BYTES = 4 * 1024 * 1024;
const RUN_ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const REPORT_STATUSES = new Set([
  "passed",
  "failed",
  "broken",
  "skipped",
  "unknown",
]);

export class AllureReportStore {
  constructor(options) {
    this.publicPath = options.publicPath;
    this.targetRoot = options.targetRoot ? resolve(options.targetRoot) : null;
    if (this.targetRoot) {
      this.currentFile = join(this.targetRoot, "current.json");
      this.releasesDirectory = join(this.targetRoot, "releases");
      this.legacyPublication = publicationFromFiles(
        join(this.targetRoot, "allure-report", "index.html"),
        join(this.targetRoot, "allure-report", "summary.json"),
      );
    } else {
      this.legacyPublication = publicationFromFiles(
        resolve(options.reportFile),
        resolve(options.summaryFile),
      );
    }
  }

  async state() {
    const publication = await this.resolvePublication();
    const report = publication ? await this.inspectReport(publication) : null;
    if (!report) {
      return emptyState(this.publicPath);
    }

    const summary = await this.readSummary(publication);
    return {
      available: true,
      url: this.publicPath,
      status: summary.status,
      createdAt: summary.createdAt,
      durationMs: summary.durationMs,
      total: summary.total,
      passed: summary.passed,
      skipped: summary.skipped,
    };
  }

  async read() {
    const publication = await this.resolvePublication();
    const report = publication ? await this.inspectReport(publication) : null;
    return report ? readFile(publication.reportFile) : null;
  }

  async resolvePublication() {
    if (!this.targetRoot) {
      return this.legacyPublication;
    }

    let pointerMetadata;
    try {
      pointerMetadata = await lstat(this.currentFile);
    } catch (error) {
      return error?.code === "ENOENT" ? this.legacyPublication : null;
    }
    if (
      !pointerMetadata.isFile() ||
      pointerMetadata.isSymbolicLink() ||
      pointerMetadata.size <= 0 ||
      pointerMetadata.size > MAX_POINTER_BYTES
    ) {
      return null;
    }

    let pointer;
    try {
      pointer = JSON.parse(await readFile(this.currentFile, "utf8"));
    } catch {
      return null;
    }
    if (pointer?.version !== 1 || !RUN_ID_PATTERN.test(pointer?.runId ?? "")) {
      return null;
    }

    try {
      const runId = pointer.runId;
      const releaseDirectory = join(this.releasesDirectory, runId);
      const reportDirectory = join(releaseDirectory, "allure-report");
      const [rootMetadata, releasesMetadata, releaseMetadata, reportMetadata] =
        await Promise.all([
          lstat(this.targetRoot),
          lstat(this.releasesDirectory),
          lstat(releaseDirectory),
          lstat(reportDirectory),
        ]);
      if (
        [rootMetadata, releasesMetadata, releaseMetadata, reportMetadata].some(
          (metadata) => !metadata.isDirectory() || metadata.isSymbolicLink(),
        )
      ) {
        return null;
      }

      const rootRealPath = await realpath(this.targetRoot);
      const releasesRealPath = await realpath(this.releasesDirectory);
      const releaseRealPath = await realpath(releaseDirectory);
      const reportRealPath = await realpath(reportDirectory);
      if (
        releasesRealPath !== join(rootRealPath, "releases") ||
        releaseRealPath !== join(releasesRealPath, runId) ||
        reportRealPath !== join(releaseRealPath, "allure-report")
      ) {
        return null;
      }

      return Object.freeze({
        reportDirectory,
        expectedReportDirectory: reportRealPath,
        reportFile: join(reportDirectory, "index.html"),
        summaryFile: join(reportDirectory, "summary.json"),
      });
    } catch {
      return null;
    }
  }

  async inspectReport(publication) {
    try {
      const [metadata, actualPath, actualDirectory] = await Promise.all([
        lstat(publication.reportFile),
        realpath(publication.reportFile),
        realpath(publication.reportDirectory),
      ]);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.size <= 0 ||
        metadata.size > MAX_REPORT_BYTES ||
        actualPath !== join(publication.expectedReportDirectory, "index.html") ||
        actualDirectory !== publication.expectedReportDirectory
      ) {
        return null;
      }
      return metadata;
    } catch {
      return null;
    }
  }

  async readSummary(publication) {
    try {
      const [metadata, actualPath] = await Promise.all([
        lstat(publication.summaryFile),
        realpath(publication.summaryFile),
      ]);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.size <= 0 ||
        metadata.size > MAX_SUMMARY_BYTES ||
        actualPath !== join(publication.expectedReportDirectory, "summary.json")
      ) {
        return emptySummary();
      }
      const payload = JSON.parse(await readFile(publication.summaryFile, "utf8"));
      const status = REPORT_STATUSES.has(payload?.status) ? payload.status : "unknown";
      const createdAt = Number.isFinite(payload?.createdAt)
        ? new Date(payload.createdAt).toISOString()
        : null;
      return {
        status,
        createdAt,
        durationMs: nonNegativeInteger(payload?.duration),
        total: nonNegativeInteger(payload?.stats?.total),
        passed: nonNegativeInteger(payload?.stats?.passed),
        skipped: nonNegativeInteger(payload?.stats?.skipped),
      };
    } catch {
      return emptySummary();
    }
  }
}

function publicationFromFiles(reportFile, summaryFile) {
  const reportDirectory = dirname(reportFile);
  return Object.freeze({
    reportDirectory,
    expectedReportDirectory: reportDirectory,
    reportFile,
    summaryFile,
  });
}

function emptyState(publicPath) {
  return {
    available: false,
    url: publicPath,
    status: "not-run",
    createdAt: null,
    durationMs: null,
    total: 0,
    passed: 0,
    skipped: 0,
  };
}

function emptySummary() {
  return {
    status: "unknown",
    createdAt: null,
    durationMs: null,
    total: 0,
    passed: 0,
    skipped: 0,
  };
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}
