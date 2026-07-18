---
label: CI/CD
order: 70
icon: workflow
description: "Intégration et déploiement continus : le garde-fou du workflow sans PR, les workflows GitHub Actions et le déploiement sur le VPS."
---

# CI/CD

Surplasse s'appuie sur GitHub Actions pour l'intégration continue et le déploiement. Cette page décrit le seul workflow existant aujourd'hui (le build et le déploiement de la documentation), puis la cible : les workflows de vérification par application, la construction des images Docker et le déploiement sur le VPS.

Pour le détail des environnements et de la topologie de production, voir [Environnements](../operations/environnements.md) et [Exploitation](../operations/index.md).

## Philosophie

Le [workflow git](workflow-git.md) de Surplasse est volontairement minimal : une branche unique `main`, pas de pull request, des commits poussés le plus souvent possible. Ce choix supprime toute la mécanique de revue asynchrone, inutile pour un développeur seul, mais il supprime aussi le filet de sécurité qu'une PR apporte d'ordinaire.

La CI est ce filet. Elle repose sur deux principes :

1. **Chaque push sur `main` est potentiellement déployable.** Il n'existe pas de branche d'intégration ni de fenêtre de release : ce qui est sur `main` est ce qui part en production. La discipline de commit (une unité de travail vérifiée = un commit poussé) est la première ligne de défense, la CI est la seconde.
2. **La CI est le garde-fou du workflow sans PR.** Tout ce qu'une revue humaine attraperait mécaniquement (build cassé, test rouge, contrat OpenAPI incompatible) doit être attrapé par un workflow. Un push qui casse la CI se corrige immédiatement, par un commit de correction ou un revert, avant toute autre tâche.

!!! info Vérifier avant de pousser
La CI ne remplace pas la vérification locale, elle la confirme. Les commandes exécutées par les workflows (build, lint, [tests](tests.md)) sont les mêmes que celles lancées en local : un push ne devrait jamais découvrir un problème que le poste de travail pouvait détecter.
!!!

## Le workflow Pages

Le fichier `.github/workflows/pages.yml` construit le site Retype, l'assemble avec la landing statique (`frontends/onboarding/`) et les assets de marque (`brand/`), et déploie l'ensemble sur GitHub Pages.

| Élément | Valeur |
|---|---|
| Déclencheurs | `push` sur `main`, plus déclenchement manuel (`workflow_dispatch`) |
| Permissions | `contents: read`, `pages: write`, `id-token: write` |
| Concurrence | Groupe `pages`, avec annulation des exécutions en cours (`cancel-in-progress`) |
| Jobs | `build` puis `deploy` (ce dernier conditionné à `main`) |

Le job `build` enchaîne cinq étapes : checkout (`actions/checkout@v4`), installation de Node 24 (`actions/setup-node@v4`), `npm ci`, `npm run docs:build`, puis l'assemblage du site publié (landing et tunnel statiques à la racine, assets de marque sous `brand/`, documentation Retype sous `docs/`). Le script npm invoque `node node_modules/retypeapp/retype.js` directement plutôt que la commande `retype` : npm 10.9.x ne crée pas le lien `node_modules/.bin/retype` à l'installation, à cause d'une collision de noms de bin avec les paquets plateforme `retypeapp-*`. Le site assemblé est publié comme artefact Pages via `actions/upload-pages-artifact@v3`.

Le job `deploy` dépend de `build`, ne s'exécute que si la référence est `refs/heads/main`, cible l'environnement GitHub `github-pages` et publie l'artefact avec `actions/deploy-pages@v4`.

Ce workflow tourne aujourd'hui à chaque push, quel que soit le contenu du commit. Il recevra un filtre de chemins sur son périmètre comme les autres workflows ci-dessous.

## Les workflows

Le monorepo suit un découpage par filtres de chemins (`paths`) : un push qui ne touche que `frontends/commande/` ne doit pas déclencher les tests du backend. `api.yml`, `backend.yml` et `frontends.yml` existent depuis la phase 1 ; `images.yml` et `deploy.yml` seront créés avec `infra/`.

