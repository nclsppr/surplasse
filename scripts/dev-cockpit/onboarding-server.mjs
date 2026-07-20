import { lstatSync, readFileSync, realpathSync } from "node:fs";
import http from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ONBOARDING_HOST = "127.0.0.1";
const ONBOARDING_PORT = 4173;

const PUBLIC_FILES = Object.freeze({
  "/frontends/onboarding/": ["frontends/onboarding/index.html", "text/html; charset=utf-8"],
  "/frontends/onboarding/index.html": ["frontends/onboarding/index.html", "text/html; charset=utf-8"],
  "/frontends/onboarding/creer.html": ["frontends/onboarding/creer.html", "text/html; charset=utf-8"],
  "/frontends/onboarding/connect.html": ["frontends/onboarding/connect.html", "text/html; charset=utf-8"],
  "/frontends/onboarding/connect.js": ["frontends/onboarding/connect.js", "text/javascript; charset=utf-8"],
  "/frontends/onboarding/runtime-config.js": ["frontends/onboarding/runtime-config.js", "text/javascript; charset=utf-8"],
  "/brand/board.html": ["brand/board.html", "text/html; charset=utf-8"],
  "/brand/components.css": ["brand/components.css", "text/css; charset=utf-8"],
  "/brand/logo.svg": ["brand/logo.svg", "image/svg+xml"],
  "/brand/mark.svg": ["brand/mark.svg", "image/svg+xml"],
  "/brand/mark-orange.svg": ["brand/mark-orange.svg", "image/svg+xml"],
  "/brand/mark-mono.svg": ["brand/mark-mono.svg", "image/svg+xml"],
  "/brand/styles.css": ["brand/styles.css", "text/css; charset=utf-8"],
  "/brand/tokens/colors.css": ["brand/tokens/colors.css", "text/css; charset=utf-8"],
  "/brand/tokens/spacing.css": ["brand/tokens/spacing.css", "text/css; charset=utf-8"],
  "/brand/tokens/typography.css": ["brand/tokens/typography.css", "text/css; charset=utf-8"],
  "/brand/fonts/Parisienne-Regular.ttf": ["brand/fonts/Parisienne-Regular.ttf", "font/ttf"],
  "/brand/fonts/archivo-400_900-latin-ext.woff2": ["brand/fonts/archivo-400_900-latin-ext.woff2", "font/woff2"],
  "/brand/fonts/archivo-400_900-latin.woff2": ["brand/fonts/archivo-400_900-latin.woff2", "font/woff2"],
  "/brand/fonts/archivo-400_900-vietnamese.woff2": ["brand/fonts/archivo-400_900-vietnamese.woff2", "font/woff2"],
  "/brand/fonts/archivo.css": ["brand/fonts/archivo.css", "text/css; charset=utf-8"],
  "/brand/fonts/bodoni-moda-400-latin-ext.woff2": ["brand/fonts/bodoni-moda-400-latin-ext.woff2", "font/woff2"],
  "/brand/fonts/bodoni-moda-400-latin.woff2": ["brand/fonts/bodoni-moda-400-latin.woff2", "font/woff2"],
  "/brand/fonts/bodoni-moda.css": ["brand/fonts/bodoni-moda.css", "text/css; charset=utf-8"],
  "/brand/fonts/parisienne-400-latin-ext.woff2": ["brand/fonts/parisienne-400-latin-ext.woff2", "font/woff2"],
  "/brand/fonts/parisienne-400-latin.woff2": ["brand/fonts/parisienne-400-latin.woff2", "font/woff2"],
  "/brand/fonts/parisienne.css": ["brand/fonts/parisienne.css", "text/css; charset=utf-8"],
  "/brand/fonts/spacemono-400-latin-ext.woff2": ["brand/fonts/spacemono-400-latin-ext.woff2", "font/woff2"],
  "/brand/fonts/spacemono-400-latin.woff2": ["brand/fonts/spacemono-400-latin.woff2", "font/woff2"],
  "/brand/fonts/spacemono-400-vietnamese.woff2": ["brand/fonts/spacemono-400-vietnamese.woff2", "font/woff2"],
  "/brand/fonts/spacemono-700-latin-ext.woff2": ["brand/fonts/spacemono-700-latin-ext.woff2", "font/woff2"],
  "/brand/fonts/spacemono-700-latin.woff2": ["brand/fonts/spacemono-700-latin.woff2", "font/woff2"],
  "/brand/fonts/spacemono-700-vietnamese.woff2": ["brand/fonts/spacemono-700-vietnamese.woff2", "font/woff2"],
  "/brand/fonts/spacemono.css": ["brand/fonts/spacemono.css", "text/css; charset=utf-8"],
  "/brand/qr/center-mark.png": ["brand/qr/center-mark.png", "image/png"],
  "/brand/qr/qr-demo-development.png": ["brand/qr/qr-demo-development.png", "image/png"],
  "/brand/qr/qr-demo.png": ["brand/qr/qr-demo.png", "image/png"],
  "/brand/qr/sticker.html": ["brand/qr/sticker.html", "text/html; charset=utf-8"],
});

