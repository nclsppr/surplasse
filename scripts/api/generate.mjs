#!/usr/bin/env node
/**
 * Generation chain of the contract (docs/developpement/conventions-api.md,
 * ADR-0013). Four steps: filter x-draft blocks out of api/openapi.yaml,
 * generate the Java interfaces (jaxrs-spec) into backend/contract/, generate
 * the TypeScript client (typescript-fetch) into
 * frontends/shared/src/api/generated/, then remove the generator's fallback
 * origin. Outputs are committed; this script is the only way to regenerate
 * them.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

import { filterDrafts } from "./filter.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const contractPath = join(root, "api", "openapi.yaml");
const filteredPath = join(root, "node_modules", ".cache", "surplasse", "openapi.filtered.yaml");

function assertJava21() {
  const result = spawnSync("java", ["-version"], { encoding: "utf8" });
  const banner = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const major = banner.match(/version "(?:1\.)?(\d+)/)?.[1];

  if (result.error || result.status !== 0 || major !== "21") {
    console.error(
      "Error: OpenAPI generation requires JDK 21. Install it and make sure `java -version` reports 21 before retrying.",
    );
    process.exit(1);
  }
}

function generate(generator, output, extraArgs) {
  execFileSync(
    "npx",
    [
      "openapi-generator-cli", "generate",
      "-i", filteredPath,
      "-g", generator,
      "-o", join(root, output),
      ...extraArgs,
    ],
    { cwd: root, stdio: "inherit" },
  );
}

function stripTrailingWhitespace(path) {
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) {
      stripTrailingWhitespace(join(path, entry));
    }
    return;
  }
  const content = readFileSync(path, "utf8");
  const normalized = content
    .replace(/[ \t]+$/gmu, "")
    .replace(/\n+$/u, "\n")
    .replace(/\n{3,}\}\n$/u, "\n}\n");
  if (normalized !== content) {
    writeFileSync(path, normalized);
  }
}

const doc = filterDrafts(YAML.parse(readFileSync(contractPath, "utf8")));
mkdirSync(dirname(filteredPath), { recursive: true });
writeFileSync(filteredPath, YAML.stringify(doc));

// Validate the external runtime before deleting any committed generated file.
assertJava21();

rmSync(join(root, "backend", "contract", "src", "main", "java"), { recursive: true, force: true });
generate("jaxrs-spec", "backend/contract", [
  "--api-package", "com.surplasse.contract.api",
  "--model-package", "com.surplasse.contract.model",
  "--additional-properties",
  [
    "interfaceOnly=true",
    "returnResponse=true",
    "useJakartaEe=true",
    "useTags=true",
    "useBeanValidation=true",
    "useSwaggerAnnotations=false",
    "hideGenerationTimestamp=true",
    "dateLibrary=java8",
    "sourceFolder=src/main/java",
    "generatePom=false",
  ].join(","),
]);

rmSync(join(root, "frontends", "shared", "src", "api", "generated"), { recursive: true, force: true });
generate("typescript-fetch", "frontends/shared/src/api/generated", [
  "--additional-properties", "supportsES6=true,withoutRuntimeChecks=true",
]);

// OpenAPI Generator turns a relative server into http://localhost. Surplasse
// clients must instead receive their base URL from the selected domain profile
// through the explicit client factories. Keep the generated fallback empty so
// a future direct instantiation cannot silently target another environment.
const generatedRuntimePath = join(
  root, "frontends", "shared", "src", "api", "generated", "runtime.ts");
const generatedRuntime = readFileSync(generatedRuntimePath, "utf8");
const basePathDeclaration = /^export const BASE_PATH = .*;$/mu;
if (!basePathDeclaration.test(generatedRuntime)) {
  throw new Error("Generated TypeScript runtime no longer exposes the expected BASE_PATH declaration");
}
writeFileSync(
  generatedRuntimePath,
  generatedRuntime.replace(basePathDeclaration, 'export const BASE_PATH = "";'),
);

stripTrailingWhitespace(join(root, "backend", "contract", "src", "main", "java"));
stripTrailingWhitespace(join(root, "frontends", "shared", "src", "api", "generated"));

// The full contract (drafts included, marked as such) is served by Swagger
// UI at /q/swagger-ui; this copy is generated, never edited by hand.
const staticContractPath = join(
  root, "backend", "application", "src", "main", "resources", "META-INF", "openapi.yaml");
mkdirSync(dirname(staticContractPath), { recursive: true });
writeFileSync(staticContractPath, readFileSync(contractPath));

console.log("Generation done: backend/contract/ and frontends/shared/src/api/generated/.");
