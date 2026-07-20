import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";

import { CockpitOperationError } from "./system.mjs";

const SECURITY_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

export function createCockpitServer(options) {
  const csrfToken = options.csrfToken ?? randomBytes(32).toString("hex");
  const publicDirectory = options.publicDirectory;
  const manager = options.manager;
  const configuredUrl = parseConfiguredUrl(options.configuredCockpitUrl);
  const assets = Object.freeze({
    "/": {
      contentType: "text/html; charset=utf-8",
      body: readFileSync(join(publicDirectory, "index.html"), "utf8").replaceAll(
        "__COCKPIT_CSRF_TOKEN__",
        csrfToken,
      ),
    },
    "/app.js": {
      contentType: "text/javascript; charset=utf-8",
      body: readFileSync(join(publicDirectory, "app.js"), "utf8"),
    },
    "/styles.css": {
      contentType: "text/css; charset=utf-8",
      body: readFileSync(join(publicDirectory, "styles.css"), "utf8"),
    },
  });

  const server = http.createServer(async (request, response) => {
    setSecurityHeaders(response);
    try {
      if (!hasSingleHeader(request, "host") || !isAllowedHost(request.headers.host, configuredUrl)) {
        sendJson(response, 421, { error: "Hôte refusé." });
        return;
      }

      const requestUrl = new URL(request.url ?? "/", "http://cockpit.invalid");
      if (assets[requestUrl.pathname]) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          methodNotAllowed(response, "GET, HEAD");
          return;
        }
        const asset = assets[requestUrl.pathname];
        response.writeHead(200, { "Content-Type": asset.contentType });
        response.end(request.method === "HEAD" ? undefined : asset.body);
        return;
      }

      if (requestUrl.pathname === "/api/state") {
        if (request.method !== "GET") {
          methodNotAllowed(response, "GET");
          return;
        }
        sendJson(response, 200, await manager.state());
        return;
      }

      const moduleRoute = /^\/api\/modules\/([a-z][a-z0-9-]*)\/(start|stop)$/u.exec(requestUrl.pathname);
      const presetRoute = /^\/api\/presets\/([a-z][a-z0-9-]*)\/(start|stop)$/u.exec(requestUrl.pathname);
      if (moduleRoute || presetRoute) {
        if (request.method !== "POST") {
          methodNotAllowed(response, "POST");
          return;
        }
        validateMutationRequest(request, csrfToken, configuredUrl);
        await readEmptyJsonObject(request);

        if (moduleRoute) {
          const [, id, action] = moduleRoute;
          const result = action === "start" ? await manager.start(id) : await manager.stop(id);
          sendJson(response, 200, { ok: true, module: result });
        } else {
          const [, name, action] = presetRoute;
          const result = await manager.runPreset(name, action);
          sendJson(response, 200, { ok: true, ...result });
        }
        return;
      }

      sendJson(response, 404, { error: "Route inconnue." });
    } catch (error) {
      const statusCode = error instanceof CockpitOperationError ? error.statusCode : 500;
      const message = error instanceof CockpitOperationError ? error.message : "Erreur interne du cockpit.";
      sendJson(response, statusCode, { error: message });
    }
  });

  return { server, csrfToken };
}

function validateMutationRequest(request, csrfToken, configuredUrl) {
  const origin = request.headers.origin;
  if (
    !hasSingleHeader(request, "origin") ||
    !isAllowedHostOriginPair(request.headers.host, origin, configuredUrl)
  ) {
    throw new CockpitOperationError("Origine refusée.", 403);
  }

  const providedToken = request.headers["x-surplasse-cockpit-token"];
  if (
    !hasSingleHeader(request, "x-surplasse-cockpit-token") ||
    typeof providedToken !== "string" ||
    !tokensEqual(providedToken, csrfToken)
  ) {
    throw new CockpitOperationError("Jeton de sécurité invalide.", 403);
  }

  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new CockpitOperationError("Le corps doit être un objet JSON vide.", 415);
  }
}

async function readEmptyJsonObject(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_024) {
      throw new CockpitOperationError("Corps de requête trop volumineux.", 413);
    }
    chunks.push(chunk);
  }

  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new CockpitOperationError("JSON invalide.", 400);
  }
  if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).length !== 0) {
    throw new CockpitOperationError("Aucun paramètre de commande n'est accepté.", 400);
  }
}

function isAllowedHost(host, configuredUrl) {
  if (typeof host !== "string" || host.includes(",")) {
    return false;
  }
  const normalized = host.toLowerCase();
  return normalized === configuredUrl?.host.toLowerCase();
}

function isAllowedHostOriginPair(host, origin, configuredUrl) {
  if (typeof host !== "string" || typeof origin !== "string" || host.includes(",") || origin.includes(",")) {
    return false;
  }
  return host.toLowerCase() === configuredUrl?.host.toLowerCase() && origin === configuredUrl?.origin;
}

function parseConfiguredUrl(value) {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function tokensEqual(provided, expected) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

function hasSingleHeader(request, expectedName) {
  let count = 0;
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index].toLowerCase() === expectedName) {
      count += 1;
    }
  }
  return count === 1;
}

function setSecurityHeaders(response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.setHeader(name, value);
  }
}

function sendJson(response, statusCode, payload) {
  if (response.headersSent) {
    response.end();
    return;
  }
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function methodNotAllowed(response, allow) {
  response.setHeader("Allow", allow);
  sendJson(response, 405, { error: "Méthode refusée." });
}

export { SECURITY_HEADERS, isAllowedHost, isAllowedHostOriginPair };
