import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createOnboardingStaticServer,
  ONBOARDING_HOST,
  ONBOARDING_PORT,
} from "../onboarding-server.mjs";
import { close, listen, repoRoot, request } from "./helpers.mjs";

test("Onboarding landing keeps truthful pilot terms and product evidence", async () => {
  const html = await readFile(`${repoRoot}/frontends/onboarding/index.html`, "utf8");

  assert.match(
    html,
    /0 % de commission pendant les 3 premiers mois, puis 1 % par commande\./,
  );
  assert.match(html, /Les frais Stripe sont distincts/);
  assert.match(html, /Surplasse n'est pas une marketplace\./);
  assert.match(html, /Prototype produit, données d'exemple\./);
  assert.match(html, /\.\.\/\.\.\/brand\/qr\/qr-demo\.png/);
  assert.doesNotMatch(html, /repeating-linear-gradient/);
  assert.doesNotMatch(html, /capture :|téléphone :/);
});

test("Onboarding demonstration ends with a truthful Dashboard service preview", async () => {
  const html = await readFile(`${repoRoot}/frontends/onboarding/creer.html`, "utf8");

  assert.match(html, /aria-valuemax="5"/);
  assert.match(html, /data-step="5"/);
  assert.match(html, /Commandes opérationnelles/);
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
  const server = createOnboardingStaticServer({ repoRoot });
  const port = await listen(server);
  t.after(() => close(server));

  const expectedAssets = [
    ["/frontends/onboarding/", "text/html; charset=utf-8"],
    ["/frontends/onboarding/index.html", "text/html; charset=utf-8"],
    ["/frontends/onboarding/creer.html", "text/html; charset=utf-8"],
    ["/frontends/onboarding/runtime-config.js", "text/javascript; charset=utf-8"],
    ["/brand/styles.css?v=1", "text/css; charset=utf-8"],
    ["/brand/logo.svg", "image/svg+xml"],
    ["/brand/qr/qr-demo.png", "image/png"],
  ];
  for (const [path, contentType] of expectedAssets) {
    const response = await request(port, { path });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers["content-type"], contentType, path);
    assert.notEqual(response.body.length, 0, path);
  }
});

test("Onboarding static server never exposes repository files or traversal targets", async (t) => {
  let assetReads = 0;
  const server = createOnboardingStaticServer({
    repoRoot,
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
    const response = await request(port, { path });
    assert.equal(response.status, 404, path);
    assert.equal(response.body, "Public asset not found.\n", path);
  }
  assert.equal(assetReads, 0);
});

test("Onboarding static server reads an allowlisted file for every request", async (t) => {
  let version = 0;
  const server = createOnboardingStaticServer({
    repoRoot,
    readAsset: () => Buffer.from(`preview-${++version}`),
  });
  const port = await listen(server);
  t.after(() => close(server));

  const first = await request(port, { path: "/frontends/onboarding/index.html" });
  const second = await request(port, { path: "/frontends/onboarding/index.html" });
  const post = await request(port, {
    path: "/frontends/onboarding/index.html",
    method: "POST",
  });

  assert.equal(first.body, "preview-1");
  assert.equal(second.body, "preview-2");
  assert.equal(post.status, 405);
  assert.equal(post.body, "Method not allowed.\n");
  assert.equal(version, 2);
});
