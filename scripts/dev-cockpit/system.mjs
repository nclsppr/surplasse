import { spawn, execFile } from "node:child_process";
import { randomUUID, timingSafeEqual, X509Certificate } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

export class ProcessController {
  constructor(options = {}) {
    this.spawnImpl = options.spawnImpl ?? spawn;
    this.killImpl = options.killImpl ?? process.kill;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
    this.stdout = options.stdout ?? process.stdout;
    this.stderr = options.stderr ?? process.stderr;
    this.stopTimeoutMs = options.stopTimeoutMs ?? 8_000;
    this.baseEnvironment = options.baseEnvironment ?? process.env;
  }

  async start(definition, onExit) {
    const child = this.spawnImpl(definition.command.executable, [...definition.command.args], {
      cwd: definition.command.cwd,
      env: {
        ...this.baseEnvironment,
        ...(definition.command.environment ?? {}),
      },
      detached: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const handle = {
      child,
      pid: child.pid,
      running: true,
      exit: null,
      exitPromise: null,
    };

    handle.exitPromise = new Promise((resolveExit) => {
      child.once("exit", (code, signal) => {
        handle.running = false;
        handle.exit = { code, signal, error: null };
        resolveExit(handle.exit);
        onExit(handle.exit);
      });
      child.once("error", (error) => {
        if (!handle.running) {
          return;
        }
        handle.running = false;
        handle.exit = { code: null, signal: null, error };
        resolveExit(handle.exit);
        onExit(handle.exit);
      });
    });

    pipeWithPrefix(child.stdout, this.stdout, `[${definition.label}] `);
    pipeWithPrefix(child.stderr, this.stderr, `[${definition.label}] `);

    await waitForSpawn(child, handle);
    if (!Number.isInteger(handle.pid) || handle.pid <= 0) {
      throw new Error(`Unable to own process for ${definition.id}.`);
    }
    if (!handle.running) {
      throw handle.exit?.error ?? new Error(`Process ${definition.id} exited during startup.`);
    }
    return handle;
  }

  async stop(handle) {
    if (!handle?.running) {
      return;
    }

    this.signalOwnedGroup(handle.pid, "SIGTERM");
    const exitedGracefully = await this.waitForExit(handle.exitPromise);
    if (exitedGracefully || !handle.running) {
      return;
    }

    this.signalOwnedGroup(handle.pid, "SIGKILL");
    await handle.exitPromise;
  }

  signalOwnedGroup(pid, signal) {
    try {
      this.killImpl(-pid, signal);
    } catch (error) {
      if (error?.code !== "ESRCH") {
        throw error;
      }
    }
  }

  waitForExit(exitPromise) {
    return new Promise((resolveWait) => {
      const timer = this.setTimer(() => resolveWait(false), this.stopTimeoutMs);
      exitPromise.then(() => {
        this.clearTimer(timer);
        resolveWait(true);
      });
    });
  }
}

export class MailpitController {
  constructor(options = {}) {
    this.execFile = options.execFile ?? execFilePromise;
    this.instanceId = options.instanceId ?? randomUUID();
  }

  async isDockerAvailable() {
    try {
      await this.execFile("docker", ["info", "--format", "{{.ServerVersion}}"], { timeout: 3_000 });
      return true;
    } catch {
      return false;
    }
  }

  async inspect(definition, reference = definition.docker.name) {
    const template = [
      "{{.Id}}",
      "{{.Name}}",
      "{{.Config.Image}}",
      `{{index .Config.Labels "${definition.docker.managedLabel}"}}`,
      `{{index .Config.Labels "${definition.docker.ownershipLabel}"}}`,
      "{{.State.Running}}",
    ].join("|");
    try {
      const { stdout } = await this.execFile(
        "docker",
        ["inspect", "--format", template, reference],
        { timeout: 3_000 },
      );
      const [id, name, image, managed = "", owner = "", runningValue] = stdout.trim().split("|", 6);
      return {
        exists: true,
        id,
        name: name.replace(/^\//u, ""),
        image,
        running: runningValue === "true",
        managedByCockpit: managed === "true",
        ownedByCurrent: owner === this.instanceId,
        owner,
      };
    } catch {
      return {
        exists: false,
        id: "",
        name: "",
        image: "",
        running: false,
        managedByCockpit: false,
        ownedByCurrent: false,
        owner: "",
      };
    }
  }

  async start(definition) {
    const existing = await this.inspect(definition);
    if (existing.exists) {
      throw new CockpitOperationError("Le conteneur Mailpit existe déjà et n'appartient pas à ce cockpit.", 409);
    }
    const { stdout } = await this.execFile(
      "docker",
      [
        "run",
        "--detach",
        "--rm",
        "--name",
        definition.docker.name,
        "--label",
        `${definition.docker.managedLabel}=true`,
        "--label",
        `${definition.docker.ownershipLabel}=${this.instanceId}`,
        "--publish",
        "127.0.0.1:1025:1025",
        "--publish",
        "127.0.0.1:8025:8025",
        definition.docker.image,
      ],
      { timeout: 30_000 },
    );
    const containerId = stdout.trim();
    if (!containerId) {
      throw new Error("Docker did not return the Mailpit container identifier.");
    }
    return { containerId };
  }

  async stop(definition, handle) {
    if (!handle?.containerId) {
      throw new CockpitOperationError("Identifiant du conteneur possédé absent, arrêt refusé.", 409);
    }
    const existing = await this.inspect(definition, handle.containerId);
    if (!existing.exists) {
      return;
    }
    if (
      !existing.managedByCockpit ||
      !existing.ownedByCurrent ||
      existing.id !== handle.containerId ||
      existing.name !== definition.docker.name ||
      existing.image !== definition.docker.image
    ) {
      throw new CockpitOperationError("Mailpit a été lancé hors de ce cockpit et ne sera pas arrêté.", 409);
    }
    await this.execFile("docker", ["stop", "--time", "5", handle.containerId], { timeout: 10_000 });
  }
}

export async function probeHttp(health, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(health.url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(health.timeoutMs ?? 1_500),
      headers: { Accept: "application/json,text/html;q=0.8,*/*;q=0.5" },
    });
    if (!response.ok) {
      return false;
    }
    if (health.url.endsWith("/q/health/ready")) {
      const payload = await response.json();
      return payload?.status === "UP";
    }
    return true;
  } catch {
    return false;
  }
}

export async function probePorts(ports, options = {}) {
  const probe = options.probe ?? probePort;
  const results = await Promise.all(ports.map((port) => probe(port)));
  return results.some(Boolean);
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

export function probePort(port, options = {}) {
  const connect = options.connect ?? net.createConnection;
  const timeoutMs = options.timeoutMs ?? 250;
  return new Promise((resolveProbe) => {
    const socket = connect({ host: "127.0.0.1", port });
    let settled = false;
    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolveProbe(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export class CockpitOperationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "CockpitOperationError";
    this.statusCode = statusCode;
  }
}

function waitForSpawn(child, handle) {
  return new Promise((resolveSpawn, rejectSpawn) => {
    child.once("spawn", resolveSpawn);
    child.once("error", rejectSpawn);
    handle.exitPromise.then((exit) => {
      if (exit.error) {
        rejectSpawn(exit.error);
      }
    });
  });
}

function pipeWithPrefix(input, output, prefix) {
  if (!input || !output) {
    return;
  }
  let atLineStart = true;
  input.on("data", (chunk) => {
    const text = String(chunk);
    let rendered = "";
    for (const part of text.split(/(?<=\n)/u)) {
      if (atLineStart && part) {
        rendered += prefix;
      }
      rendered += part;
      atLineStart = part.endsWith("\n");
    }
    output.write(rendered);
  });
}

function execFilePromise(file, args, options) {
  return new Promise((resolveExecution, rejectExecution) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        rejectExecution(error);
        return;
      }
      resolveExecution({ stdout, stderr });
    });
  });
}
