import assert from "node:assert/strict";
import test from "node:test";

import {
  frontendReleaseEnvironmentDefinitions,
  frontendReleaseMode,
  loadProductionReleaseConfig,
  parseProductionReleaseConfig,
} from "./load-production-release-config.mjs";

test("the versioned production release is limited to named testers", () => {
  assert.deepEqual(loadProductionReleaseConfig(), {
    SURPLASSE_PRODUCTION_RELEASE_MODE: "testers",
  });
});

test("production release parsing fails closed", () => {
  for (const source of [
    "",
    "SURPLASSE_PRODUCTION_RELEASE_MODE=",
    "SURPLASSE_PRODUCTION_RELEASE_MODE=staging",
    "SURPLASSE_PRODUCTION_RELEASE_MODE=testers\nUNKNOWN=value",
    "SURPLASSE_PRODUCTION_RELEASE_MODE=testers\nSURPLASSE_PRODUCTION_RELEASE_MODE=public",
  ]) {
    assert.throws(() => parseProductionReleaseConfig(source));
  }
});

test("public is the only future live release mode", () => {
  assert.deepEqual(
    parseProductionReleaseConfig("SURPLASSE_PRODUCTION_RELEASE_MODE=public\n"),
    { SURPLASSE_PRODUCTION_RELEASE_MODE: "public" },
  );
});

test("frontends expose development locally and the versioned mode in production", () => {
  assert.equal(frontendReleaseMode("development"), "development");
  assert.equal(frontendReleaseMode("test"), "development");
  assert.equal(frontendReleaseMode("production"), "testers");
  assert.equal(
    frontendReleaseEnvironmentDefinitions("production")[
      "import.meta.env.VITE_SURPLASSE_RELEASE_MODE"
    ],
    JSON.stringify("testers"),
  );
});
