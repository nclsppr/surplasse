import { resolve } from "node:path";

const DEMO_TABLE_CODE = "tbl_2f8e6a4c0b9d7e1f";

export function createRegistry(repoRoot, developmentUrls) {
  const urls = developmentUrls.urls;
  const modules = [
    processModule({
      id: "backend",
      label: "Backend",
      description: "API Quarkus et PostgreSQL Dev Services.",
      group: "applications",
      cwd: resolve(repoRoot, "backend"),
      executable: resolve(repoRoot, "scripts/run-with-domain-profile.sh"),
      args: [
        "development",
        "./mvnw",
        "quarkus:dev",
        "-Ddebug=5006",
        "-Dquarkus.http.host=127.0.0.1",
      ],
      ports: [8080, 5006, 5432],
      healthUrl: "http://127.0.0.1:8080/q/health/ready",
      publicHealth: publicHealth(appendPath(urls.backend, "/q/health/ready"), {
        bodyExpectation: "quarkus-up",
      }),
      startupTimeoutMs: 180_000,
      requiresDocker: true,
      links: [
        link("API", urls.backend),
        link("Santé", appendPath(urls.backend, "/q/health/ready")),
        link("Dev UI", appendPath(urls.backend, "/q/dev-ui")),
        link("Swagger UI", appendPath(urls.backend, "/q/swagger-ui")),
      ],
    }),
    processModule({
      id: "commande",
      label: "Commande",
      description: "Mini-site de commande du Cormoran.",
      group: "applications",
      cwd: resolve(repoRoot, "frontends/commande"),
      executable: "npm",
      args: ["run", "dev", "--", "--host", "127.0.0.1"],
      ports: [5173],
      healthUrl: "http://127.0.0.1:5173/",
      publicHealth: publicHealth(urls.commande),
      startupTimeoutMs: 45_000,
      links: [link("Ouvrir avec la table de démo", withQuery(urls.commande, "table", DEMO_TABLE_CODE))],
    }),
    processModule({
      id: "dashboard",
      label: "Dashboard",
      description: "Connexion restaurateur et service en salle.",
      group: "applications",
      cwd: resolve(repoRoot, "frontends/dashboard"),
      executable: "npm",
      args: ["run", "dev", "--", "--host", "127.0.0.1"],
      ports: [5174],
      healthUrl: "http://127.0.0.1:5174/",
      publicHealth: publicHealth(appendPath(urls.dashboard, "/auth/login")),
      startupTimeoutMs: 45_000,
      links: [
        link("Connexion", appendPath(urls.dashboard, "/auth/login")),
        link("Service", appendPath(urls.dashboard, "/service")),
      ],
    }),
    processModule({
      id: "onboarding",
      label: "Onboarding local",
      description: "Préfiguration de la vitrine et qualification Stripe Connect intégrée.",
      group: "applications",
      cwd: resolve(repoRoot, "scripts/dev-cockpit"),
      executable: process.execPath,
      args: [resolve(repoRoot, "scripts/dev-cockpit/onboarding-server.mjs")],
      ports: [4173],
      healthUrl: "http://127.0.0.1:4173/__health",
      publicHealth: publicHealth(urls.onboarding),
      startupTimeoutMs: 20_000,
      links: [
        link("Onboarding", urls.onboarding),
        link("Pilote Stripe intégré", appendPath(urls.onboarding, "/connect.html")),
        link("Planche de marque", localCompanionLink(urls.onboarding)),
      ],
    }),
    processModule({
      id: "docs",
      label: "Documentation",
      description: "Documentation Retype avec rechargement local.",
      group: "tools",
      cwd: repoRoot,
      executable: "npm",
      args: ["run", "docs:watch"],
      ports: [5005],
      healthUrl: "http://127.0.0.1:5005/surplasse/docs/",
      publicHealth: publicHealth(urls.docs),
      startupTimeoutMs: 45_000,
      links: [link("Documentation", urls.docs)],
    }),
    Object.freeze({
      id: "mailpit",
      label: "Mailpit",
      description: "Boîte email jetable pour les magic links.",
      group: "tools",
      kind: "docker",
      ports: Object.freeze([1025, 8025]),
      health: Object.freeze({ url: "http://127.0.0.1:8025/readyz", timeoutMs: 1_500 }),
      publicHealth: publicHealth(appendPath(urls.mailpit, "/readyz")),
      links: Object.freeze([link("Boîte de réception", urls.mailpit)]),
      docker: Object.freeze({
        name: "surplasse-mailpit",
        image: "axllent/mailpit:v1.30.4",
        managedLabel: "com.surplasse.dev-cockpit.managed",
        ownershipLabel: "com.surplasse.dev-cockpit.owner",
      }),
    }),
    Object.freeze({
      id: "postgresql",
      label: "PostgreSQL",
      description: "Démarré et arrêté avec les Dev Services du Backend.",
      group: "dependencies",
      kind: "derived",
      derivedFrom: "backend",
      ports: Object.freeze([5432]),
      links: Object.freeze([]),
    }),
    reservedModule("app", "Application app", urls.app),
    reservedModule("admin", "Administration", urls.admin),
  ];

  assertRegistry(modules);
  return Object.freeze({
    modules: Object.freeze(modules),
    presets: Object.freeze({
      core: Object.freeze(["mailpit", "backend", "commande", "dashboard"]),
      all: Object.freeze(["mailpit", "backend", "commande", "dashboard", "onboarding", "docs"]),
    }),
    urlConfiguration: Object.freeze({
      source: developmentUrls.source,
      warnings: developmentUrls.warnings,
      cockpitUrl: urls.cockpit,
      wwwUrl: withSubdomain(urls.onboarding, "www"),
      controlHealth: publicHealth(appendPath(urls.cockpit, "/styles.css")),
      wwwHealth: publicHealth(withSubdomain(urls.onboarding, "www"), {
        expectedStatusCodes: [308],
        expectation: "redirect",
      }),
      certificateFile: developmentUrls.certificateFile,
    }),
  });
}

