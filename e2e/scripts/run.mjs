import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, lstatSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  acquireTargetLock,
  exportCurrentReport,
  prepareRunWorkspace,
  publishRunArtifacts,
  removeRunWorkspace,
  resolveCurrentPublication,
} from "../support/run-artifacts.mjs";
import {
  getE2ePaths,
  getE2eRunPaths,
  resolveE2eTarget,
} from "../support/target.mjs";

const e2eDirectory = fileURLToPath(new URL("../", import.meta.url));
const scriptPath = fileURLToPath(import.meta.url);

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
  }
}

async function main() {
  const action = process.argv[2];
  const targetName = process.argv[3];
  const passthroughArguments = process.argv.slice(4);

  if (!action || !targetName) {
    throw new Error(
      "Usage: node scripts/run.mjs <test|open|export|id> <development|production|custom>",
    );
  }
  if (!new Set(["test", "open", "export", "id"]).has(action)) {
    throw new Error(`Unknown E2E action: ${action}`);
  }

  const targetEnvironment = {
    ...process.env,
    SURPLASSE_E2E_TARGET: targetName,
  };
  const target = resolveE2eTarget(targetName, targetEnvironment);
  const publishedPaths = getE2ePaths(target.storageId);

  if (action === "id") {
    process.stdout.write(`${target.storageId}\n`);
    return 0;
  }
  if (action === "open") {
    return openReport(publishedPaths, target.storageId);
  }
  if (action === "export") {
    if (passthroughArguments.length !== 1) {
      throw new Error(
        "The export action requires exactly one destination file path.",
      );
    }
    const destination = resolve(passthroughArguments[0]);
    exportCurrentReport(publishedPaths, destination);
    process.stdout.write(`Allure report exported to ${destination}\n`);
    return 0;
  }

  return runTests({
    target,
    targetEnvironment,
    publishedPaths,
    passthroughArguments,
  });
}

async function runTests({
  target,
  targetEnvironment,
  publishedPaths,
  passthroughArguments,
}) {
  const binaries = {
    playwright: requireExecutable("playwright"),
    allure: requireExecutable("allure"),
  };

  const runId = randomUUID();
  const runPaths = getE2eRunPaths(target.storageId, runId);
  const executionEnvironment = {
    ...targetEnvironment,
    SURPLASSE_E2E_RUN_ID: runId,
  };
  const lock = acquireTargetLock(
    publishedPaths.lock,
    target.storageId,
  );

  try {
    prepareRunWorkspace(publishedPaths, runPaths);

    const playwrightResult = await executeBinary(
      binaries.playwright,
      "playwright",
      [
        "test",
        `--config=${join(e2eDirectory, "playwright.config.mjs")}`,
        ...passthroughArguments,
      ],
      runPaths.root,
      executionEnvironment,
    );

    const allureResult = await executeBinary(
      binaries.allure,
      "allure",
      [
        "generate",
        runPaths.results,
        `--config=${join(e2eDirectory, "allurerc.mjs")}`,
      ],
      runPaths.root,
      executionEnvironment,
    );

    if (allureResult.status !== 0) {
      throw new Error(
        `Allure generation failed for ${target.storageId}. ` +
          "The last published report was kept.",
      );
    }

    try {
      publishRunArtifacts(publishedPaths, runPaths);
    } catch (error) {
      throw new Error(
        `Allure did not produce a publishable report for ${target.storageId}. ` +
          `The last published report was kept. ${error.message}`,
      );
    }

    return playwrightResult.status || allureResult.status;
  } finally {
    try {
      removeRunWorkspace(publishedPaths, runPaths);
    } finally {
      lock.release();
    }
  }
}

function requireExecutable(name) {
  const filename = process.platform === "win32" ? `${name}.cmd` : name;
  const path = join(e2eDirectory, "node_modules", ".bin", filename);
  try {
    if (!statSync(path).isFile()) {
      throw new Error("not a file");
    }
    accessSync(
      path,
      process.platform === "win32" ? constants.F_OK : constants.X_OK,
    );
  } catch {
    throw new Error(`Missing ${name}. Run npm ci in e2e first.`);
  }
  return path;
}

export function executeBinary(
  binary,
  name,
  argumentsList,
  workingDirectory,
  environment,
) {
  return new Promise((resolveExecution, rejectExecution) => {
    const child = spawn(binary, argumentsList, {
      cwd: workingDirectory,
      detached: process.platform !== "win32",
      env: environment,
      stdio: "inherit",
    });
    let settled = false;
    let signalHandlers = new Map();

    const cleanup = () => {
      for (const [signal, handler] of signalHandlers) {
        process.off(signal, handler);
      }
    };
    const rejectOnce = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      rejectExecution(error);
    };

    const forwardSignal = (signal) => {
      try {
        if (process.platform === "win32") {
          child.kill(signal);
        } else {
          process.kill(-child.pid, signal);
        }
      } catch (error) {
        if (error?.code !== "ESRCH") {
          rejectOnce(error);
        }
      }
    };
    signalHandlers = new Map(
      ["SIGINT", "SIGTERM"].map((signal) => [
        signal,
        () => forwardSignal(signal),
      ]),
    );
    for (const [signal, handler] of signalHandlers) {
      process.on(signal, handler);
    }

    child.once("error", rejectOnce);
    child.once("exit", (status, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (signal) {
        rejectExecution(new Error(`${name} stopped after signal ${signal}.`));
        return;
      }
      resolveExecution({ status: status ?? 1 });
    });
  });
}

function openReport(paths, targetStorageId) {
  const publication = resolveCurrentPublication(paths);
  const reportFile = publication ? join(publication.report, "index.html") : null;
  try {
    if (!reportFile) {
      throw new Error("missing report");
    }
    const metadata = lstatSync(reportFile);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size <= 0) {
      throw new Error("invalid report");
    }
  } catch {
    throw new Error(
      `No Allure report exists for target ${targetStorageId}. Run the tests first.`,
    );
  }

  const reportUrl = pathToFileURL(reportFile).href;
  process.stdout.write(`Allure report: ${reportUrl}\n`);

  const opener = reportOpener(reportFile);
  if (!opener) {
    return 0;
  }

  const result = spawnSync(opener.command, opener.argumentsList, {
    stdio: "ignore",
  });
  if (result.error || result.signal || result.status !== 0) {
    process.stderr.write(
      "The report could not be opened automatically. Use the file URL above.\n",
    );
  }
  return 0;
}

export function reportOpener(
  reportFile,
  { fileExists = existsSync, platform = process.platform } = {},
) {
  if (platform === "darwin") {
    return { command: "/usr/bin/open", argumentsList: [reportFile] };
  }
  if (platform === "win32") {
    return { command: "explorer.exe", argumentsList: [reportFile] };
  }
  for (const command of ["/usr/bin/wslview", "/usr/bin/xdg-open"]) {
    if (fileExists(command)) {
      return { command, argumentsList: [reportFile] };
    }
  }
  return null;
}
