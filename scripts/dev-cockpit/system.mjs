import { spawn } from "node:child_process";
import { timingSafeEqual, X509Certificate } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import https from "node:https";
import tls from "node:tls";

// `docker compose ps --format json` includes labels and mounts for every
// container. A complete local project already exceeds 16 KiB, so retain a
// bounded but comfortably sized response instead of truncating its first JSON
// object and making the cockpit report Docker as unavailable.
const MAX_COMMAND_OUTPUT = 256 * 1024;

export class ComposeController {
  constructor(options = {}) {
    this.script = options.script;
    this.cwd = options.cwd;
    this.profile = options.profile ?? "development";
    this.project = options.project ?? "surplasse";
    this.allowedServices = new Set(options.services ?? []);
    this.executeCommand = options.executeCommand ?? runFixedCommand;
  }

  async inspectAll() {
    const result = await this.executeCommand(
      this.script,
      [this.profile, "ps", "--all", "--format", "json"],
      { cwd: this.cwd, timeoutMs: 20_000 },
    );
    this.requireSuccess(result, "read the development project state");
    return parseComposePs(result.stdout, {
      allowedServices: this.allowedServices,
      project: this.project,
    });
  }

  async start(services, options = {}) {
    const selected = this.requireAllowedServices(services);
    const result = await this.executeCommand(
      this.script,
      [this.profile, "up", "--detach", "--build", "--wait", ...selected],
      { cwd: this.cwd, signal: options.signal, timeoutMs: 10 * 60_000 },
    );
    this.requireSuccess(result, "start the selected development services");
  }

  async stop(services, options = {}) {
    const selected = this.requireAllowedServices(services);
    const result = await this.executeCommand(
      this.script,
      [this.profile, "stop", "--timeout", "10", ...selected],
      { cwd: this.cwd, signal: options.signal, timeoutMs: 2 * 60_000 },
    );
    this.requireSuccess(result, "stop the selected development services");
  }

  requireAllowedServices(services) {
    if (!Array.isArray(services) || services.length === 0) {
      throw new CockpitOperationError("Aucun service Compose sélectionné.", 400);
    }
    const selected = [...new Set(services)];
    if (
      selected.length !== services.length ||
      selected.some((service) => typeof service !== "string" || !this.allowedServices.has(service))
    ) {
      throw new CockpitOperationError("Service Compose inconnu ou non autorisé.", 404);
    }
    return selected;
  }

  requireSuccess(result, action) {
    if (result?.exitCode === 0) {
      return;
    }
    if (result?.aborted) {
      throw new CockpitOperationError("L'opération Docker Compose a été interrompue.", 409);
    }
    const detail = safeCommandOutput(result?.stderr || result?.stdout);
    if (detail) {
      console.error(`Docker Compose could not ${action}: ${detail}`);
    }
    throw new CockpitOperationError(
      "Docker Compose n'a pas terminé l'opération. Consultez le terminal du cockpit.",
      503,
    );
  }
}

export function parseComposePs(output, options) {
  const statuses = new Map(
    [...options.allowedServices].map((service) => [service, missingComposeService(service)]),
  );
  const source = String(output ?? "").trim();
  if (!source) {
    return statuses;
  }

  let entries;
  try {
    entries = source.startsWith("[")
      ? JSON.parse(source)
      : source.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    throw new CockpitOperationError("Docker Compose a renvoyé un état illisible.", 503);
  }
  if (!Array.isArray(entries)) {
    entries = [entries];
  }

  for (const entry of entries) {
    if (
      !entry ||
      entry.Project !== options.project ||
      !options.allowedServices.has(entry.Service) ||
      statuses.get(entry.Service)?.exists
    ) {
      throw new CockpitOperationError("Docker Compose a renvoyé un service inattendu.", 503);
    }
    statuses.set(entry.Service, Object.freeze({
      service: entry.Service,
      exists: true,
      state: normalizeComposeValue(entry.State),
      health: normalizeComposeValue(entry.Health),
      exitCode: Number.isInteger(entry.ExitCode) ? entry.ExitCode : null,
    }));
  }
  return statuses;
}

