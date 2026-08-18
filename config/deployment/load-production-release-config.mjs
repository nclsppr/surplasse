import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const productionReleasePath = fileURLToPath(
  new URL("./production-release.env", import.meta.url),
);

export const PRODUCTION_RELEASE_MODES = Object.freeze(["testers", "public"]);

export function loadProductionReleaseConfig() {
  return parseProductionReleaseConfig(
    readFileSync(productionReleasePath, "utf8"),
    "production-release.env",
  );
}

export function parseProductionReleaseConfig(source, sourceName = "production release config") {
  const config = {};
  for (const [index, rawLine] of source.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new Error(`Invalid ${sourceName} line ${index + 1}`);
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key !== "SURPLASSE_PRODUCTION_RELEASE_MODE") {
      throw new Error(`Unknown production release setting ${key} in ${sourceName}`);
    }
    if (Object.hasOwn(config, key)) {
      throw new Error(`Duplicate production release setting ${key} in ${sourceName}`);
    }
    config[key] = value;
  }

  const mode = config.SURPLASSE_PRODUCTION_RELEASE_MODE;
  if (!PRODUCTION_RELEASE_MODES.includes(mode)) {
    throw new Error(
      `${sourceName}: SURPLASSE_PRODUCTION_RELEASE_MODE must be testers or public`,
    );
  }
  return Object.freeze({ SURPLASSE_PRODUCTION_RELEASE_MODE: mode });
}

export function frontendReleaseMode(viteMode) {
  if (viteMode !== "production") {
    return "development";
  }
  return loadProductionReleaseConfig().SURPLASSE_PRODUCTION_RELEASE_MODE;
}

export function frontendReleaseEnvironmentDefinitions(viteMode) {
  return {
    "import.meta.env.VITE_SURPLASSE_RELEASE_MODE": JSON.stringify(
      frontendReleaseMode(viteMode),
    ),
  };
}
