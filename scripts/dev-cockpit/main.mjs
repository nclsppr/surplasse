import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { lstatSync, readFileSync } from "node:fs";

import { getE2ePaths, resolveE2eTarget } from "../../e2e/support/target.mjs";
import { AllureReportStore } from "./allure-report-store.mjs";
import { loadDevelopmentUrls } from "./domains.mjs";
import { CockpitManager } from "./manager.mjs";
import { QualityRunner } from "./quality-runner.mjs";
import { createQualitySuites } from "./quality-suites.mjs";
import { createRegistry } from "./registry.mjs";
import { createCockpitServer } from "./server.mjs";
import { ComposeController, createPublicUrlProbe } from "./system.mjs";

const HOST = "0.0.0.0";
const PORT = 4174;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDirectory, "../..");

assertNodeVersion();

const developmentUrls = loadDevelopmentUrls(repoRoot);
const registry = createRegistry(repoRoot, developmentUrls);
const upstreamToken = loadUpstreamToken(repoRoot);
const composeProject = loadComposeProjectName(repoRoot);
const e2ePaths = getE2ePaths(resolveE2eTarget("development").storageId);
const reportStore = new AllureReportStore({
  targetRoot: e2ePaths.root,
  publicPath: registry.urlConfiguration.reportsUrl,
});
const qualityRunner = new QualityRunner(createQualitySuites(repoRoot), {
  stateFile: resolve(repoRoot, ".surplasse/dev-cockpit/quality-results.json"),
});
const manager = new CockpitManager(registry, {
  composeController: new ComposeController({
    script: resolve(repoRoot, "scripts/compose.sh"),
    cwd: repoRoot,
    profile: "development",
    project: composeProject,
    services: registry.composeServices,
    serviceProfiles: registry.composeServiceProfiles,
  }),
  publicProbe: createPublicUrlProbe({
    baseDomain: developmentUrls.baseDomain,
    certificateFile: registry.urlConfiguration.certificateFile,
  }),
  qualityRunner,
  reportStore,
});
const { server } = createCockpitServer({
  manager,
  publicDirectory: resolve(currentDirectory, "public"),
  configuredCockpitUrl: registry.urlConfiguration.cockpitUrl,
  configuredReportsUrl: registry.urlConfiguration.reportsUrl,
  upstreamToken,
  reportStore,
});

let shuttingDown = false;

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. The cockpit never selects another port automatically.`);
  } else {
    console.error("The cockpit could not start.", error);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Surplasse cockpit is ready on ${registry.urlConfiguration.cockpitUrl}`);
  console.log(`Internal listener: ${HOST}, port ${PORT}.`);
  for (const warning of registry.urlConfiguration.warnings) {
    console.warn(warning);
  }
  console.log("Module lifecycle is delegated to the allowlisted development Docker Compose project.");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => void shutdown(signal));
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Shutdown requested by ${signal}. Running checks are interrupted; Compose services stay up.`);
  server.close();
  await manager.shutdown();
  process.exit(0);
}

function loadUpstreamToken(root) {
  const tokenFile = resolve(root, ".surplasse/dev-cockpit/upstream-token");
  let metadata;
  let token;
  try {
    metadata = lstatSync(tokenFile);
    token = readFileSync(tokenFile, "utf8").trim();
  } catch {
    throw new Error("Run npm run local:up before starting the cockpit.");
  }
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    (metadata.mode & 0o077) !== 0 ||
    !/^[0-9a-f]{64}$/u.test(token)
  ) {
    throw new Error("The local cockpit upstream token is invalid. Remove it and rerun npm run local:up.");
  }
  return token;
}

function loadComposeProjectName(root) {
  const source = readFileSync(resolve(root, "config/deployment/development.env"), "utf8");
  const assignments = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("COMPOSE_PROJECT_NAME="));
  if (assignments.length !== 1) {
    throw new Error("The development deployment profile must define COMPOSE_PROJECT_NAME once.");
  }
  const project = assignments[0].slice("COMPOSE_PROJECT_NAME=".length).trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/u.test(project)) {
    throw new Error("The development Compose project name is invalid.");
  }
  return project;
}

function assertNodeVersion() {
  const major = Number.parseInt(process.versions.node.split(".", 1)[0], 10);
  if (major !== 24) {
    throw new Error(`Node 24 is required; current version: ${process.versions.node}.`);
  }
}