const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  "Cross-Origin-Resource-Policy": "same-site",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

const CONNECT_RESPONSE_HEADERS = Object.freeze({
  ...RESPONSE_HEADERS,
  "Content-Security-Policy": [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' https://connect-js.stripe.com https://js.stripe.com",
    "frame-src https://connect-js.stripe.com https://js.stripe.com",
    "img-src 'self' blob: data: https://*.stripe.com",
    "font-src 'self'",
    "connect-src 'self' https://api.stripe.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "unsafe-none",
});

const STRIPE_ACCOUNT_SESSION_PATH = "/stripe-connect/account-session";
const STRIPE_CONFIG_PATH = "/stripe-connect/config";

export function createOnboardingStaticServer(options) {
  const assets = createAssetRoutes(options.repoRoot);
  const readAsset = options.readAsset ?? readAllowedAsset;
  const stripeConfig = options.stripeConfig ?? null;
  const createAccountSession = options.createAccountSession ?? requestStripeAccountSession;
  return http.createServer(async (request, response) => {
    let pathname;
    try {
      pathname = new URL(request.url ?? "/", "http://onboarding.invalid").pathname;
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Public asset not found.\n");
      return;
    }

    const responseHeaders = pathname === "/frontends/onboarding/connect.html"
      ? CONNECT_RESPONSE_HEADERS
      : RESPONSE_HEADERS;
    for (const [name, value] of Object.entries(responseHeaders)) {
      response.setHeader(name, value);
    }

    if (pathname === STRIPE_CONFIG_PATH) {
      handleStripeConfig(request, response, stripeConfig);
      return;
    }
    if (pathname === STRIPE_ACCOUNT_SESSION_PATH) {
      await handleStripeAccountSession(request, response, stripeConfig, createAccountSession);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed.\n");
      return;
    }

    const asset = assets.get(pathname);
    if (!asset) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Public asset not found.\n");
      return;
    }

    let body;
    try {
      body = readAsset(asset.absolutePath);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Public asset not found.\n");
      return;
    }

    response.writeHead(200, {
      "Content-Length": body.length,
      "Content-Type": asset.contentType,
    });
    response.end(request.method === "HEAD" ? undefined : body);
  });
}

function handleStripeConfig(request, response, stripeConfig) {
  if (request.method !== "GET") {
    methodNotAllowed(response, "GET");
    return;
  }
  if (!stripeConfig) {
    json(response, 404, { error: "pilot_not_configured" });
    return;
  }
  json(response, 200, {
    publishableKey: stripeConfig.publishableKey,
    establishmentName: stripeConfig.establishmentName,
  });
}

async function handleStripeAccountSession(request, response, stripeConfig, createAccountSession) {
  if (request.method !== "POST") {
    methodNotAllowed(response, "POST");
    return;
  }
  if (!sameOrigin(request)) {
    json(response, 403, { error: "origin_not_allowed" });
    return;
  }
  if (!stripeConfig) {
    json(response, 503, { error: "pilot_not_configured" });
    return;
  }

  try {
    const session = await createAccountSession(stripeConfig);
    json(response, 200, { client_secret: session.clientSecret });
  } catch (error) {
    const requestId = typeof error?.requestId === "string" ? ` (${error.requestId})` : "";
    console.error(`Stripe Connect account session creation failed${requestId}.`);
    json(response, 502, { error: "stripe_account_session_unavailable" });
  }
}

