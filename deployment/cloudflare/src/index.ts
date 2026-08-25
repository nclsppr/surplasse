type StaticApplication = "onboarding" | "commande" | "dashboard" | "docs";
type RouteKind = StaticApplication | "api" | "redirect" | "reserved" | "not-found";
type OriginFetch = (request: Request) => Promise<Response>;

const EDGE_PATH = "/.well-known/surplasse-edge";
const MANIFEST_PATH = "/.well-known/surplasse-manifest.json";
const ONBOARDING_EXACT_PATHS = new Map([
  ["/", "/onboarding/frontends/onboarding/index.html"],
  ["/index.html", "/onboarding/frontends/onboarding/index.html"],
  ["/creer.html", "/onboarding/frontends/onboarding/creer.html"],
  ["/connect.html", "/onboarding/frontends/onboarding/connect.html"],
  ["/connect.js", "/onboarding/frontends/onboarding/connect.js"],
  ["/runtime-config.js", "/onboarding/frontends/onboarding/runtime-config.js"],
]);
const STRIPE_CONNECT_PATHS = new Set([
  "/stripe-connect/config",
  "/stripe-connect/account-session",
]);
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

const SECURITY_HEADERS = Object.freeze({
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

const ONBOARDING_SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy":
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://connect-js.stripe.com https://js.stripe.com; frame-src https://connect-js.stripe.com https://js.stripe.com; img-src 'self' blob: data: https://*.stripe.com; font-src 'self'; connect-src 'self' https://api.stripe.com; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "Cross-Origin-Resource-Policy": "same-site",
  "Referrer-Policy": "no-referrer",
});

function applicationContentSecurityPolicy(
  application: "commande" | "dashboard",
  baseDomain: string,
): string {
  const apiOrigin = `https://api.${normalizeHostname(baseDomain)}`;
  if (application === "dashboard") {
    return `default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' ${apiOrigin}; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`;
  }
  return `default-src 'self'; style-src 'self'; script-src 'self' https://*.js.stripe.com https://js.stripe.com https://maps.googleapis.com; frame-src https://*.js.stripe.com https://js.stripe.com https://hooks.stripe.com https://link.com https://*.link.com; img-src 'self' blob: data: https://*.stripe.com https://*.link.com; font-src 'self'; connect-src 'self' ${apiOrigin} https://api.stripe.com https://maps.googleapis.com https://link.com https://*.link.com; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`;
}

export function classifyHostname(
  hostname: string,
  baseDomain: string,
  reservedSubdomains: string,
): RouteKind {
  const normalizedHostname = normalizeHostname(hostname);
  const normalizedBaseDomain = normalizeHostname(baseDomain);

  if (normalizedHostname === normalizedBaseDomain) return "onboarding";

  const suffix = `.${normalizedBaseDomain}`;
  if (!normalizedHostname.endsWith(suffix)) return "not-found";

  const label = normalizedHostname.slice(0, -suffix.length);
  if (!HOST_LABEL.test(label)) return "not-found";

  if (label === "www") return "redirect";
  if (label === "api") return "api";
  if (label === "dashboard") return "dashboard";
  if (label === "docs") return "docs";

  const reserved = new Set(
    reservedSubdomains
      .split(",")
      .map((candidate) => candidate.trim().toLowerCase())
      .filter(Boolean),
  );
  return reserved.has(label) ? "reserved" : "commande";
}

