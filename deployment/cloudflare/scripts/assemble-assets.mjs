import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { PUBLIC_FILES } from "../../../scripts/onboarding-server/public-files.mjs";

const cloudflareRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(cloudflareRoot, "../..");
const outputRoot = resolve(cloudflareRoot, "dist");

if (basename(outputRoot) !== "dist" || dirname(outputRoot) !== cloudflareRoot) {
  throw new Error("Refusing to replace an unexpected Cloudflare output directory");
}

const sources = {
  commande: resolve(repositoryRoot, "frontends/commande/dist"),
  dashboard: resolve(repositoryRoot, "frontends/dashboard/dist"),
  docs: resolve(repositoryRoot, "docs-nimbus/dist"),
  onboarding: resolve(repositoryRoot, "frontends/onboarding"),
  brand: resolve(repositoryRoot, "brand"),
};

for (const [name, source] of Object.entries(sources)) {
  if (!statSync(source, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Missing ${name} build input: ${relative(repositoryRoot, source)}`);
  }
}

rmSync(outputRoot, { force: true, recursive: true });
mkdirSync(outputRoot, { recursive: true });

copyDirectory(sources.commande, resolve(outputRoot, "commande"));
copyDirectory(sources.dashboard, resolve(outputRoot, "dashboard"));
copyDirectory(sources.docs, resolve(outputRoot, "docs"));
copyOnboardingPublicFiles();

runNode([
  "config/domains/generate-onboarding-config.mjs",
  "--profile",
  "production",
  "--output",
  "deployment/cloudflare/dist/onboarding/frontends/onboarding/runtime-config.js",
]);

assertFile("commande/index.html");
assertFile("dashboard/index.html");
assertFile("docs/index.html");
assertFile("onboarding/frontends/onboarding/index.html");
assertFile("onboarding/frontends/onboarding/runtime-config.js");

for (const application of ["commande", "dashboard", "onboarding"]) {
  const files = listFiles(resolve(outputRoot, application));
  for (const path of files) {
    if (!path.endsWith(".js") && !path.endsWith(".html") && !path.endsWith(".css")) {
      continue;
    }
    const source = readFileSync(path, "utf8");
    if (source.includes("surplasse.test") || source.includes("pages.invalid")) {
      throw new Error(`Development hostname leaked into ${relative(outputRoot, path)}`);
    }
    if (source.includes("sk_test_") || source.includes("sk_live_")) {
      throw new Error(`Stripe secret key prefix leaked into ${relative(outputRoot, path)}`);
    }
  }
}

for (const path of listFiles(resolve(outputRoot, "docs"))) {
  const relativePath = relative(outputRoot, path);
  const isRoutingMetadata =
    basename(path) === "llms.txt" ||
    basename(path) === "robots.txt" ||
    path.endsWith(".xml");
  if (!path.endsWith(".html") && !isRoutingMetadata) continue;
  const source = readFileSync(path, "utf8");
  if (path.endsWith(".html")) {
    const canonical = source.match(
      /<link rel="canonical" href="([^"]+)"/u,
    )?.[1];
    if (!canonical?.startsWith("https://docs.surplasse.com/")) {
      throw new Error(`Nimbus canonical origin is invalid in ${relativePath}`);
    }
  }
  if (
    isRoutingMetadata &&
    (source.includes("https://docs.surplasse.test") ||
      source.includes("https://pages.invalid"))
  ) {
    throw new Error(`Nimbus routing metadata is not production-safe in ${relativePath}`);
  }
}

const assets = listFiles(outputRoot).map((path) => {
  const data = readFileSync(path);
  if (data.byteLength > 25 * 1024 * 1024) {
    throw new Error(`Asset exceeds the Cloudflare 25 MiB limit: ${relative(outputRoot, path)}`);
  }
  return {
    path: relative(outputRoot, path).split("\\").join("/"),
    bytes: data.byteLength,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
});

if (assets.length > 100_000) {
  throw new Error("Static bundle exceeds the Workers Paid file limit");
}

const manifest = {
  contract: "surplasse.cloudflare-static.v1",
  source_sha: sourceSha(),
  file_count: assets.length,
  total_bytes: assets.reduce((total, asset) => total + asset.bytes, 0),
  assets,
};
writeFileSync(
  resolve(outputRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

process.stdout.write(
  `Assembled ${manifest.file_count} Cloudflare assets (${manifest.total_bytes} bytes) for ${manifest.source_sha}.\n`,
);

function copyDirectory(source, destination) {
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true });
}

function copyOnboardingPublicFiles() {
  for (const [route, [sourcePath]] of Object.entries(PUBLIC_FILES)) {
    if (route.endsWith("/") || route === "/brand/qr/qr-demo-development.png") {
      continue;
    }
    const destination = resolve(outputRoot, "onboarding", route.slice(1));
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(resolve(repositoryRoot, sourcePath), destination);
  }
}

function assertFile(path) {
  if (!statSync(resolve(outputRoot, path), { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing assembled asset: ${path}`);
  }
}

function listFiles(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function runNode(arguments_) {
  const result = spawnSync(process.execPath, arguments_, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: node ${arguments_.join(" ")}`);
  }
}

function sourceSha() {
  if (/^[0-9a-f]{40}$/u.test(process.env.GITHUB_SHA ?? "")) {
    return process.env.GITHUB_SHA;
  }
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error("Cannot resolve the source commit");
  const status = spawnSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  if (status.status !== 0) throw new Error("Cannot inspect the source worktree");
  return `${result.stdout.trim()}${status.stdout.trim() ? "-dirty" : ""}`;
}
