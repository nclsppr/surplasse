import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { loadDevelopmentUrls } from "./domains.mjs";
import { CockpitManager } from "./manager.mjs";
import { createRegistry } from "./registry.mjs";
import { createCockpitServer } from "./server.mjs";
import { createPublicUrlProbe, MailpitController, ProcessController } from "./system.mjs";

const HOST = "127.0.0.1";
const PORT = 4174;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDirectory, "../..");

assertNodeVersion();

const developmentUrls = loadDevelopmentUrls(repoRoot);
const registry = createRegistry(repoRoot, developmentUrls);
const manager = new CockpitManager(registry, {
  processController: new ProcessController(),
  mailpitController: new MailpitController(),
  publicProbe: createPublicUrlProbe({
    baseDomain: developmentUrls.baseDomain,
    certificateFile: registry.urlConfiguration.certificateFile,
  }),
});
const { server } = createCockpitServer({
  manager,
  publicDirectory: resolve(currentDirectory, "public"),
  configuredCockpitUrl: registry.urlConfiguration.cockpitUrl,
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
  console.log("Caddy, dnsmasq and mkcert remain external to this cockpit.");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => void shutdown(signal));
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Shutdown requested by ${signal}. Only owned processes will be stopped.`);
  server.close();
  await manager.stopAllOwned();
  process.exit(0);
}

function assertNodeVersion() {
  const major = Number.parseInt(process.versions.node.split(".", 1)[0], 10);
  if (major !== 24) {
    throw new Error(`Node 24 is required; current version: ${process.versions.node}.`);
  }
}