export async function handleRequest(
  request: Request,
  env: Env,
  originFetch: OriginFetch,
): Promise<Response> {
  const url = new URL(request.url);
  const route = classifyHostname(
    url.hostname,
    env.APP_BASE_DOMAIN,
    env.RESERVED_SUBDOMAINS,
  );

  if (url.protocol !== "https:") {
    const destination = new URL(request.url);
    destination.protocol = "https:";
    if (route === "redirect") destination.hostname = env.APP_BASE_DOMAIN;
    return new Response(null, {
      status: 308,
      headers: secureHeaders({
        "Cache-Control": "no-store",
        Location: destination.toString(),
      }),
    });
  }

  if (url.pathname === EDGE_PATH) {
    return textResponse("surplasse-edge-v1\n", 200, {
      "Cache-Control": "no-store",
      "X-Surplasse-Edge": "cloudflare",
    });
  }

  if (url.pathname === MANIFEST_PATH && route === "onboarding") {
    const response = await serveExactAsset(
      request,
      env,
      "/manifest.json",
      "docs",
    );
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  switch (route) {
    case "redirect": {
      const destination = new URL(request.url);
      destination.hostname = env.APP_BASE_DOMAIN;
      return new Response(null, {
        status: 308,
        headers: secureHeaders({ Location: destination.toString() }),
      });
    }
    case "api":
      if (isManagementPath(url.pathname)) {
        return textResponse("Not found.\n", 404, { "Cache-Control": "no-store" });
      }
      try {
        return await originFetch(request);
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "surplasse_origin_fetch_failed",
            hostname: url.hostname,
            method: request.method,
            error_name: error instanceof Error ? error.name : "unknown",
          }),
        );
        return textResponse("Bad gateway.\n", 502, { "Cache-Control": "no-store" });
      }
    case "reserved":
      return textResponse(
        "This Surplasse subdomain is reserved but has no service in this deployment.\n",
        503,
        { "Cache-Control": "no-store" },
      );
    case "not-found":
      return textResponse("Not found.\n", 404, { "Cache-Control": "no-store" });
    case "onboarding":
      if (STRIPE_CONNECT_PATHS.has(url.pathname)) {
        return textResponse(
          "Stripe Connect is not available in this production release.\n",
          503,
          { "Cache-Control": "no-store" },
        );
      }
      return serveOnboarding(request, env);
    case "dashboard":
    case "commande":
      return serveSinglePageApplication(request, env, route);
    case "docs":
      return serveDocumentation(request, env);
  }
}

async function serveOnboarding(request: Request, env: Env): Promise<Response> {
  const methodFailure = staticMethodFailure(request);
  if (methodFailure) return methodFailure;

  const pathname = new URL(request.url).pathname;
  if (!isSafePublicPath(pathname)) {
    return textResponse("Not found.\n", 404, { "Cache-Control": "no-store" });
  }
  const exactPath = ONBOARDING_EXACT_PATHS.get(pathname);
  if (exactPath) return serveExactAsset(request, env, exactPath, "onboarding");

  if (pathname.startsWith("/brand/") && !pathname.includes("..")) {
    return serveExactAsset(request, env, `/onboarding${pathname}`, "onboarding");
  }

  return textResponse(
    "This path is not exposed by the Surplasse Onboarding.\n",
    404,
    { "Cache-Control": "no-store" },
  );
}

async function serveSinglePageApplication(
  request: Request,
  env: Env,
  application: "commande" | "dashboard",
): Promise<Response> {
  const methodFailure = staticMethodFailure(request);
  if (methodFailure) return methodFailure;

  const pathname = new URL(request.url).pathname;
  if (!isSafePublicPath(pathname)) {
    return textResponse("Not found.\n", 404, { "Cache-Control": "no-store" });
  }
  const assetPath = `/${application}${pathname}`;
  const exact = await fetchAsset(request, env, assetPath);
  if (exact.status !== 404 || hasFileExtension(pathname)) {
    return withStaticHeaders(exact, application, assetPath, env);
  }

  const indexPath = `/${application}/index.html`;
  const fallback = await fetchAsset(request, env, indexPath);
  return withStaticHeaders(fallback, application, indexPath, env);
}

