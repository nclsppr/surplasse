import { describe, expect, it, vi } from "vitest";

import worker, { classifyHostname, handleRequest } from "../src/index";

const BASE_DOMAIN = "surplasse.com";
const RESERVED =
  "www,api,dashboard,docs,app,admin,local,mail,autoconfig,autodiscover,mta-sts,smtp,imap,pop,pop3,webmail,status,reports,grafana";

function bindings(
  assets: Record<string, { body?: string; headers?: HeadersInit; status?: number }> = {},
): Env {
  return {
    APP_BASE_DOMAIN: BASE_DOMAIN,
    RESERVED_SUBDOMAINS: RESERVED,
    ASSETS: {
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const pathname = new URL(
          input instanceof Request ? input.url : input.toString(),
        ).pathname;
        const asset = assets[pathname];
        return asset
          ? new Response(asset.body ?? pathname, {
              status: asset.status ?? 200,
              headers: asset.headers,
            })
          : new Response("missing", { status: 404 });
      }),
    } as unknown as Fetcher,
  };
}

function request(hostname: string, pathname = "/", init?: RequestInit): Request {
  return new Request(`https://${hostname}${pathname}`, init);
}

describe("hostname classification", () => {
  it.each([
    [BASE_DOMAIN, "onboarding"],
    [`www.${BASE_DOMAIN}`, "redirect"],
    [`api.${BASE_DOMAIN}`, "api"],
    [`dashboard.${BASE_DOMAIN}`, "dashboard"],
    [`docs.${BASE_DOMAIN}`, "docs"],
    [`reports.${BASE_DOMAIN}`, "reserved"],
    [`bistrot-bleu.${BASE_DOMAIN}`, "commande"],
    [`nested.bistrot.${BASE_DOMAIN}`, "not-found"],
    ["example.com", "not-found"],
  ])("routes %s to %s", (hostname, expected) => {
    expect(classifyHostname(hostname, BASE_DOMAIN, RESERVED)).toBe(expected);
  });
});

