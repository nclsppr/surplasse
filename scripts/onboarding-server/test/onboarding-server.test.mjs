import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createOnboardingStaticServer,
  INTERNAL_HEALTH_PATH,
  loadStripePilotConfig,
  ONBOARDING_HOST,
  ONBOARDING_PORT,
} from "../onboarding-server.mjs";
import { close, listen, repoRoot, request } from "./helpers.mjs";

const PUBLIC_ORIGIN = "https://surplasse.test";
const PUBLIC_HEADERS = Object.freeze({ Host: "surplasse.test" });

test("Onboarding landing presents production-ready product evidence", async () => {
  const html = await readFile(`${repoRoot}/frontends/onboarding/index.html`, "utf8");

  assert.match(html, /Vos commandes\. Vos clients\. Votre restaurant\./);
  assert.match(html, /Votre carte devient un service complet\./);
  assert.match(
    html,
    /0 % de commission pendant les 3 premiers mois, puis 1 % par commande\./,
  );
  assert.match(html, /Les frais Stripe sont distincts/);
  assert.match(html, /Surplasse n[’']est pas une marketplace\./);
  assert.match(html, /class="product-stage"/);
  assert.match(html, /\.\.\/\.\.\/brand\/qr\/qr-demo\.png/);
  assert.match(html, /brand\/illustrations\/service-line\.svg/);
  assert.match(html, /brand\/payments\/apple-pay\.svg/);
  assert.match(html, /brand\/payments\/google-pay\.svg/);
  assert.match(html, /brand\/payments\/stripe\.svg/);
  assert.match(html, /data-order-console/);
  assert.match(html, /data-doc-path="\/roadmap\/"/);
  assert.doesNotMatch(
    html,
    /Circuit produit visé|pendant le pilote|Démo locale|Pilote prévu|Parcours cible|futur dashboard|Simulation locale|Paiement prévu|Infrastructure de paiement prévue|Contrat de démo|Phase pilote/,
  );
  assert.doesNotMatch(html, /repeating-linear-gradient/);
  assert.doesNotMatch(html, /capture :|téléphone :/);
});

test("Onboarding landing exposes canonical and truthful social metadata", async () => {
  const html = await readFile(`${repoRoot}/frontends/onboarding/index.html`, "utf8");
  const cardUrl = "https://surplasse.com/brand/surplasse-social-card.png";

  assert.match(html, /<link rel="canonical" href="https:\/\/surplasse\.com\/">/);
  assert.match(html, /<meta property="og:type" content="website">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/surplasse\.com\/">/);
  assert.ok(html.includes(`<meta property="og:image" content="${cardUrl}">`));
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.ok(html.includes(`<meta name="twitter:image" content="${cardUrl}">`));

  const jsonLdSource = html.match(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/,
  )?.[1];
  assert.ok(jsonLdSource, "JSON-LD block");
  assert.deepEqual(JSON.parse(jsonLdSource), {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://surplasse.com/#website",
    url: "https://surplasse.com/",
    name: "Surplasse",
    description:
      "Un canal de commande directe pour relier chaque table à votre cuisine, sans marketplace.",
    inLanguage: "fr-FR",
    image: {
      "@type": "ImageObject",
      url: cardUrl,
      width: 1200,
      height: 630,
    },
  });
  assert.doesNotMatch(jsonLdSource, /offers|aggregateRating|founder|price/i);
});

test("Onboarding landing interaction follows the canonical order states", async () => {
  const script = await readFile(`${repoRoot}/frontends/onboarding/index.js`, "utf8");

  assert.match(script, /id: "paid",\s+label: "Nouvelle commande"/);
  assert.match(script, /id: "accepted",\s+label: "Commande acceptée"/);
  assert.match(script, /id: "preparing",\s+label: "En préparation"/);
  assert.match(script, /id: "ready",\s+label: "Commande prête"/);
  assert.match(script, /id: "served",\s+label: "Commande servie"/);
  assert.match(script, /action: "Rejouer depuis le QR"/);
  assert.match(script, /data-trigger-order/);
  assert.match(script, /data-reset-order/);
  assert.match(script, /statusRail\.scrollTo/);
  assert.doesNotMatch(script, /simulation/i);
  assert.match(script, /domainConfig\.DASHBOARD_URL/);
  assert.match(script, /domainConfig\.DOCS_URL/);
  assert.doesNotMatch(script, /https:\/\/(?:dashboard\.|docs\.)?surplasse\.(?:com|test)/);
});

test("Stripe activation fallback returns to the configured Dashboard", async () => {
  const html = await readFile(`${repoRoot}/frontends/onboarding/connect.html`, "utf8");
  const script = await readFile(`${repoRoot}/frontends/onboarding/connect.js`, "utf8");

  assert.match(html, /src="runtime-config\.js"/);
  assert.match(html, /id="fallback-dashboard"/);
  assert.match(script, /SURPLASSE_DOMAIN_CONFIG\?\.DASHBOARD_URL/);
  assert.match(script, /dashboardLink\.href = `\$\{dashboardUrl\}\/auth\/login`/);
  assert.doesNotMatch(`${html}\n${script}`, /Démonstration|Simulation locale|mode test|compte pilote/i);
});

test("Onboarding flow ends with the Dashboard service controls", async () => {
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
  assert.match(html, /Service en cours/);
  assert.match(html, /Nouvelles/);
  assert.match(html, /Acceptées/);
  assert.match(html, /En préparation/);
  assert.match(html, /Prêtes/);
  assert.match(html, /Lancer la préparation/);
  assert.match(html, /Marquer comme servie/);
  assert.match(html, /Votre canal direct est prêt/);
  assert.doesNotMatch(html, /Démonstration|Simulation locale|Données de démonstration/i);
  assert.doesNotMatch(html, /Temps réel actif/);
});

test("Onboarding photo upload stays in a single block formatting context", async () => {
  const html = await readFile(`${repoRoot}/frontends/onboarding/creer.html`, "utf8");

  assert.match(html, /\.drop\{[^}]*display:(?:block|flex|grid)/);
});

test("Dashboard demo keeps multi-word order actions readable", async () => {
  const html = await readFile(`${repoRoot}/frontends/onboarding/creer.html`, "utf8");
  const actionRule = html.match(/\.dashboard-order-action\{[^}]*\}/)?.[0] ?? "";

  assert.match(actionRule, /height:auto/);
  assert.match(actionRule, /line-height:1\.25/);
  assert.match(actionRule, /white-space:normal/);
  assert.match(
    html,
    /\.dashboard-order:not\(\[data-status="paid"\]\) \.dashboard-order-actions\{[^}]*grid-template-columns:minmax\(0,1fr\)/,
  );
});

test("Dashboard application keeps multi-word order actions readable", async () => {
  const styles = await readFile(`${repoRoot}/frontends/dashboard/src/index.css`, "utf8");
  const buttonRule = styles.match(/\.button\s*\{[^}]*\}/)?.[0] ?? "";

  assert.match(buttonRule, /padding:\s*var\(--sp-2\) var\(--sp-4\)/);
  assert.match(buttonRule, /line-height:\s*1\.25/);
  assert.match(buttonRule, /white-space:\s*normal/);
  assert.match(
    styles,
    /\.order-card:not\(\.order-card-paid\) \.order-card-actions-with-refund\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
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
    ["/brand/surplasse-social-card.svg", "image/svg+xml"],
    ["/brand/surplasse-social-card.png", "image/png"],
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

test("Embedded Stripe onboarding reads its secret from a mounted file", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "surplasse-onboarding-secret-"));
  const secretPath = join(directory, "stripe-secret-key");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(secretPath, "sk_test_fromfile\n", { mode: 0o600 });

  const config = loadStripePilotConfig(directory, {
    STRIPE_SECRET_KEY_FILE: secretPath,
    STRIPE_PUBLISHABLE_KEY: "pk_test_example",
    STRIPE_CONNECT_PILOT_ACCOUNT_ID: "acct_testpilot",
    STRIPE_CONNECT_PILOT_ESTABLISHMENT_NAME: "La Paprika",
  });

  assert.equal(config.secretKey, "sk_test_fromfile");
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
