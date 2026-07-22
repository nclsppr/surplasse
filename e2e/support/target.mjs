import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadDomainConfig } from "../../config/domains/load-domain-config.mjs";

const TARGET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RUN_ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

export function resolveE2eTarget(targetName, environment = process.env) {
  const selectedTarget = targetName ?? environment.SURPLASSE_E2E_TARGET;
  if (!selectedTarget) {
    throw new Error(
      "Missing E2E target. Select development, production or custom explicitly.",
    );
  }

  if (selectedTarget === "development" || selectedTarget === "production") {
    const domainConfig = loadDomainConfig(selectedTarget);
    return createTarget({
      id: selectedTarget,
      kind: selectedTarget,
      baseDomain: domainConfig.APP_BASE_DOMAIN,
      establishmentSlug: environment.SURPLASSE_E2E_ESTABLISHMENT_SLUG,
      ignoreHTTPSErrors: selectedTarget === "development",
    });
  }

  if (selectedTarget !== "custom") {
    throw new Error(`Unknown E2E target: ${selectedTarget}`);
  }

  const id = requireTargetId(environment.SURPLASSE_E2E_TARGET_ID);
  if (id === "development" || id === "production") {
    throw new Error(`Custom E2E target ID collides with the ${id} history.`);
  }

  const baseDomain = requireBaseDomain(environment.SURPLASSE_E2E_BASE_DOMAIN);
  for (const profile of ["development", "production"]) {
    if (baseDomain === loadDomainConfig(profile).APP_BASE_DOMAIN) {
      throw new Error(`Use the ${profile} E2E target for ${baseDomain}.`);
    }
  }

  return createTarget({
    id,
    kind: "custom",
    baseDomain,
    establishmentSlug: environment.SURPLASSE_E2E_ESTABLISHMENT_SLUG,
    ignoreHTTPSErrors: false,
  });
}

export function getE2ePaths(targetStorageId) {
  const safeStorageId = requireStorageId(targetStorageId);
  const root = join(repositoryRoot, ".surplasse", "e2e", safeStorageId);
  return Object.freeze({
    // These flat paths are kept only as a migration source for reports created
    // before publications became versioned. New runs are exposed through the
    // atomic current.json pointer and immutable releases below.
    ...createArtifactPaths(root),
    root,
    current: join(root, "current.json"),
    lock: join(root, "run.lock"),
    releases: join(root, "releases"),
    staging: join(root, "runs"),
  });
}

export function getE2eRunPaths(targetStorageId, runId) {
  const publishedPaths = getE2ePaths(targetStorageId);
  const safeRunId = requireRunId(runId);
  const root = join(publishedPaths.staging, safeRunId);
  return Object.freeze({
    ...createArtifactPaths(root),
    root,
  });
}

export function getE2eExecutionPaths(targetStorageId, environment = process.env) {
  const runId = environment.SURPLASSE_E2E_RUN_ID;
  return runId
    ? getE2eRunPaths(targetStorageId, runId)
    : getE2ePaths(targetStorageId);
}

function createArtifactPaths(root) {
  return {
    results: join(root, "allure-results"),
    report: join(root, "allure-report"),
    history: join(root, "history.jsonl"),
    playwright: join(root, "playwright"),
  };
}

function createTarget({
  id,
  kind,
  baseDomain,
  establishmentSlug,
  ignoreHTTPSErrors,
}) {
  const slug = optionalEstablishmentSlug(establishmentSlug);
  const origin = (subdomain) =>
    `https://${subdomain ? `${subdomain}.` : ""}${baseDomain}`;

  return Object.freeze({
    id,
    storageId:
      kind === "custom"
        ? `${id}-${createHash("sha256").update(baseDomain).digest("hex").slice(0, 12)}`
        : id,
    kind,
    baseDomain,
    onboardingUrl: origin(""),
    dashboardUrl: origin("dashboard"),
    apiUrl: origin("api"),
    wwwUrl: origin("www"),
    reservedAppUrl: origin("app"),
    establishmentSlug: slug,
    establishmentUrl: slug ? origin(slug) : undefined,
    ignoreHTTPSErrors,
  });
}

function requireTargetId(value) {
  if (
    !value ||
    value.length > 48 ||
    value !== value.trim() ||
    !TARGET_ID_PATTERN.test(value)
  ) {
    throw new Error(
      "SURPLASSE_E2E_TARGET_ID must be a lowercase kebab-case identifier of at most 48 characters.",
    );
  }
  return value;
}

function requireStorageId(value) {
  if (
    !value ||
    value.length > 64 ||
    value !== value.trim() ||
    !TARGET_ID_PATTERN.test(value)
  ) {
    throw new Error(
      "E2E storage ID must be a lowercase kebab-case identifier of at most 64 characters.",
    );
  }
  return value;
}

function requireRunId(value) {
  if (!value || !RUN_ID_PATTERN.test(value)) {
    throw new Error("E2E run ID must be a lowercase UUID v4.");
  }
  return value;
}

function requireBaseDomain(value) {
  if (!value || value !== value.trim() || value !== value.toLowerCase()) {
    throw new Error(
      "SURPLASSE_E2E_BASE_DOMAIN must be a normalized lowercase hostname.",
    );
  }

  let url;
  try {
    url = new URL(`https://${value}`);
  } catch {
    throw new Error("SURPLASSE_E2E_BASE_DOMAIN must be a valid hostname.");
  }

  if (
    url.hostname !== value ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !value.includes(".") ||
    isIP(value) !== 0 ||
    value.endsWith(".")
  ) {
    throw new Error(
      "SURPLASSE_E2E_BASE_DOMAIN must be a hostname only, without scheme, port, path or IP address.",
    );
  }
  return value;
}

function optionalEstablishmentSlug(value) {
  if (!value) {
    return undefined;
  }
  if (value !== value.trim() || !SLUG_PATTERN.test(value)) {
    throw new Error(
      "SURPLASSE_E2E_ESTABLISHMENT_SLUG must be a normalized direct subdomain label.",
    );
  }
  return value;
}
