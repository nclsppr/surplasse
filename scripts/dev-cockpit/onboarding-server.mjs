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
  "/frontends/onboarding/runtime-config.js": ["frontends/onboarding/runtime-config.js", "text/javascript; charset=utf-8"],
  "/brand/board.html": ["brand/board.html", "text/html; charset=utf-8"],
  "/brand/components.css": ["brand/components.css", "text/css; charset=utf-8"],
  "/brand/logo.svg": ["brand/logo.svg", "image/svg+xml"],
  "/brand/styles.css": ["brand/styles.css", "text/css; charset=utf-8"],
  "/brand/tokens/colors.css": ["brand/tokens/colors.css", "text/css; charset=utf-8"],
  "/brand/tokens/spacing.css": ["brand/tokens/spacing.css", "text/css; charset=utf-8"],
  "/brand/tokens/typography.css": ["brand/tokens/typography.css", "text/css; charset=utf-8"],
  "/brand/fonts/Parisienne-Regular.ttf": ["brand/fonts/Parisienne-Regular.ttf", "font/ttf"],
  "/brand/fonts/archivo-400_900-latin-ext.woff2": ["brand/fonts/archivo-400_900-latin-ext.woff2", "font/woff2"],
  "/brand/fonts/archivo-400_900-latin.woff2": ["brand/fonts/archivo-400_900-latin.woff2", "font/woff2"],
  "/brand/fonts/archivo-400_900-vietnamese.woff2": ["brand/fonts/archivo-400_900-vietnamese.woff2", "font/woff2"],
  "/brand/fonts/archivo.css": ["brand/fonts/archivo.css", "text/css; charset=utf-8"],
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

export function createOnboardingStaticServer(options) {
  const assets = createAssetRoutes(options.repoRoot);
  const readAsset = options.readAsset ?? readAllowedAsset;
  return http.createServer((request, response) => {
    for (const [name, value] of Object.entries(RESPONSE_HEADERS)) {
      response.setHeader(name, value);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed.\n");
      return;
    }

    let pathname;
    try {
      pathname = new URL(request.url ?? "/", "http://onboarding.invalid").pathname;
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Public asset not found.\n");
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
  const server = createOnboardingStaticServer({ repoRoot });
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
  ONBOARDING_HOST,
  ONBOARDING_PORT,
  PUBLIC_FILES,
  RESPONSE_HEADERS,
  readAllowedAsset,
};