function processModule(definition) {
  return Object.freeze({
    ...definition,
    kind: "process",
    ports: Object.freeze(definition.ports),
    command: Object.freeze({
      executable: definition.executable,
      args: Object.freeze(definition.args),
      cwd: definition.cwd,
    }),
    health: Object.freeze({ url: definition.healthUrl, timeoutMs: 1_500 }),
    publicHealth: definition.publicHealth,
    links: Object.freeze(definition.links),
    startupTimeoutMs: definition.startupTimeoutMs,
    requiresDocker: definition.requiresDocker ?? false,
    executable: undefined,
    args: undefined,
    cwd: undefined,
    healthUrl: undefined,
  });
}

function reservedModule(id, label, url) {
  return Object.freeze({
    id,
    label,
    description: "Domaine réservé, module non implémenté.",
    group: "reserved",
    kind: "reserved",
    ports: Object.freeze([]),
    links: Object.freeze(url ? [link("Domaine réservé", url)] : []),
    publicHealth: publicHealth(url, { expectedStatusCodes: [503], expectation: "reserved" }),
  });
}

function publicHealth(url, options = {}) {
  if (!url || new URL(url).protocol !== "https:") {
    return null;
  }
  return Object.freeze({
    url,
    timeoutMs: 1_500,
    expectedStatusCodes: Object.freeze(options.expectedStatusCodes ?? [200]),
    expectation: options.expectation ?? "available",
    bodyExpectation: options.bodyExpectation ?? null,
  });
}

function link(label, url) {
  return Object.freeze({ label, url });
}

function appendPath(base, path) {
  if (!base) {
    return null;
  }
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/$/u, "")}${path}`;
  return url.toString();
}

function withQuery(base, key, value) {
  if (!base) {
    return null;
  }
  const url = new URL(base);
  url.searchParams.set(key, value);
  return url.toString();
}

function withSubdomain(base, subdomain) {
  if (!base) {
    return null;
  }
  const url = new URL(base);
  if (url.protocol !== "https:") {
    return null;
  }
  url.hostname = `${subdomain}.${url.hostname}`;
  return url.origin;
}

function localCompanionLink(configuredOnboardingUrl) {
  if (!configuredOnboardingUrl) {
    return null;
  }
  const url = new URL(configuredOnboardingUrl);
  url.pathname = "/brand/board.html";
  return url.toString();
}

function assertRegistry(modules) {
  const ids = new Set();
  const managedPorts = new Set();
  for (const module of modules) {
    if (!/^[a-z][a-z0-9-]*$/u.test(module.id) || ids.has(module.id)) {
      throw new Error(`Invalid or duplicate module id: ${module.id}`);
    }
    ids.add(module.id);
    if (module.kind === "process" || module.kind === "docker") {
      for (const port of module.ports) {
        if (managedPorts.has(port)) {
          throw new Error(`Duplicate managed port: ${port}`);
        }
        managedPorts.add(port);
      }
    }
  }
}

export const EXPECTED_MODULE_IDS = Object.freeze([
  "backend",
  "commande",
  "dashboard",
  "onboarding",
  "docs",
  "mailpit",
  "postgresql",
  "app",
  "admin",
]);
