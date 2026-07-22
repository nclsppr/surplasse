import { defineConfig } from "allure";

import { getE2eExecutionPaths, resolveE2eTarget } from "./support/target.mjs";

const target = resolveE2eTarget();
const paths = getE2eExecutionPaths(target.storageId);

export default defineConfig({
  name: `Surplasse E2E - ${target.id}`,
  output: paths.report,
  historyPath: paths.history,
  appendHistory: true,
  historyLimit: 2_160,
  environment: target.storageId,
  qualityGate: {
    rules: [
      {
        maxFailures: 0,
      },
    ],
  },
  variables: {
    Target: target.id,
    "History ID": target.storageId,
    "Target kind": target.kind,
    "Base domain": target.baseDomain,
    Commit: process.env.GITHUB_SHA ?? "working-tree",
    Trigger: process.env.GITHUB_EVENT_NAME ?? "local",
  },
  plugins: {
    awesome: {
      options: {
        reportName: `Surplasse E2E - ${target.id}`,
        reportLanguage: "fr",
        singleFile: true,
        open: false,
      },
    },
  },
});