async function requestStripeAccountSession(stripeConfig) {
  const form = new URLSearchParams({ account: stripeConfig.accountId });
  for (const component of ["account_onboarding", "notification_banner", "account_management"]) {
    form.set(`components[${component}][enabled]`, "true");
  }
  const response = await fetch("https://api.stripe.com/v1/account_sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${stripeConfig.secretKey}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const payload = await response.json();
  if (!response.ok || typeof payload.client_secret !== "string") {
    const error = new Error("Stripe rejected the account session request.");
    error.requestId = response.headers.get("request-id");
    throw error;
  }
  return { clientSecret: payload.client_secret };
}

export function loadStripePilotConfig(repoRoot, environment = process.env) {
  const backend = readOptionalDotenv(resolve(repoRoot, "backend/.env"));
  const commande = readOptionalDotenv(resolve(repoRoot, "frontends/commande/.env"));
  const secretKey = firstConfigured(environment.STRIPE_SECRET_KEY, backend.STRIPE_SECRET_KEY);
  const publishableKey = firstConfigured(
    environment.STRIPE_PUBLISHABLE_KEY,
    environment.VITE_STRIPE_PUBLISHABLE_KEY,
    commande.VITE_STRIPE_PUBLISHABLE_KEY,
  );
  const accountId = firstConfigured(
    environment.STRIPE_CONNECT_PILOT_ACCOUNT_ID,
    backend.STRIPE_CONNECT_PILOT_ACCOUNT_ID,
  );
  const establishmentName = firstConfigured(
    environment.STRIPE_CONNECT_PILOT_ESTABLISHMENT_NAME,
    backend.STRIPE_CONNECT_PILOT_ESTABLISHMENT_NAME,
  );

  if (!secretKey || !publishableKey || !accountId || !establishmentName) {
    return null;
  }
  if (!/^(?:sk|rk)_test_[A-Za-z0-9]+$/u.test(secretKey)) {
    throw new Error("The Stripe Connect pilot requires a test secret or restricted key.");
  }
  if (!/^pk_test_[A-Za-z0-9]+$/u.test(publishableKey)) {
    throw new Error("The Stripe Connect pilot requires a test publishable key.");
  }
  if (!/^acct_[A-Za-z0-9]+$/u.test(accountId)) {
    throw new Error("The Stripe Connect pilot account ID is invalid.");
  }
  return Object.freeze({ secretKey, publishableKey, accountId, establishmentName });
}

function readOptionalDotenv(path) {
  try {
    const values = {};
    for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
    return values;
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

function firstConfigured(...values) {
  return values.find((value) => typeof value === "string" && value.trim() !== "")?.trim();
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function methodNotAllowed(response, method) {
  response.setHeader("Allow", method);
  json(response, 405, { error: "method_not_allowed" });
}

function json(response, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(status, {
    "Content-Length": body.length,
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(body);
}

function createAssetRoutes(repoRoot) {
  const assets = new Map();
  for (const [route, [relativePath, contentType]] of Object.entries(PUBLIC_FILES)) {
    assets.set(route, Object.freeze({
      absolutePath: resolve(repoRoot, relativePath),
      contentType,
    }));
  }
  return assets;
}

function readAllowedAsset(absolutePath) {
  const metadata = lstatSync(absolutePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || realpathSync(absolutePath) !== absolutePath) {
    throw new Error("Allowlisted public asset is not a regular file.");
  }
  return readFileSync(absolutePath);
}

function start() {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(currentDirectory, "../..");
  const stripeConfig = loadStripePilotConfig(repoRoot);
  const server = createOnboardingStaticServer({ repoRoot, stripeConfig });
  server.on("error", (error) => {
    console.error("The Onboarding static server could not start.", error);
    process.exitCode = 1;
  });
  server.listen(ONBOARDING_PORT, ONBOARDING_HOST, () => {
    console.log(`Onboarding public assets are ready on http://${ONBOARDING_HOST}:${ONBOARDING_PORT}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  start();
}

export {
  CONNECT_RESPONSE_HEADERS,
  ONBOARDING_HOST,
  ONBOARDING_PORT,
  PUBLIC_FILES,
  RESPONSE_HEADERS,
  STRIPE_ACCOUNT_SESSION_PATH,
  STRIPE_CONFIG_PATH,
  readAllowedAsset,
  requestStripeAccountSession,
};