async function serveDocumentation(request: Request, env: Env): Promise<Response> {
  const methodFailure = staticMethodFailure(request);
  if (methodFailure) return methodFailure;

  const pathname = new URL(request.url).pathname;
  if (!isSafePublicPath(pathname)) {
    return textResponse("Not found.\n", 404, { "Cache-Control": "no-store" });
  }
  const candidates = documentationCandidates(pathname);
  let response = await fetchAsset(request, env, candidates[0]);
  let resolvedPath = candidates[0];

  for (const candidate of candidates.slice(1)) {
    if (response.status !== 404) break;
    response = await fetchAsset(request, env, candidate);
    resolvedPath = candidate;
  }

  return withStaticHeaders(response, "docs", resolvedPath, env);
}

function documentationCandidates(pathname: string): string[] {
  if (pathname === "/") return ["/docs/index.html"];

  const exact = `/docs${pathname}`;
  if (hasFileExtension(pathname)) return [exact];
  if (pathname.endsWith("/")) return [exact, `${exact}index.html`];
  return [exact, `${exact}/index.html`, `${exact}.html`];
}

async function serveExactAsset(
  request: Request,
  env: Env,
  assetPath: string,
  application: StaticApplication,
): Promise<Response> {
  const methodFailure = staticMethodFailure(request);
  if (methodFailure) return methodFailure;
  const response = await fetchAsset(request, env, assetPath);
  return withStaticHeaders(response, application, assetPath, env);
}

function fetchAsset(request: Request, env: Env, assetPath: string): Promise<Response> {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = assetPath;
  assetUrl.search = "";
  return env.ASSETS.fetch(new Request(assetUrl, request));
}

function withStaticHeaders(
  response: Response,
  application: StaticApplication,
  assetPath: string,
  env: Env,
): Response {
  const headers = secureHeaders(response.headers);

  if (application === "onboarding") {
    for (const [name, value] of Object.entries(ONBOARDING_SECURITY_HEADERS)) {
      headers.set(name, value);
    }
    headers.set("Cache-Control", "no-store");
  } else {
    if (application === "commande" || application === "dashboard") {
      headers.set(
        "Content-Security-Policy",
        applicationContentSecurityPolicy(application, env.APP_BASE_DOMAIN),
      );
      headers.set("Cross-Origin-Resource-Policy", "same-site");
      headers.set("Referrer-Policy", "no-referrer");
    }

    if (assetPath.endsWith(".html")) {
      headers.set("Cache-Control", "no-cache");
    } else if (
      assetPath.includes("/assets/") ||
      assetPath.includes("/_astro/")
    ) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      headers.set("Cache-Control", "public, max-age=3600");
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function staticMethodFailure(request: Request): Response | null {
  return request.method === "GET" || request.method === "HEAD"
    ? null
    : textResponse("Method not allowed.\n", 405, {
        Allow: "GET, HEAD",
        "Cache-Control": "no-store",
      });
}

function textResponse(
  body: string,
  status: number,
  headers: HeadersInit = {},
): Response {
  return new Response(body, {
    status,
    headers: secureHeaders({
      "Content-Type": "text/plain; charset=utf-8",
      ...Object.fromEntries(new Headers(headers)),
    }),
  });
}

function secureHeaders(initial: HeadersInit = {}): Headers {
  const headers = new Headers(initial);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return headers;
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/u, "");
}

function hasFileExtension(pathname: string): boolean {
  const lastSegment = pathname.split("/").at(-1) ?? "";
  return lastSegment.includes(".");
}

function isManagementPath(pathname: string): boolean {
  const decoded = fullyDecodePath(pathname);
  return decoded === null || decoded === "/q" || decoded.startsWith("/q/");
}

function isSafePublicPath(pathname: string): boolean {
  const decoded = fullyDecodePath(pathname);
  return (
    decoded !== null &&
    !decoded.includes("\\") &&
    !decoded.includes("\0") &&
    !decoded.split("/").includes("..")
  );
}

function fullyDecodePath(pathname: string): string | null {
  let decoded = pathname;
  try {
    for (let depth = 0; depth < 5; depth += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return decoded;
      decoded = next;
    }
    return null;
  } catch {
    return null;
  }
}

const worker = {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, (originRequest) => fetch(originRequest));
  },
} satisfies ExportedHandler<Env>;

export default worker;
