import { randomUUID } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

const MAX_HISTORY_BYTES = 128 * 1024 * 1024;
const MAX_REPORT_BYTES = 256 * 1024 * 1024;

export function prepareRunWorkspace(publishedPaths, runPaths) {
  mkdirSync(runPaths.root, { recursive: true, mode: 0o700 });
  if (existsSync(publishedPaths.history)) {
    validateHistoryFile(publishedPaths.history);
    copyFileSync(publishedPaths.history, runPaths.history);
  }
}

export function publishRunArtifacts(publishedPaths, runPaths) {
  validateReport(runPaths.report);
  validateHistoryFile(runPaths.history);

  const parent = dirname(publishedPaths.root);
  mkdirSync(parent, { recursive: true });
  const stagedRoot = mkdtempSync(join(parent, ".publication-"));
  const stagedReport = join(stagedRoot, basename(publishedPaths.report));
  const stagedPlaywright = join(
    stagedRoot,
    basename(publishedPaths.playwright),
  );
  const stagedHistory = join(stagedRoot, basename(publishedPaths.history));
  const backupRoot = join(
    parent,
    `.${basename(publishedPaths.root)}.previous-${randomUUID()}`,
  );
  let previousMoved = false;

  try {
    cpSync(runPaths.report, stagedReport, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    if (existsSync(runPaths.playwright)) {
      cpSync(runPaths.playwright, stagedPlaywright, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
    }
    copyFileSync(runPaths.history, stagedHistory);

    if (existsSync(publishedPaths.root)) {
      renameSync(publishedPaths.root, backupRoot);
      previousMoved = true;
    }

    try {
      renameSync(stagedRoot, publishedPaths.root);
    } catch (error) {
      if (previousMoved) {
        try {
          renameSync(backupRoot, publishedPaths.root);
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            `The previous E2E publication remains at ${backupRoot}.`,
          );
        }
      }
      throw error;
    }
  } catch (error) {
    rmSync(stagedRoot, { recursive: true, force: true });
    throw error;
  }

  if (previousMoved) {
    try {
      rmSync(backupRoot, { recursive: true, force: true });
    } catch {
      // The new publication is active; removing its hidden backup is best effort.
    }
  }
  return publishedPaths;
}

export function exportCurrentReport(publishedPaths, destination) {
  const source = validateReport(publishedPaths.report);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return destination;
}

export function removeRunWorkspace(runPaths) {
  rmSync(runPaths.root, { recursive: true, force: true });
}

function validateReport(reportDirectory) {
  const source = join(reportDirectory, "index.html");
  const report = readBoundedRegularFile(source, MAX_REPORT_BYTES);
  if (!report.subarray(0, 4_096).toString("utf8").toLowerCase().includes("<html")) {
    throw new Error("The Allure single-file report is not valid HTML.");
  }
  return source;
}

function validateHistoryFile(path) {
  const content = readBoundedRegularFile(path, MAX_HISTORY_BYTES).toString("utf8");
  const lines = content.split(/\r?\n/u).filter(Boolean);
  if (lines.length === 0) {
    throw new Error(`Allure history is empty: ${path}`);
  }
  for (const [index, line] of lines.entries()) {
    try {
      const entry = JSON.parse(line);
      if (!entry || typeof entry !== "object" || typeof entry.uuid !== "string") {
        throw new Error("missing UUID");
      }
    } catch (error) {
      throw new Error(
        `Allure history contains invalid JSON on line ${index + 1}: ${error.message}`,
      );
    }
  }
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
