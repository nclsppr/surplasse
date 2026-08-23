import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

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
  let config;
  try {
    config = parseEnv(source);
  } catch (error) {
    throw new Error(`Invalid ${sourceName}: ${error.message}`);
  }
  const keys = Object.keys(config);
  const assignments = source.match(
    /^\s*(?:export\s+)?SURPLASSE_PRODUCTION_RELEASE_MODE\s*=/gmu,
  ) ?? [];
  if (keys.some((key) => key !== "SURPLASSE_PRODUCTION_RELEASE_MODE")) {
    throw new Error(`Unknown production release setting in ${sourceName}`);
  }
  if (assignments.length > 1) {
    throw new Error(`Duplicate production release setting in ${sourceName}`);
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
