import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { hostname as systemHostname } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const MAX_HISTORY_BYTES = 128 * 1024 * 1024;
const MAX_REPORT_BYTES = 256 * 1024 * 1024;
const MAX_SUMMARY_BYTES = 4 * 1024 * 1024;
const POINTER_VERSION = 1;
const RUN_ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const REPORT_STATUSES = new Set([
  "passed",
  "failed",
  "broken",
  "skipped",
  "unknown",
]);

export function acquireTargetLock(
  lockPath,
  targetStorageId,
  {
    host = systemHostname(),
    now = () => new Date(),
    pid = process.pid,
    token = randomUUID(),
  } = {},
) {
  mkdirSync(dirname(lockPath), { recursive: true });

  const metadata = Object.freeze({
    version: 1,
    token,
    targetStorageId,
    pid,
    host,
    startedAt: now().toISOString(),
  });

  let descriptor;
  try {
    descriptor = openSync(lockPath, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify(metadata)}\n`, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
  } catch (error) {
    if (descriptor !== undefined) {
      closeSync(descriptor);
      rmSync(lockPath, { force: true });
    }

    if (error?.code !== "EEXIST") {
      throw error;
    }

    const current = readLockMetadata(lockPath);
    const owner = current
      ? `PID ${current.pid} on ${current.host}, started at ${current.startedAt}`
      : "an unknown process";
    throw new Error(
      `An E2E run for ${targetStorageId} is already locked by ${owner}. ` +
        `Remove ${lockPath} only after confirming that no run is active.`,
    );
  }

  return Object.freeze({
    metadata,
    release() {
      const current = readLockMetadata(lockPath);
      if (current?.token === token) {
        unlinkSync(lockPath);
      }
    },
  });
}

export function prepareRunWorkspace(publishedPaths, runPaths) {
  const publication = resolveCurrentPublication(publishedPaths);
  const historySource = publication?.history;
  if (historySource && existsSync(historySource)) {
    validateHistoryFile(historySource);
  }

  mkdirSync(publishedPaths.staging, { recursive: true });
  mkdirSync(runPaths.root, { recursive: false, mode: 0o700 });

  if (historySource && existsSync(historySource)) {
    copyFileSync(historySource, runPaths.history, constants.COPYFILE_EXCL);
  }
}

export function publishRunArtifacts(
  publishedPaths,
  runPaths,
  { commitPointer = commitCurrentPointer } = {},
) {
  validateGeneratedRun(runPaths);
  const runId = requireRunId(basename(runPaths.root));
  const previousPublication = resolveCurrentPublication(publishedPaths);
  const releasesDirectory = releasesPath(publishedPaths);
  const releasePaths = createArtifactPaths(join(releasesDirectory, runId));

  mkdirSync(publishedPaths.root, { recursive: true });
  mkdirSync(releasesDirectory, { recursive: true, mode: 0o700 });
  const rootPath = resolve(publishedPaths.root);
  const rootRealPath = realpathSync(rootPath);
  if (resolve(releasesDirectory) !== join(rootPath, "releases")) {
    throw new Error(`Unsafe E2E releases directory: ${releasesDirectory}`);
  }
  validateRegularDirectory(rootPath, rootRealPath);
  validateRegularDirectory(releasesDirectory, join(rootRealPath, "releases"));

  if (existsSync(releasePaths.root)) {
    throw new Error(`E2E release already exists: ${releasePaths.root}`);
  }

  try {
    renameSync(runPaths.root, releasePaths.root);
  } catch (error) {
    if (error?.code === "EXDEV") {
      throw new Error("E2E runs and releases must live on the same filesystem.");
    }
    throw error;
  }
  syncDirectory(releasesDirectory);

  commitPointer(publishedPaths, runId);

  try {
    pruneOldReleases(releasesDirectory, new Set([
      runId,
      previousPublication?.legacy ? null : previousPublication?.runId,
    ].filter(Boolean)));
  } catch {
    // The pointer already exposes a complete release. Cleanup is best effort.
  }

  return releasePaths;
}

export function resolveCurrentPublication(
  publishedPaths,
  { allowLegacy = true } = {},
) {
  const currentPath = pointerPath(publishedPaths);
  let metadata;
  try {
    metadata = lstatSync(currentPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return allowLegacy ? legacyPublication(publishedPaths) : null;
    }
    throw error;
  }

  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size <= 0 ||
    metadata.size > 4_096
  ) {
    throw new Error(`Invalid E2E publication pointer: ${currentPath}`);
  }

  let pointer;
  try {
    pointer = JSON.parse(readFileSync(currentPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid E2E publication pointer: ${error.message}`);
  }
  if (pointer?.version !== POINTER_VERSION) {
    throw new Error(`Unsupported E2E publication pointer: ${currentPath}`);
  }

  const runId = requireRunId(pointer.runId);
  const root = resolve(publishedPaths.root);
  const rootRealPath = realpathSync(root);
  const releasesDirectory = resolve(releasesPath(publishedPaths));
  const releaseRoot = resolve(releasesDirectory, runId);
  if (releasesDirectory !== join(root, "releases")) {
    throw new Error(`Unsafe E2E releases directory: ${releasesDirectory}`);
  }
  validateRegularDirectory(root, rootRealPath);
  validateRegularDirectory(releasesDirectory, join(rootRealPath, "releases"));
  validateRegularDirectory(
    releaseRoot,
    join(rootRealPath, "releases", runId),
  );

  return Object.freeze({
    ...createArtifactPaths(releaseRoot),
    legacy: false,
    runId,
  });
}

export function removeRunWorkspace(publishedPaths, runPaths) {
  rmSync(runPaths.root, { recursive: true, force: true });
  try {
    rmdirSync(publishedPaths.staging);
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTEMPTY") {
      throw error;
    }
  }
}

