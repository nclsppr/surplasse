#!/usr/bin/env node
/**
 * Contract filter (docs/developpement/conventions-api.md): removes x-draft
 * blocks (not contractual yet) and x-sse operations (contractual, but
 * consumed via EventSource and implemented by hand, outside the generated
 * interfaces), then drops components left unreferenced. Used by the
 * generation chain and by the oasdiff compatibility check, so that drafts
 * are never generated and never flagged as breaking.
 *
 * CLI usage: node scripts/api/filter.mjs <input.yaml> <output.yaml>
 */
import { readFileSync, writeFileSync } from "node:fs";
import YAML from "yaml";

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"];

export function filterDrafts(doc) {
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (
        operation?.["x-draft"] === true ||
        operation?.["x-sse"] === true ||
        operation?.["x-raw-body"] === true
      ) {
        delete item[method];
      }
    }
    if (!HTTP_METHODS.some((m) => item[m])) delete doc.paths[path];
  }
  for (const section of ["schemas", "parameters", "responses", "requestBodies", "headers", "examples"]) {
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
    for (const section of ["schemas", "parameters", "responses", "requestBodies", "headers", "examples"]) {
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

const [, , input, output] = process.argv;
if (input && output) {
  writeFileSync(output, YAML.stringify(filterDrafts(YAML.parse(readFileSync(input, "utf8")))));
}