describe("edge contract", () => {
  it("preserves the edge identity contract", async () => {
    const response = await worker.fetch(
      request(BASE_DOMAIN, "/.well-known/surplasse-edge"),
      bindings(),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("surplasse-edge-v1\n");
    expect(response.headers.get("x-surplasse-edge")).toBe("cloudflare");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("serves an uncached manifest only from the apex", async () => {
    const env = bindings({
      "/manifest.json": {
        body: '{"source_sha":"abc"}',
        headers: { "Content-Type": "application/json" },
      },
    });
    const apex = await worker.fetch(request(BASE_DOMAIN, "/.well-known/surplasse-manifest.json"), env);
    const www = await worker.fetch(
      request(`www.${BASE_DOMAIN}`, "/.well-known/surplasse-manifest.json"),
      env,
    );
    const reserved = await worker.fetch(
      request(`reports.${BASE_DOMAIN}`, "/.well-known/surplasse-manifest.json"),
      env,
    );

    expect(apex.status).toBe(200);
    expect(apex.headers.get("cache-control")).toBe("no-store");
    expect(www.status).toBe(308);
    expect(reserved.status).toBe(503);
  });

  it("redirects www while preserving the path and query", async () => {
    const response = await worker.fetch(
      request(`www.${BASE_DOMAIN}`, "/menu?lang=fr"),
      bindings(),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://surplasse.com/menu?lang=fr",
    );
  });

  it("redirects cleartext requests to the canonical HTTPS host", async () => {
    const apex = await worker.fetch(
      new Request(`http://${BASE_DOMAIN}/menu?lang=fr`),
      bindings(),
    );
    const www = await worker.fetch(
      new Request(`http://www.${BASE_DOMAIN}/menu?lang=fr`),
      bindings(),
    );

    expect(apex.status).toBe(308);
    expect(apex.headers.get("location")).toBe(
      "https://surplasse.com/menu?lang=fr",
    );
    expect(www.status).toBe(308);
    expect(www.headers.get("location")).toBe(
      "https://surplasse.com/menu?lang=fr",
    );
  });

  it("keeps management endpoints and reserved hosts closed", async () => {
    const management = await worker.fetch(
      request(`api.${BASE_DOMAIN}`, "/q/health"),
      bindings(),
    );
    const encodedManagement = await worker.fetch(
      request(`api.${BASE_DOMAIN}`, "/q%2Fhealth"),
      bindings(),
    );
    const doubleEncodedManagement = await worker.fetch(
      request(`api.${BASE_DOMAIN}`, "/q%252Fhealth"),
      bindings(),
    );
    const reserved = await worker.fetch(
      request(`reports.${BASE_DOMAIN}`),
      bindings(),
    );
    const connect = await worker.fetch(
      request(BASE_DOMAIN, "/stripe-connect/config"),
      bindings(),
    );

    expect(management.status).toBe(404);
    expect(management.headers.get("cache-control")).toBe("no-store");
    expect(encodedManagement.status).toBe(404);
    expect(doubleEncodedManagement.status).toBe(404);
    expect(reserved.status).toBe(503);
    expect(connect.status).toBe(503);
  });

  it("does not consume or transform API requests and responses", async () => {
    const rawBody = '{"id":"evt_test","type":"payment_intent.succeeded"}';
    const apiRequest = request(`api.${BASE_DOMAIN}`, "/webhooks/stripe/payments", {
      method: "POST",
      body: rawBody,
      headers: { "Stripe-Signature": "test-signature" },
    });
    const originResponse = new Response("accepted", {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    });
    const originFetch = vi.fn(async (forwarded: Request) => {
      expect(forwarded).toBe(apiRequest);
      expect(forwarded.headers.get("stripe-signature")).toBe("test-signature");
      expect(await forwarded.text()).toBe(rawBody);
      return originResponse;
    });

    const response = await handleRequest(
      apiRequest,
      bindings(),
      originFetch,
    );

    expect(originFetch).toHaveBeenCalledOnce();
    expect(response).toBe(originResponse);
  });
});

describe("static assets", () => {
  it("maps the strict Onboarding allowlist and restores its CSP", async () => {
    const env = bindings({
      "/onboarding/frontends/onboarding/index.html": {
        body: "onboarding",
        headers: { "Content-Type": "text/html" },
      },
    });
    const response = await worker.fetch(request(BASE_DOMAIN), env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("onboarding");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain(
      "connect-js.stripe.com",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "form-action 'self'",
    );
    expect(response.headers.get("strict-transport-security")).toContain(
      "includeSubDomains",
    );
    expect(response.headers.get("permissions-policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });

  it.each([
    ["/brand/surplasse-social-card.svg", "image/svg+xml"],
    ["/brand/surplasse-social-card.png", "image/png"],
  ])("serves the public product social card at %s", async (publicPath, contentType) => {
    const assetPath = `/onboarding${publicPath}`;
    const env = bindings({
      [assetPath]: {
        body: "social-card",
        headers: { "Content-Type": contentType },
      },
    });
    const response = await worker.fetch(request(BASE_DOMAIN, publicPath), env);

    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect(response.headers.get("content-type")).toBe(contentType);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("refuses unknown Onboarding paths and non-read static methods", async () => {
    const missing = await worker.fetch(
      request(BASE_DOMAIN, "/private"),
      bindings(),
    );
    const unlistedBrandFile = await worker.fetch(
      request(BASE_DOMAIN, "/brand/fonts/README.md"),
      bindings(),
    );
    const post = await worker.fetch(
      request(`dashboard.${BASE_DOMAIN}`, "/", { method: "POST" }),
      bindings(),
    );

    expect(missing.status).toBe(404);
    expect(unlistedBrandFile.status).toBe(404);
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD");
  });

  it.each(["dashboard", "commande"] as const)(
    "serves the %s SPA fallback without caching HTML immutably",
    async (application) => {
      const hostname =
        application === "dashboard"
          ? `dashboard.${BASE_DOMAIN}`
          : `bistrot.${BASE_DOMAIN}`;
      const env = bindings({
        [`/${application}/index.html`]: {
          body: application,
          headers: { "Content-Type": "text/html" },
        },
      });

      const response = await worker.fetch(
        request(hostname, "/route-interne"),
        env,
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(application);
      expect(response.headers.get("cache-control")).toBe("no-cache");
      expect(response.headers.get("content-security-policy")).toContain(
        "https://api.surplasse.com",
      );
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      if (application === "commande") {
        expect(response.headers.get("content-security-policy")).toContain(
          "https://js.stripe.com",
        );
      }
    },
  );

  it("resolves Nimbus directories but never uses an SPA fallback", async () => {
    const env = bindings({
      "/docs/architecture/index.html": {
        body: "documentation",
        headers: { "Content-Type": "text/html" },
      },
    });
    const found = await worker.fetch(
      request(`docs.${BASE_DOMAIN}`, "/architecture"),
      env,
    );
    const missing = await worker.fetch(
      request(`docs.${BASE_DOMAIN}`, "/inconnu"),
      env,
    );

    expect(found.status).toBe(200);
    expect(await found.text()).toBe("documentation");
    expect(missing.status).toBe(404);
  });
});
