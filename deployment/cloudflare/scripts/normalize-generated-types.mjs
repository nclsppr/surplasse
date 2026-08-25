import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const typesPath = fileURLToPath(
  new URL("../worker-configuration.d.ts", import.meta.url),
);
const source = readFileSync(typesPath, "utf8");
const normalized = source
  .split(/\r?\n/u)
  .map((line) => line.trimEnd())
  .join("\n");

if (normalized !== source) {
  writeFileSync(typesPath, normalized);
}