| Workflow | Déclencheur (filtre de chemins) | Étapes |
|---|---|---|
| `pages.yml` | `push` sur `main` (filtre de chemins à venir) | Build Retype, assemblage du site public (docs, landing, marque), déploiement GitHub Pages (décrit ci-dessus) |
| `api.yml` | `push`, chemins `api/**`, `openapitools.json`, `scripts/api/**` | Lint Spectral, contrôle de compatibilité `oasdiff` contre le commit précédent (dérogation par préfixe de commit `api!:`), fraîcheur de la génération (`npm run api:generate` puis `git diff --exit-code`) |
| `backend.yml` | `push`, chemins `backend/**`, `api/**` | Java 21 Temurin, cache Maven, `./mvnw -B verify` : compilation, tests unitaires et d'intégration (PostgreSQL 17 via Testcontainers, réponses validées contre le contrat), formatage Spotless |
| `frontends.yml` | `push`, chemins `frontends/**`, `api/**` (un job par paquet : `shared`, `commande` aujourd'hui, les autres fronts à leur création) | Node 24, `npm ci`, ESLint, `tsc --noEmit`, tests Vitest, build Vite |
| `images.yml` (cible) | `push` sur `main`, chemins `backend/**`, `frontends/**`, `infra/**` | Build des images Docker (backend et les trois fronts), tag par SHA de commit, push vers le registre (GHCR) |
| `deploy.yml` (cible) | Fin réussie de `images.yml` sur `main`, ou déclenchement manuel avec un SHA en paramètre | Connexion SSH au VPS, `docker compose pull`, `docker compose up -d`, healthcheck post-déploiement |

L'enchaînement sur un push touchant du code applicatif se lit ainsi :

```
push sur main
     |
     +--> filtres de chemins
     |         |
     |         +--> backend.yml     (si backend/ ou api/ touchés)
     |         +--> frontends.yml   (si frontends/ ou api/ touchés)
     |         +--> api.yml         (si api/ touché)
     |         +--> pages.yml       (si docs/ ou brand/ touchés)
     |
     +--> images.yml  (si backend/, frontends/ ou infra/ touchés)
                |
                +--> deploy.yml  (si images.yml réussit)
```

Les workflows de vérification et la construction des images tournent en parallèle : un test rouge n'empêche pas mécaniquement la construction d'une image, mais `deploy.yml` ne part que si `images.yml` a réussi, et la discipline de correction immédiate (voir la philosophie ci-dessus) fait le reste. Rendre le déploiement dépendant de tous les workflows de vérification est une évolution possible, à trancher quand les workflows existeront.

Deux règles transversales :

- **Le contrat d'abord.** Toute modification de `api/openapi.yaml` passe par `api.yml` avant que backend ou frontends ne consomment la nouvelle version. Une rupture de compatibilité détectée par `oasdiff` fait échouer le workflow ; elle n'est acceptée que si elle est assumée et documentée (voir [le contrat](../architecture/api.md)).
- **Des images immuables.** Une image est construite une seule fois, taggée par le SHA du commit qui l'a produite, et n'est jamais reconstruite ni re-taggée. Déployer, c'est choisir un SHA ; revenir en arrière, c'est en choisir un autre.

## Le déploiement cible

Le déploiement vise le VPS unique décrit dans [Exploitation](../operations/index.md). Le workflow `deploy.yml` procède ainsi :

```
GitHub Actions                                VPS
     |                                         |
     |-- (1) ssh (clé dédiée au déploiement) ->|
     |                                         |-- (2) export TAG=<sha>
     |                                         |-- (3) docker compose pull
     |                                         |-- (4) docker compose up -d
     |<- (5) healthcheck : curl /q/health -----|
     |                                         |
     |-- (6) échec ? redéployer le tag         |
     |        précédent (rollback)             |
```

1. **Connexion SSH.** Le runner GitHub Actions se connecte au VPS avec une clé SSH dédiée au déploiement, restreinte à un utilisateur non privilégié membre du groupe Docker. La clé privée est un secret de CI, la clé publique est provisionnée sur le VPS.
2. **Sélection du tag.** Le SHA à déployer est exporté comme variable pour Docker Compose. Les fichiers Compose vivent dans `infra/` et référencent les images par `${TAG}`.
3. **`docker compose pull`** récupère les images taggées depuis GHCR.
4. **`docker compose up -d`** recrée uniquement les conteneurs dont l'image a changé.
5. **Healthcheck post-déploiement.** Le workflow interroge l'endpoint de santé du backend (`/q/health`, fourni par SmallRye Health) et la page d'accueil de chaque front, avec quelques tentatives espacées le temps du démarrage de Quarkus. Un healthcheck rouge fait échouer le workflow et déclenche une alerte (voir [Observabilité](../operations/observabilite.md)).
6. **Rollback.** Revenir en arrière consiste à relancer `deploy.yml` manuellement avec le SHA du dernier déploiement sain en paramètre. Aucune reconstruction n'est nécessaire : l'image précédente existe toujours dans le registre. Les migrations Flyway étant additives par convention (voir [Backend](../architecture/backend.md)), un rollback applicatif n'exige pas de rollback de schéma.

!!! warning Migrations et rollback
Le rollback redéploie le code, pas la base. Une migration Flyway qui supprime ou renomme une colonne casserait la version précédente du backend. La convention est donc : les migrations destructives sont découpées en deux déploiements (d'abord le code qui n'utilise plus la colonne, puis la migration qui la supprime).
!!!

## Les secrets de CI

Les secrets sont portés par les GitHub Environments, pas par des secrets de dépôt globaux. L'environnement `production` est associé au job de déploiement ; ses secrets ne sont exposés qu'aux exécutions sur `main`.

| Secret | Environnement | Usage |
|---|---|---|
| `VPS_HOST` | `production` | Adresse du VPS |
| `VPS_USER` | `production` | Utilisateur de déploiement (non privilégié) |
| `VPS_SSH_KEY` | `production` | Clé privée SSH dédiée au déploiement |

Le push vers GHCR utilise le `GITHUB_TOKEN` éphémère du workflow, aucun secret supplémentaire n'est requis. Les secrets applicatifs (Stripe, API OpenAI, base de données) ne transitent jamais par la CI : ils vivent dans le fichier d'environnement du VPS, décrit dans [Environnements](../operations/environnements.md). La CI sait déployer, elle ne sait pas ce que l'application déploie.

Cette séparation borne le rayon d'action d'une compromission : un secret de CI qui fuite donne au pire un accès SSH restreint au compte de déploiement, pas les clés Stripe live. Elle simplifie aussi la rotation : changer une clé applicative se fait sur le VPS et se prend en compte au redémarrage du service concerné, sans toucher à GitHub.

## Pas de staging, et c'est assumé

Il n'y a que deux environnements : le poste de développement local et la production (voir [Environnements](../operations/environnements.md)). Aucun environnement de staging n'est prévu au lancement, pour trois raisons :

- **Le coût de la pièce mobile.** Un staging est un deuxième VPS (ou une deuxième pile Compose) à maintenir, sauvegarder, superviser et garder synchrone. Pour un développeur seul, ce coût d'entretien dépasse le bénéfice tant que le trafic est faible.
- **La fidélité illusoire.** Un staging sans données réelles, sans trafic réel et sans webhooks Stripe live ne reproduit pas la production ; il donne surtout une fausse confiance. Le mode dev local de Quarkus, les Dev Services et Stripe en mode test couvrent déjà l'essentiel de ce qu'un staging vérifierait.
- **Le déploiement est réversible.** Images immuables taggées par SHA, rollback en une relance de workflow, migrations additives : le coût d'un déploiement raté est borné et court.

Quand une fonctionnalité est trop risquée pour partir directement en production, la réponse est un feature flag léger : une variable de configuration lue au démarrage, qui masque la fonctionnalité tant qu'elle n'est pas prête. Pas de plateforme de feature flags dédiée à ce stade ; une entrée de configuration par flag suffit.

Ce qui reste à trancher :

- Le seuil (trafic, chiffre d'affaires, nombre d'établissements actifs) au-delà duquel un environnement de staging redeviendrait pertinent.
- L'outillage exact du lint backend (outil de formatage seul ou analyse statique en plus) ; la décision sera consignée en ADR si elle est structurante.
