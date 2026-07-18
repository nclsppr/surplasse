#!/usr/bin/env node
/**
 * Generation chain of the contract (docs/developpement/conventions-api.md,
 * ADR-0013). Three steps: filter x-draft blocks out of api/openapi.yaml,
 * generate the Java interfaces (jaxrs-spec) into backend/contract/, generate
 * the TypeScript client (typescript-fetch) into
 * frontends/shared/src/api/generated/. Outputs are committed; this script is
 * the only way to regenerate them.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const contractPath = join(root, "api", "openapi.yaml");
const filteredPath = join(root, "node_modules", ".cache", "surplasse", "openapi.filtered.yaml");

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"];

function filterDrafts(doc) {
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      if (item[method]?.["x-draft"] === true) delete item[method];
    }
    if (!HTTP_METHODS.some((m) => item[m])) delete doc.paths[path];
  }
  for (const section of ["schemas", "parameters", "responses", "requestBodies", "headers"]) {
    const components = doc.components?.[section] ?? {};
    for (const [name, component] of Object.entries(components)) {
      if (component?.["x-draft"] === true) delete components[name];
    }
  }
  // Drop components no longer referenced once drafts are gone (repeat until stable).
  let changed = true;
  while (changed) {
    changed = false;
    const serialized = JSON.stringify(doc);
    for (const section of ["schemas", "parameters", "responses", "requestBodies", "headers"]) {
      const components = doc.components?.[section] ?? {};
      for (const name of Object.keys(components)) {
        if (!serialized.includes(`#/components/${section}/${name}`)) {
          delete components[name];
          changed = true;
        }
      }
    }
  }
  return doc;
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

const doc = filterDrafts(YAML.parse(readFileSync(contractPath, "utf8")));
mkdirSync(dirname(filteredPath), { recursive: true });
writeFileSync(filteredPath, YAML.stringify(doc));

rmSync(join(root, "backend", "contract", "src", "main", "java"), { recursive: true, force: true });
generate("jaxrs-spec", "backend/contract", [
  "--api-package", "com.surplasse.contract.api",
  "--model-package", "com.surplasse.contract.model",
  "--additional-properties",
  [
    "interfaceOnly=true",
    "returnResponse=false",
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

console.log("Generation done: backend/contract/ and frontends/shared/src/api/generated/.");