export function runFixedCommand(executable, args, options = {}) {
  return new Promise((resolveRun) => {
    let child;
    try {
      child = spawn(executable, args, {
        cwd: options.cwd,
        env: process.env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        signal: options.signal,
      });
    } catch (error) {
      resolveRun({ exitCode: 1, stdout: "", stderr: error.message, aborted: false });
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;
    const collect = (current, chunk) => `${current}${chunk.toString("utf8")}`.slice(-MAX_COMMAND_OUTPUT);
    child.stdout.on("data", (chunk) => {
      stdout = collect(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = collect(stderr, chunk);
    });

    const timer = options.timeoutMs
      ? setTimeout(() => child.kill("SIGTERM"), options.timeoutMs)
      : null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolveRun(result);
    };
    child.once("error", (error) => finish({
      exitCode: 1,
      stdout,
      stderr: collect(stderr, error.message),
      aborted: options.signal?.aborted ?? false,
    }));
    child.once("close", (code) => finish({
      exitCode: code,
      stdout,
      stderr,
      aborted: options.signal?.aborted ?? false,
    }));
  });
}

function missingComposeService(service) {
  return Object.freeze({
    service,
    exists: false,
    state: "",
    health: "",
    exitCode: null,
  });
}

function normalizeComposeValue(value) {
  return typeof value === "string" ? value.toLowerCase().slice(0, 32) : "";
}

function safeCommandOutput(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(-500);
}

export function createPublicUrlProbe(options = {}) {
  const certificateFile = options.certificateFile ?? null;
  const baseDomain = options.baseDomain ?? null;
  const readCertificate = options.readCertificate ?? readFile;
  const lookup = options.lookup ?? dnsLookup;
  const request = options.request ?? requestHttps;
  const certificateAuthorities = options.certificateAuthorities ?? trustedCertificateAuthorities();
  const inFlight = new Map();
  return (health) => {
    const key = health?.url ?? "not-configured";
    if (inFlight.has(key)) {
      return inFlight.get(key);
    }
    const operation = probePublicUrl(health, {
      baseDomain,
      certificateAuthorities,
      certificateFile,
      lookup,
      readCertificate,
      request,
    }).finally(() => inFlight.delete(key));
    inFlight.set(key, operation);
    return operation;
  };
}

export async function probePublicUrl(health, options = {}) {
  let url;
  try {
    url = new URL(health?.url);
  } catch {
    return publicProbeResult("not-configured", "L'URL HTTPS publique n'est pas configurée.");
  }
  if (!options.baseDomain || !options.certificateFile) {
    return publicProbeResult(
      "not-configured",
      "Aucune URL HTTPS publique n'est configurée pour cette sonde.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    (url.hostname !== options.baseDomain && !url.hostname.endsWith(`.${options.baseDomain}`))
  ) {
    return publicProbeResult(
      "misconfigured",
      "La cible de la sonde HTTPS publique est invalide.",
    );
  }

  let certificate;
  try {
    certificate = await (options.readCertificate ?? readFile)(options.certificateFile);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return publicProbeResult(
        "certificate-missing",
        "Le certificat mkcert local est absent. Exécutez npm run local:setup.",
      );
    }
    return publicProbeResult(
      "certificate-error",
      "Le certificat mkcert local ne peut pas être lu.",
    );
  }
  if (!Buffer.isBuffer(certificate) || certificate.length === 0 || certificate.length > 65_536) {
    return publicProbeResult(
      "certificate-error",
      "Le certificat mkcert local a une taille invalide.",
    );
  }
  let expectedCertificate;
  try {
    expectedCertificate = new X509Certificate(certificate);
  } catch {
    return publicProbeResult(
      "certificate-error",
      "Le certificat mkcert local n'est pas un certificat PEM valide.",
    );
  }

  let addresses;
  try {
    addresses = await (options.lookup ?? dnsLookup)(url.hostname, { all: true, verbatim: true });
  } catch (error) {
    return classifyPublicProbeError(error);
  }
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return publicProbeResult("dns-error", "La résolution DNS système ne renvoie aucune adresse.");
  }
  if (addresses.some((entry) => entry?.address !== "127.0.0.1" || entry?.family !== 4)) {
    return publicProbeResult(
      "dns-misdirected",
      "Le domaine local ne pointe pas exclusivement vers 127.0.0.1.",
    );
  }

  let response;
  try {
    response = await (options.request ?? requestHttps)(url, {
      certificateAuthorities: options.certificateAuthorities ?? trustedCertificateAuthorities(),
      expectedCertificateRaw: expectedCertificate.raw,
      rejectUnauthorized: true,
      timeoutMs: health.timeoutMs ?? 1_500,
    });
  } catch (error) {
    return classifyPublicProbeError(error);
  }

  const statusCode = response.statusCode ?? 0;
  if (health.expectedStatusCodes?.includes(statusCode)) {
    if (health.expectation === "reserved") {
      return publicProbeResult(
        "reserved",
        `Domaine réservé, réponse HTTP ${statusCode} attendue.`,
        statusCode,
      );
    }
    if (health.expectation === "redirect") {
      return publicProbeResult(
        "redirect",
        `Redirection publique HTTP ${statusCode} conforme.`,
        statusCode,
      );
    }
    if (health.bodyExpectation === "quarkus-up") {
      try {
        if (JSON.parse(response.body)?.status !== "UP") {
          throw new Error("not up");
        }
      } catch {
        return publicProbeResult(
          "http-error",
          "La route Backend répond, mais sa santé publique n'est pas UP.",
          statusCode,
        );
      }
    }
    return publicProbeResult(
      "available",
      `DNS, certificat TLS, Caddy et route répondent en HTTP ${statusCode}.`,
      statusCode,
    );
  }
  if (statusCode === 502 || statusCode === 503) {
    return publicProbeResult(
      "gateway-error",
      `Caddy répond, mais la destination renvoie HTTP ${statusCode}.`,
      statusCode,
    );
  }
  return publicProbeResult(
    "http-error",
    `La route publique renvoie un statut HTTP inattendu (${statusCode || "inconnu"}).`,
    statusCode || null,
  );
}

