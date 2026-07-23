const DEMO_TABLE_CODE = "tbl_2f8e6a4c0b9d7e1f";

export function createRegistry(_repoRoot, developmentUrls) {
  const urls = developmentUrls.urls;
  const modules = [
    composeModule({
      id: "edge",
      service: "edge",
      label: "Caddy",
      description: "Entrée HTTPS du cluster et routage vers les modules.",
      group: "infrastructure",
      ports: [443],
      controllable: false,
      publicHealth: publicHealth(appendPath(urls.onboarding, "/.well-known/surplasse-edge")),
      links: [],
    }),
    composeModule({
      id: "backend",
      service: "backend",
      label: "Backend",
      description: "API Quarkus connectée au PostgreSQL du cluster.",
      group: "applications",
      ports: [8080],
      publicHealth: publicHealth(appendPath(urls.backend, "/q/health/ready"), {
        bodyExpectation: "quarkus-up",
      }),
      links: [
        link("API", urls.backend),
        link("Santé", appendPath(urls.backend, "/q/health/ready")),
        link("Swagger UI", appendPath(urls.backend, "/q/swagger-ui")),
      ],
    }),
    composeModule({
      id: "commande",
      service: "commande",
      label: "Commande",
      description: "Mini-site de commande du Cormoran.",
      group: "applications",
      ports: [8080],
      publicHealth: publicHealth(urls.commande),
      links: [link("Ouvrir avec la table de démo", withQuery(urls.commande, "table", DEMO_TABLE_CODE))],
    }),
    composeModule({
      id: "commande2",
      service: "commande2",
      label: "Commande2",
      description: "Variante Untitled UI du mini-site de commande.",
      group: "applications",
      ports: [8080],
      profiles: ["frontend-experiment"],
      publicHealth: publicHealth(appendPath(urls.commande, "/_experiments/untitled/")),
      links: [
        link(
          "Ouvrir la variante avec la table de démo",
          withQuery(
            appendPath(urls.commande, "/_experiments/untitled/"),
            "table",
            DEMO_TABLE_CODE,
          ),
        ),
      ],
    }),
    composeModule({
      id: "dashboard",
      service: "dashboard",
      label: "Dashboard",
      description: "Connexion restaurateur et service en salle.",
      group: "applications",
      ports: [8080],
      publicHealth: publicHealth(appendPath(urls.dashboard, "/auth/login")),
      links: [
        link("Connexion", appendPath(urls.dashboard, "/auth/login")),
        link("Service", appendPath(urls.dashboard, "/service")),
      ],
    }),
    composeModule({
      id: "dashboard2",
      service: "dashboard2",
      label: "Dashboard2",
      description: "Variante Untitled UI des vues métier du restaurateur.",
      group: "applications",
      ports: [8080],
      profiles: ["frontend-experiment"],
      publicHealth: publicHealth(
        appendPath(urls.dashboard, "/_experiments/untitled/auth/login"),
      ),
      links: [
        link(
          "Connexion à la variante",
          appendPath(urls.dashboard, "/_experiments/untitled/auth/login"),
        ),
        link(
          "Service dans la variante",
          appendPath(urls.dashboard, "/_experiments/untitled/service"),
        ),
      ],
    }),
    composeModule({
      id: "onboarding",
      service: "onboarding",
      label: "Onboarding",
      description: "Vitrine et qualification Stripe Connect locale.",
      group: "applications",
      ports: [4173],
      publicHealth: publicHealth(urls.onboarding),
      links: [
        link("Onboarding", urls.onboarding),
        link("Pilote Stripe intégré", appendPath(urls.onboarding, "/connect.html")),
        link("Planche de marque", localCompanionLink(urls.onboarding)),
      ],
    }),
    composeModule({
      id: "onboarding2",
      service: "onboarding2",
      label: "Onboarding2",
      description: "Variante Untitled UI de la vitrine et de l'embarquement.",
      group: "applications",
      ports: [8080],
      profiles: ["frontend-experiment"],
      publicHealth: publicHealth(appendPath(urls.onboarding, "/_experiments/untitled/")),
      links: [
        link(
          "Ouvrir la variante",
          appendPath(urls.onboarding, "/_experiments/untitled/"),
        ),
        link(
          "Créer avec la variante",
          appendPath(urls.onboarding, "/_experiments/untitled/creer"),
        ),
      ],
    }),
    composeModule({
      id: "docs",
      service: "docs",
      label: "Documentation",
      description: "Documentation Retype construite et servie par le cluster.",
      group: "tools",
      ports: [8080],
      publicHealth: publicHealth(urls.docs),
      links: [link("Documentation", urls.docs)],
    }),
    composeModule({
      id: "mailpit",
      service: "mailpit",
      label: "Mailpit",
      description: "Boîte email jetable pour les magic links.",
      group: "tools",
      ports: [1025, 8025],
      publicHealth: publicHealth(appendPath(urls.mailpit, "/readyz")),
      links: [link("Boîte de réception", urls.mailpit)],
    }),
    composeModule({
      id: "prometheus",
      service: "prometheus",
      label: "Prometheus",
      description: "Collecte interne des métriques opérationnelles du Backend.",
      group: "tools",
      ports: [9090],
      profiles: ["observability"],
      publicHealth: null,
      links: [],
    }),
    composeModule({
      id: "grafana",
      service: "grafana",
      label: "Grafana",
      description: "Tableau de bord local des métriques opérationnelles.",
      group: "tools",
      ports: [3000],
      profiles: ["observability"],
      publicHealth: publicHealth(appendPath(urls.grafana, "/api/health")),
      links: [link("Tableau de bord", urls.grafana)],
    }),
    composeModule({
      id: "postgresql",
      service: "postgresql",
      label: "PostgreSQL",
      description: "Base persistante du cluster local.",
      group: "dependencies",
      ports: [5432],
      publicHealth: null,
      links: [],
    }),
    reservedModule("app", "Application app", urls.app),
    reservedModule("admin", "Administration", urls.admin),
  ];

  assertRegistry(modules);
  return Object.freeze({
    modules: Object.freeze(modules),
    composeServices: Object.freeze(
      modules.filter((module) => module.kind === "compose").map((module) => module.composeService),
    ),
    composeServiceProfiles: Object.freeze(Object.fromEntries(
      modules
        .filter((module) => module.kind === "compose" && module.composeProfiles.length > 0)
        .map((module) => [module.composeService, module.composeProfiles]),
    )),
    presets: Object.freeze({
      core: Object.freeze(["postgresql", "mailpit", "backend", "commande", "dashboard"]),
      all: Object.freeze([
        "postgresql",
        "mailpit",
        "backend",
        "commande",
        "commande2",
        "dashboard",
        "dashboard2",
        "onboarding",
        "onboarding2",
        "docs",
        "prometheus",
        "grafana",
      ]),
    }),
    urlConfiguration: Object.freeze({
      source: developmentUrls.source,
      warnings: developmentUrls.warnings,
      cockpitUrl: urls.cockpit,
      reportsUrl: urls.reports,
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

function composeModule(definition) {
  return Object.freeze({
    id: definition.id,
    composeService: definition.service,
    label: definition.label,
    description: definition.description,
    group: definition.group,
    kind: "compose",
    controllable: definition.controllable ?? true,
    composeProfiles: Object.freeze(definition.profiles ?? []),
    ports: Object.freeze(definition.ports),
    publicHealth: definition.publicHealth,
    links: Object.freeze(definition.links),
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
  const composeServices = new Set();
  for (const module of modules) {
    if (!/^[a-z][a-z0-9-]*$/u.test(module.id) || ids.has(module.id)) {
      throw new Error(`Invalid or duplicate module id: ${module.id}`);
    }
    ids.add(module.id);
    if (module.kind === "compose") {
      if (
        !/^[a-z][a-z0-9-]*$/u.test(module.composeService) ||
        composeServices.has(module.composeService)
      ) {
        throw new Error(`Invalid or duplicate Compose service: ${module.composeService}`);
      }
      composeServices.add(module.composeService);
      if (
        module.composeProfiles.some(
          (profile, index) =>
            !/^[a-z0-9][a-z0-9_.-]*$/u.test(profile) ||
            module.composeProfiles.indexOf(profile) !== index,
        )
      ) {
        throw new Error(`Invalid or duplicate Compose profile for: ${module.id}`);
      }
    }
  }
}

export const EXPECTED_MODULE_IDS = Object.freeze([
  "edge",
  "backend",
  "commande",
  "commande2",
  "dashboard",
  "dashboard2",
  "onboarding",
  "onboarding2",
  "docs",
  "mailpit",
  "prometheus",
  "grafana",
  "postgresql",
  "app",
  "admin",
]);
