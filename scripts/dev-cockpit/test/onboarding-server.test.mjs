import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createOnboardingStaticServer,
  INTERNAL_HEALTH_PATH,
  ONBOARDING_HOST,
  ONBOARDING_PORT,
} from "../onboarding-server.mjs";
import { close, listen, repoRoot, request } from "./helpers.mjs";

const PUBLIC_ORIGIN = "https://surplasse.test";
const PUBLIC_HEADERS = Object.freeze({ Host: "surplasse.test" });

test("Onboarding landing keeps truthful pilot terms and product evidence", async () => {
  const html = await readFile(`${repoRoot}/frontends/onboarding/index.html`, "utf8");

  assert.match(
    html,
    /0 % de commission pendant les 3 premiers mois, puis 1 % par commande\./,
  );
  assert.match(html, /Les frais Stripe sont distincts/);
  assert.match(html, /Surplasse n[’']est pas une marketplace\./);
  assert.match(html, /Simulation locale, données d’exemple\./);
  assert.match(html, /\.\.\/\.\.\/brand\/qr\/qr-demo\.png/);
  assert.match(html, /brand\/illustrations\/service-line\.svg/);
  assert.match(html, /brand\/payments\/apple-pay\.svg/);
  assert.match(html, /brand\/payments\/google-pay\.svg/);
  assert.match(html, /brand\/payments\/stripe\.svg/);
  assert.match(html, /data-order-console/);
  assert.match(html, /data-doc-path="\/roadmap\/"/);
  assert.doesNotMatch(html, /repeating-linear-gradient/);
  assert.doesNotMatch(html, /capture :|téléphone :/);
});

test("Onboarding landing interaction follows the canonical order states", async () => {
  const script = await readFile(`${repoRoot}/frontends/onboarding/index.js`, "utf8");

  assert.match(script, /id: "paid", label: "Nouvelle commande"/);
  assert.match(script, /id: "accepted", label: "Commande acceptée"/);
  assert.match(script, /id: "preparing", label: "En préparation"/);
  assert.match(script, /id: "ready", label: "Commande prête"/);
  assert.match(script, /id: "served", label: "Commande servie"/);
  assert.match(script, /domainConfig\.DASHBOARD_URL/);
  assert.match(script, /domainConfig\.DOCS_URL/);
  assert.doesNotMatch(script, /https:\/\/(?:dashboard\.|docs\.)?surplasse\.(?:com|test)/);
});

test("Onboarding demonstration ends with a truthful Dashboard service preview", async () => {
  const html = await readFile(`${repoRoot}/frontends/onboarding/creer.html`, "utf8");

  assert.match(html, /aria-valuemax="5"/);
  assert.match(html, /data-step="5"/);
  assert.match(html, /Commandes opérationnelles/);
  assert.match(html, /Prise de commandes/);
  assert.match(html, /\.dashboard-intake\{[^}]*border-top:3px double var\(--accent-press\)/);
  assert.doesNotMatch(html, /\.dashboard-intake\{[^}]*border-left/);
  assert.match(html, /Ouverte/);
  assert.match(html, /En pause/);
  assert.match(html, /Mettre en pause/);
  assert.match(html, /Rouvrir la prise de commandes/);
  assert.match(html, /paiement Stripe est déjà lancé/);
  assert.match(html, /servir ou la rembourser/);
  assert.match(html, /confirmDashboardPause/);
  assert.match(html, /Simulation locale/);
  assert.match(html, /Nouvelles/);
  assert.match(html, /Acceptées/);
  assert.match(html, /En préparation/);
  assert.match(html, /Prêtes/);
  assert.match(html, /Lancer la préparation/);
  assert.match(html, /Marquer comme servie/);
  assert.match(html, /aucune commande réelle n'est créée ou mise à jour/i);
  assert.match(html, /L'édition de la carte, l'historique et les métriques viendront/);
  assert.doesNotMatch(html, /Temps réel actif/);
});

test("Onboarding static server serves only the explicit public asset allowlist", async (t) => {
  assert.equal(ONBOARDING_HOST, "127.0.0.1");
  assert.equal(ONBOARDING_PORT, 4173);
  const server = createOnboardingStaticServer({ repoRoot, publicOrigin: PUBLIC_ORIGIN });
  const port = await listen(server);
  t.after(() => close(server));

  const expectedAssets = [
    ["/frontends/onboarding/", "text/html; charset=utf-8"],
    ["/frontends/onboarding/index.html", "text/html; charset=utf-8"],
    ["/frontends/onboarding/creer.html", "text/html; charset=utf-8"],
    ["/frontends/onboarding/connect.html", "text/html; charset=utf-8"],
    ["/frontends/onboarding/connect.js", "text/javascript; charset=utf-8"],
    ["/frontends/onboarding/runtime-config.js", "text/javascript; charset=utf-8"],
    ["/brand/styles.css?v=1", "text/css; charset=utf-8"],
    ["/brand/surplasse-symbol.svg", "image/svg+xml"],
    ["/brand/surplasse-wordmark.svg", "image/svg+xml"],
    ["/brand/surplasse-app-icon.svg", "image/svg+xml"],
    ["/brand/surplasse-logo-horizontal.svg", "image/svg+xml"],
    ["/brand/onboarding.css", "text/css; charset=utf-8"],
    ["/brand/onboarding.js", "text/javascript; charset=utf-8"],
    ["/brand/illustrations/service-line.svg", "image/svg+xml"],
    ["/brand/payments/apple-pay.svg", "image/svg+xml"],
    ["/brand/payments/google-pay.svg", "image/svg+xml"],
    ["/brand/payments/stripe.svg", "image/svg+xml"],
    ["/brand/fonts/bodoni-moda.css", "text/css; charset=utf-8"],
    ["/brand/qr/qr-demo.png", "image/png"],
  ];
  for (const [path, contentType] of expectedAssets) {
    const response = await request(port, { path, headers: PUBLIC_HEADERS });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers["content-type"], contentType, path);
    assert.notEqual(response.body.length, 0, path);
  }
});

test("Embedded Stripe onboarding exposes only public configuration and short sessions", async (t) => {
  const stripeConfig = Object.freeze({
    secretKey: "sk_test_example",
    publishableKey: "pk_test_example",
    accountId: "acct_test_pilot",
    establishmentName: "La Paprika",
  });
  const calls = [];
  const server = createOnboardingStaticServer({
    repoRoot,
    stripeConfig,
    publicOrigin: PUBLIC_ORIGIN,
    createAccountSession: async (receivedConfig) => {
      calls.push(receivedConfig);
      return { clientSecret: "account_session_secret" };
    },
  });
  const port = await listen(server);
  t.after(() => close(server));

  const config = await request(port, {
    path: "/stripe-connect/config",
    headers: PUBLIC_HEADERS,
  });
  const session = await request(port, {
    path: "/stripe-connect/account-session",
    method: "POST",
    headers: { ...PUBLIC_HEADERS, Origin: PUBLIC_ORIGIN },
  });

  assert.equal(config.status, 200);
  assert.deepEqual(JSON.parse(config.body), {
    publishableKey: "pk_test_example",
    establishmentName: "La Paprika",
  });
  assert.doesNotMatch(config.body, /sk_test|acct_test/);
  assert.equal(session.status, 200);
  assert.deepEqual(JSON.parse(session.body), { client_secret: "account_session_secret" });
  assert.deepEqual(calls, [stripeConfig]);
});

test("Embedded Stripe onboarding fails closed outside its same origin", async (t) => {
  const server = createOnboardingStaticServer({
    repoRoot,
    publicOrigin: PUBLIC_ORIGIN,
    stripeConfig: {
      secretKey: "sk_test_example",
      publishableKey: "pk_test_example",
      accountId: "acct_test_pilot",
      establishmentName: "La Paprika",
    },
    createAccountSession: async () => {
      throw new Error("must not be called");
    },
  });
  const port = await listen(server);
  t.after(() => close(server));

  const response = await request(port, {
    path: "/stripe-connect/account-session",
    method: "POST",
    headers: { ...PUBLIC_HEADERS, Origin: "https://attacker.example" },
  });

  assert.equal(response.status, 403);
  assert.deepEqual(JSON.parse(response.body), { error: "origin_not_allowed" });
});

test("Embedded Stripe onboarding stays disabled when local credentials are absent", async (t) => {
  const server = createOnboardingStaticServer({
    repoRoot,
    stripeConfig: null,
    publicOrigin: PUBLIC_ORIGIN,
  });
  const port = await listen(server);
  t.after(() => close(server));

  const config = await request(port, {
    path: "/stripe-connect/config",
    headers: PUBLIC_HEADERS,
  });
  const session = await request(port, {
    path: "/stripe-connect/account-session",
    method: "POST",
    headers: { ...PUBLIC_HEADERS, Origin: PUBLIC_ORIGIN },
  });

  assert.equal(config.status, 404);
  assert.equal(session.status, 503);
});

test("Onboarding static server never exposes repository files or traversal targets", async (t) => {
  let assetReads = 0;
  const server = createOnboardingStaticServer({
    repoRoot,
    publicOrigin: PUBLIC_ORIGIN,
    readAsset: () => {
      assetReads += 1;
      return Buffer.from("allowed");
    },
  });
  const port = await listen(server);
  t.after(() => close(server));

  const forbiddenPaths = [
    "/.certs/surplasse.test-key.pem",
    "/backend/.env",
    "/backend/.env.example",
    "/config/domains/development.env",
    "/package.json",
    "/brand/.DS_Store",
    "/brand/fonts/README.md",
    "/frontends/onboarding/../../config/domains/development.env",
    "/brand/%2e%2e/config/domains/development.env",
    "/arbitrary.txt",
  ];
  for (const path of forbiddenPaths) {
    const response = await request(port, { path, headers: PUBLIC_HEADERS });
    assert.equal(response.status, 404, path);
    assert.equal(response.body, "Public asset not found.\n", path);
  }
  assert.equal(assetReads, 0);
});

test("Onboarding static server reads an allowlisted file for every request", async (t) => {
  let version = 0;
  const server = createOnboardingStaticServer({
    repoRoot,
    publicOrigin: PUBLIC_ORIGIN,
    readAsset: () => Buffer.from(`preview-${++version}`),
  });
  const port = await listen(server);
  t.after(() => close(server));

  const first = await request(port, {
    path: "/frontends/onboarding/index.html",
    headers: PUBLIC_HEADERS,
  });
  const second = await request(port, {
    path: "/frontends/onboarding/index.html",
    headers: PUBLIC_HEADERS,
  });
  const post = await request(port, {
    path: "/frontends/onboarding/index.html",
    method: "POST",
    headers: PUBLIC_HEADERS,
  });

  assert.equal(first.body, "preview-1");
  assert.equal(second.body, "preview-2");
  assert.equal(post.status, 405);
  assert.equal(post.body, "Method not allowed.\n");
  assert.equal(version, 2);
});

test("Onboarding refuses direct loopback navigation but keeps a private readiness probe", async (t) => {
  const server = createOnboardingStaticServer({ repoRoot, publicOrigin: PUBLIC_ORIGIN });
  const port = await listen(server);
  t.after(() => close(server));

  const direct = await request(port, { path: "/frontends/onboarding/index.html" });
  const health = await request(port, { path: INTERNAL_HEALTH_PATH });

  assert.equal(direct.status, 421);
  assert.deepEqual(JSON.parse(direct.body), { error: "canonical_host_required" });
  assert.equal(health.status, 200);
  assert.equal(health.body, "ready\n");
});
