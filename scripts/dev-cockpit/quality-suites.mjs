import { resolve } from "node:path";

export function createQualitySuites(repoRoot) {
  return Object.freeze([
    suite({
      id: "backend-integration",
      label: "Backend intégré",
      description: "Compile le Backend et exécute ses tests unitaires, d'intégration et de contrat.",
      hint: "Cette vérification s'exécute hors des conteneurs et ne modifie pas le cluster.",
      commands: [command("Vérification Maven", "npm", ["run", "backend:verify"], repoRoot)],
    }),
    suite({
      id: "frontend-contracts",
      label: "Frontends et contrat",
      description: "Vérifie le socle partagé, Commande et le Dashboard, jusqu'aux builds de production.",
      hint: "Les dépendances npm des trois packages doivent déjà être installées.",
      commands: [
        command("Contrat OpenAPI", "npm", ["run", "api:lint"], repoRoot),
        command("Types du socle partagé", "npm", ["--prefix", "frontends/shared", "run", "check"], repoRoot),
        command("Tests du socle partagé", "npm", ["--prefix", "frontends/shared", "test"], repoRoot),
        command("Commande", "npm", ["--prefix", "frontends/commande", "run", "lint"], repoRoot),
        command("Tests de Commande", "npm", ["--prefix", "frontends/commande", "test"], repoRoot),
        command("Build de Commande", "npm", ["--prefix", "frontends/commande", "run", "build"], repoRoot),
        command("Dashboard", "npm", ["--prefix", "frontends/dashboard", "run", "lint"], repoRoot),
        command("Tests du Dashboard", "npm", ["--prefix", "frontends/dashboard", "test"], repoRoot),
        command("Build du Dashboard", "npm", ["--prefix", "frontends/dashboard", "run", "build"], repoRoot),
      ],
    }),
    suite({
      id: "local-platform",
      label: "Plateforme locale",
      description: "Contrôle les domaines, le cockpit et la frontière CORS derrière le proxy local.",
      hint: "Docker doit être démarré pour le contrôle CORS.",
      commands: [
        command("Profils de domaines", "npm", ["run", "domains:test"], repoRoot),
        command("Configuration générée", "npm", ["run", "domains:check"], repoRoot),
        command("Cockpit", "npm", ["run", "local:cockpit:test"], repoRoot),
        command("Frontière CORS", "npm", ["run", "local:cors:test"], repoRoot),
      ],
    }),
    suite({
      id: "e2e-development",
      label: "Parcours Playwright",
      description: "Rejoue les smokes Chromium sur le cluster development et publie le rapport Allure 3.",
      hint: "Caddy, Backend, Commande, Dashboard et Onboarding doivent être sains dans Docker Compose.",
      commands: [
        command("Smokes Playwright et rapport Allure 3", "npm", ["run", "e2e:test", "--", "development"], repoRoot),
      ],
    }),
  ]);
}

function suite(definition) {
  return Object.freeze({
    ...definition,
    commands: Object.freeze(definition.commands),
  });
}

function command(label, executable, args, cwd) {
  return Object.freeze({
    label,
    executable,
    args: Object.freeze(args),
    cwd: resolve(cwd),
  });
}