function commitCurrentPointer(publishedPaths, runId) {
  const currentPath = pointerPath(publishedPaths);
  const temporaryPath = join(
    dirname(currentPath),
    `.current.${runId}.${randomUUID()}.next`,
  );
  let descriptor;
  try {
    descriptor = openSync(temporaryPath, "wx", 0o600);
    writeFileSync(
      descriptor,
      `${JSON.stringify({ version: POINTER_VERSION, runId })}\n`,
      "utf8",
    );
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporaryPath, currentPath);
    syncDirectory(dirname(currentPath));
  } catch (error) {
    if (descriptor !== undefined) {
      closeSync(descriptor);
    }
    rmSync(temporaryPath, { force: true });
    throw error;
  }
}

function validateGeneratedRun(runPaths) {
  validateDirectoryTree(runPaths.results);
  validateDirectoryTree(runPaths.playwright);

  const reportFile = join(runPaths.report, "index.html");
  const report = readBoundedRegularFile(reportFile, MAX_REPORT_BYTES);
  if (!report.subarray(0, 4_096).toString("utf8").toLowerCase().includes("<html")) {
    throw new Error("The generated Allure single-file report is not valid HTML.");
  }

  const summaryFile = join(runPaths.report, "summary.json");
  const summary = parseJsonFile(summaryFile, MAX_SUMMARY_BYTES, "Allure summary");
  const passed = summary?.stats?.passed ?? 0;
  if (
    !REPORT_STATUSES.has(summary?.status) ||
    !Number.isFinite(summary?.createdAt) ||
    !Number.isInteger(summary?.duration) ||
    summary.duration < 0 ||
    !Number.isInteger(summary?.stats?.total) ||
    summary.stats.total < 0 ||
    !Number.isInteger(passed) ||
    passed < 0 ||
    passed > summary.stats.total ||
    summary?.meta?.singleFile !== true ||
    typeof summary?.meta?.reportId !== "string" ||
    !summary.meta.reportId
  ) {
    throw new Error("The generated Allure summary is incomplete or invalid.");
  }

  const history = validateHistoryFile(runPaths.history);
  if (history.at(-1)?.uuid !== summary.meta.reportId) {
    throw new Error("The generated Allure history does not match the report summary.");
  }
}

function validateHistoryFile(path) {
  const content = readBoundedRegularFile(path, MAX_HISTORY_BYTES).toString("utf8");
  const lines = content.split(/\r?\n/u).filter(Boolean);
  if (lines.length === 0) {
    throw new Error(`Allure history is empty: ${path}`);
  }

  return lines.map((line, index) => {
    try {
      const entry = JSON.parse(line);
      if (!entry || typeof entry !== "object" || typeof entry.uuid !== "string") {
        throw new Error("missing UUID");
      }
      return entry;
    } catch (error) {
      throw new Error(
        `Allure history contains invalid JSON on line ${index + 1}: ${error.message}`,
      );
    }
  });
}

function readBoundedRegularFile(path, maximumBytes) {
  const metadata = lstatSync(path);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size <= 0 ||
    metadata.size > maximumBytes
  ) {
    throw new Error(`Invalid generated E2E artifact: ${path}`);
  }
  return readFileSync(path);
}

function parseJsonFile(path, maximumBytes, label) {
  try {
    return JSON.parse(readBoundedRegularFile(path, maximumBytes).toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function validateDirectoryTree(root) {
  const rootMetadata = lstatSync(root);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error(`Invalid generated E2E artifact directory: ${root}`);
  }

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const metadata = lstatSync(path);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Generated E2E artifacts must not contain symlinks: ${path}`);
    }
    if (metadata.isDirectory()) {
      validateDirectoryTree(path);
    } else if (!metadata.isFile()) {
      throw new Error(`Unsupported generated E2E artifact: ${path}`);
    }
  }
}

function validateRegularDirectory(path, expectedRealPath) {
  const metadata = lstatSync(path);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    realpathSync(path) !== expectedRealPath
  ) {
    throw new Error(`Unsafe E2E publication directory: ${path}`);
  }
}

function legacyPublication(publishedPaths) {
  const publication = Object.freeze({
    ...createArtifactPaths(publishedPaths.root),
    legacy: true,
    runId: null,
  });
  return existsSync(publication.history) ||
    existsSync(join(publication.report, "index.html"))
    ? publication
    : null;
}

function createArtifactPaths(root) {
  return {
    root,
    results: join(root, "allure-results"),
    report: join(root, "allure-report"),
    history: join(root, "history.jsonl"),
    playwright: join(root, "playwright"),
  };
}

function pointerPath(publishedPaths) {
  return publishedPaths.current ?? join(publishedPaths.root, "current.json");
}

function releasesPath(publishedPaths) {
  return publishedPaths.releases ?? join(publishedPaths.root, "releases");
}

function requireRunId(value) {
  if (!value || !RUN_ID_PATTERN.test(value)) {
    throw new Error("E2E run ID must be a lowercase UUID v4.");
  }
  return value;
}

function pruneOldReleases(releasesDirectory, keepRunIds) {
  for (const entry of readdirSync(releasesDirectory, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      RUN_ID_PATTERN.test(entry.name) &&
      !keepRunIds.has(entry.name)
    ) {
      rmSync(join(releasesDirectory, entry.name), { recursive: true, force: true });
    }
  }
}

function syncDirectory(path) {
  if (process.platform === "win32") {
    return;
  }
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function readLockMetadata(lockPath) {
  try {
    const metadata = lstatSync(lockPath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 4_096) {
      return null;
    }
    return JSON.parse(readFileSync(lockPath, "utf8"));
  } catch {
    return null;
  }
}