function requestHttps(url, options) {
  return new Promise((resolveRequest, rejectRequest) => {
    let settled = false;
    const agent = new https.Agent({
      ca: options.certificateAuthorities,
      checkServerIdentity: tls.checkServerIdentity,
      keepAlive: false,
      lookup: loopbackLookup,
      maxCachedSessions: 0,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    });
    const finish = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      agent.destroy();
      callback(value);
    };
    const request = https.request(
      url,
      {
        method: "GET",
        agent,
        checkServerIdentity: tls.checkServerIdentity,
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
        servername: url.hostname,
        headers: { Accept: "application/json,text/html;q=0.9,*/*;q=0.5" },
      },
      (response) => {
        const peerCertificate = response.socket.getPeerCertificate();
        if (!sameCertificate(peerCertificate?.raw, options.expectedCertificateRaw)) {
          const error = new Error("Caddy served an unexpected certificate.");
          error.code = "CERTIFICATE_MISMATCH";
          response.destroy();
          finish(rejectRequest, error);
          return;
        }
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 65_536) {
            const error = new Error("Public URL response is too large.");
            error.code = "RESPONSE_TOO_LARGE";
            response.destroy(error);
            finish(rejectRequest, error);
            return;
          }
          chunks.push(chunk);
        });
        response.once("end", () =>
          finish(resolveRequest, {
            statusCode: response.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        response.once("error", (error) => finish(rejectRequest, error));
      },
    );
    request.setTimeout(options.timeoutMs, () => {
      const error = new Error("Public URL probe timed out.");
      error.code = "ETIMEDOUT";
      request.destroy(error);
    });
    request.once("error", (error) => finish(rejectRequest, error));
    request.end();
  });
}

function loopbackLookup(_hostname, options, callback) {
  if (options?.all) {
    callback(null, [{ address: "127.0.0.1", family: 4 }]);
    return;
  }
  callback(null, "127.0.0.1", 4);
}

function sameCertificate(actual, expected) {
  return (
    Buffer.isBuffer(actual) &&
    Buffer.isBuffer(expected) &&
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}

function trustedCertificateAuthorities() {
  const certificates = [];
  for (const type of ["default", "system"]) {
    try {
      certificates.push(...tls.getCACertificates(type));
    } catch {
      // A missing platform trust source becomes a normal TLS probe failure.
    }
  }
  return [...new Set(certificates)];
}

function classifyPublicProbeError(error) {
  if (error?.code === "ENOTFOUND" || error?.code?.startsWith("EAI_")) {
    return publicProbeResult("dns-error", "Le nom public ne se résout pas par le DNS système.");
  }
  if (error?.code === "CERTIFICATE_MISMATCH") {
    return publicProbeResult(
      "certificate-mismatch",
      "Caddy ne sert pas le certificat mkcert attendu par ce dépôt.",
    );
  }
  if (
    typeof error?.code === "string" &&
    (error.code.startsWith("ERR_TLS") ||
      error.code.startsWith("ERR_SSL") ||
      [
        "CERT_HAS_EXPIRED",
        "CERT_NOT_YET_VALID",
        "DEPTH_ZERO_SELF_SIGNED_CERT",
        "SELF_SIGNED_CERT_IN_CHAIN",
        "UNABLE_TO_GET_ISSUER_CERT",
        "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      ].includes(error.code))
  ) {
    return publicProbeResult(
      "tls-error",
      "La négociation TLS ou la validation du certificat mkcert a échoué.",
    );
  }
  if (error?.code === "ETIMEDOUT") {
    return publicProbeResult("timeout", "La route HTTPS publique ne répond pas dans le délai prévu.");
  }
  if (error?.code === "RESPONSE_TOO_LARGE") {
    return publicProbeResult("http-error", "La réponse HTTPS publique est anormalement volumineuse.");
  }
  if (["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH"].includes(error?.code)) {
    return publicProbeResult("proxy-error", "Caddy ne répond pas sur la route HTTPS publique.");
  }
  return publicProbeResult("unavailable", "La route HTTPS publique est indisponible.");
}

function publicProbeResult(state, detail, statusCode = null) {
  return Object.freeze({ state, detail, statusCode });
}

export class CockpitOperationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "CockpitOperationError";
    this.statusCode = statusCode;
  }
}
