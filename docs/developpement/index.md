---
label: Développement
order: 30
icon: rocket
description: Prérequis, installation, commandes, ports et premier lancement de l'environnement de développement Surplasse.
---

# Démarrer

Cette page est le point d'entrée de la section développement : ce qu'il faut installer sur sa machine, comment cloner et lancer le monorepo, quelles commandes exécuter dans chaque répertoire et comment diagnostiquer les problèmes les plus fréquents. Pour comprendre ce que l'on fait tourner avant de le lancer, lire d'abord la [vue d'ensemble de l'architecture](../architecture/index.md).

!!! info État actuel
Depuis le 2026-07-18 (phase 1) existent : la documentation (`docs/`), la charte graphique (`brand/`), la landing statique de l'Onboarding, le contrat (`api/openapi.yaml`) avec son lint et sa chaîne de génération, le squelette du Backend (`backend/` : modules `common`, `contract`, `catalog`, `application`, migrations Flyway et seed de démonstration), le package partagé (`frontends/shared/`) et le front Commande (`frontends/commande/`). Dashboard et Onboarding applicatifs restent à créer ; cette page passe du statut de cible au réel au fur et à mesure. Cette page décrit la cible de référence, au présent de spécification, et elle est tenue à jour au fil des phases de la [roadmap](../roadmap.md) : à chaque application créée, la section correspondante passe de la cible au réel.
!!!

## Prérequis

L'environnement de développement repose sur des gestionnaires de versions (nvm, SDKMAN) plutôt que sur des installations système : ils permettent d'épingler exactement les versions de référence du projet et de cohabiter avec d'autres projets sur la même machine.

| Outil | Version | Installation recommandée (macOS) | Installation recommandée (Linux) |
|---|---|---|---|
| git | 2.40 ou plus | livré avec les Command Line Tools (`xcode-select --install`) | paquet de la distribution (`apt install git`, `dnf install git`) |
| Node.js | 24 | [nvm](https://github.com/nvm-sh/nvm) puis `nvm install 24` | nvm, identique |
| Java (JDK) | 21 (LTS) | [SDKMAN](https://sdkman.io/) puis `sdk install java 21.0.x-tem` (dernière 21 Temurin de `sdk list java`) | SDKMAN, identique |
| Maven | 3.9 ou plus | non requis : le wrapper `mvnw` est committé dans `backend/` | idem, le wrapper suffit |
| Docker | Docker Engine 27 ou plus | Docker Desktop ou [OrbStack](https://orbstack.dev/) | Docker Engine + plugin Compose (paquets officiels Docker) |
| Docker Compose | v2 (plugin `docker compose`) | inclus dans Docker Desktop et OrbStack | inclus dans les paquets officiels |
| Compte Stripe | mode test | création sur [stripe.com](https://stripe.com), aucune donnée bancaire réelle requise | identique |

Précisions :

- **Node 24 via nvm** : un fichier `.nvmrc` à la racine fixe la version. `nvm use` dans un terminal ouvert à la racine suffit à basculer.
- **Java 21 via SDKMAN** : la distribution Temurin (identifiant du type `21.0.x-tem`, listé par `sdk list java`) est la référence. Toute LTS 21 fonctionne, mais la CI utilise Temurin.
- **Maven** : ne jamais dépendre d'un Maven global. Toutes les commandes backend passent par `./mvnw`, qui télécharge la bonne version de Maven au premier appel.
- **Docker** : indispensable même sans travailler sur l'infra, car les Dev Services de Quarkus s'en servent pour démarrer PostgreSQL automatiquement en développement (voir [le premier lancement](#le-premier-lancement-pas-à-pas)).
- **Stripe en mode test** : les clés de test (`sk_test_...`, `pk_test_...`) suffisent pour tout le développement. Aucun paiement réel ne transite en local.

### Windows : passer par WSL2

Le tableau ci-dessus couvre macOS et Linux. Sous Windows, la référence est [WSL2](https://learn.microsoft.com/windows/wsl/) avec une distribution Ubuntu : cloner le repo dans le système de fichiers WSL2 et suivre la colonne Linux (nvm, SDKMAN, wrapper Maven), avec Docker Desktop configuré sur le backend WSL2. Le développement natif Windows, hors WSL2, n'est pas supporté : trop d'outils et de scripts supposent un shell POSIX.

Ce choix a un avantage : WSL2 avec Ubuntu, c'est le système de la production. Le VPS tourne sous Ubuntu LTS (voir [Exploitation](../operations/index.md)) ; en cas de comportement divergent entre macOS, Windows et Linux, c'est Ubuntu qui fait foi.

### Chaque nouveau module documente son lancement

!!! warning La règle vaut pour tout ajout
Tout ajout d'un module frontend, d'un module backend ou d'un logiciel tiers (PostgreSQL, MinIO, Caddy, ...) s'accompagne, dans le même commit, de la mise à jour de cette page : prérequis, installation et lancement sur macOS, Windows (WSL2) et Linux. Côté production (Ubuntu sur le VPS), l'équivalent vit dans les pages [Opérations](../operations/index.md).
!!!

## Installation

L'installation se fait en deux temps : l'outillage commun à la racine, puis les dépendances de chaque application dans son répertoire.

```bash
# 1. Cloner le monorepo
git clone git@github.com:nclsppr/surplasse.git
cd surplasse

# 2. Outillage racine (documentation Retype)
nvm use
npm install

# 3. Dépendances par application (au fil des besoins)
cd frontends/commande && npm install     # idem pour dashboard/ et onboarding/
cd backend && ./mvnw dependency:resolve  # optionnel, quarkus:dev le fait aussi
```

Le `npm install` racine n'installe que l'outillage de documentation (Retype). Les frontends ont chacun leur propre `package.json` et leurs propres dépendances : il n'y a pas de workspace npm global qui installerait tout d'un coup, chaque application reste installable et lançable indépendamment. Le package partagé `frontends/shared/` est consommé par les trois frontends via une dépendance `file:../shared` (lien symbolique npm, paquet consommé en source TypeScript), conformément à l'[ADR-0014](../decisions/adr-0014-liaison-shared.md).

## Commandes par répertoire

Chaque répertoire du monorepo expose un petit jeu de commandes stables. Les scripts npm des frontends portent les mêmes noms dans les trois applications : ce qui s'apprend sur Commande vaut pour Dashboard et Onboarding.

| Répertoire | Commande | Effet |
|---|---|---|
| racine | `npm run docs:watch` | serveur local de la documentation avec rechargement (port 5005) |
| racine | `npm run docs:build` | build de vérification des docs (sortie dans `docs-site/`), obligatoire avant tout push touchant `docs/` |
| `backend/` | `./mvnw quarkus:dev` | backend en mode dev : rechargement à chaud, Dev Services, Dev UI sur `/q/dev-ui` |
| `backend/` | `./mvnw test` | tests unitaires et d'intégration du backend |
| `backend/` | `./mvnw package` | build du déployable |
| `frontends/*/` | `npm run dev` | serveur Vite avec rechargement à chaud |
| `frontends/*/` | `npm run build` | build de production (vérification TypeScript incluse) |
| `frontends/*/` | `npm run test` | tests du frontend |

Le détail des conventions par pile est dans les pages dédiées : [conventions React](conventions-react.md), [conventions Quarkus](conventions-quarkus.md), [conventions API et contrat](conventions-api.md). La stratégie de test complète est décrite dans [tests](tests.md).

## Ports conventionnels

Chaque application a son port fixe en développement, pour que les URL locales soient stables et que les configurations (CORS, URL de base API) n'aient jamais à deviner.

| Port | Application | URL locale |
|---|---|---|
| 8080 | Backend (API Quarkus) | `http://localhost:8080` |
| 5432 | PostgreSQL (conteneur monté par les Dev Services, port fixé via `quarkus.datasource.devservices.port` dans le profil `%dev`) | `localhost:5432` |
| 5173 | Commande | `http://localhost:5173` |
| 5174 | Dashboard | `http://localhost:5174` |
| 5175 | Onboarding | `http://localhost:5175` |
| 5005 | Documentation (Retype) | `http://localhost:5005` |

Les ports 5173 à 5175 suivent l'ordre alphabétique des noms d'applications (Commande, Dashboard, Onboarding) et la convention Vite : 5173 est le port par défaut, les deux autres sont fixés dans le `vite.config.ts` de chaque frontend. Un port déjà occupé fait échouer le lancement plutôt que de glisser silencieusement vers un port voisin (option `strictPort` activée), pour que les URL locales restent prévisibles.

## Variables d'environnement

Le principe : chaque application committe un fichier `.env.example` listant toutes ses variables avec des valeurs factices et un commentaire par variable. Le fichier `.env` réel est ignoré par git. Prendre un nouveau poste en main se résume à copier l'exemple et remplir les vraies valeurs :

```bash
cp .env.example .env   # dans chaque application concernée
```

En développement, la liste des variables réellement obligatoires est courte : les Dev Services fournissent PostgreSQL sans configuration, et les URL locales ont des valeurs par défaut. Les variables principales prévues :

| Variable | Application | Rôle | Requise en dev |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Backend | clé secrète Stripe (mode test en dev : `sk_test_...`) | oui, pour les parcours de paiement |
| `STRIPE_WEBHOOK_SECRET` | Backend | signature des webhooks Stripe (fournie par la CLI Stripe en local) | oui, pour les webhooks |
| `OPENAI_API_KEY` | Backend | clé API OpenAI pour l'extraction de carte depuis photo | oui, pour l'embarquement |
| `QUARKUS_DATASOURCE_JDBC_URL` | Backend | DSN PostgreSQL | non en dev (Dev Services), oui en production |
| `VITE_API_BASE_URL` | chaque frontend | URL de base de l'API | non (défaut : `http://localhost:8080`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Commande | clé publique Stripe pour le paiement côté client (`pk_test_...`) | oui, pour payer |

!!! warning Jamais de secret dans git
Les clés réelles (même les clés Stripe de test) ne sont jamais committées : ni dans un `.env`, ni dans un fichier de config, ni dans un exemple. Le `.env.example` ne contient que des valeurs factices de la forme `sk_test_xxx`. En production, les secrets sont injectés par l'environnement Docker Compose du VPS, voir [operations](../operations/).
!!!

## Le premier lancement, pas à pas

Le scénario nominal du premier lancement traverse la moitié du système : backend, base de données, migrations et front Commande. Le voici raconté dans l'ordre.

**1. Démarrer Docker.** Vérifier que le démon tourne (`docker info` répond sans erreur). C'est le seul prérequis silencieux de l'étape suivante.

**2. Lancer le backend en mode dev.**

```bash
cd backend
./mvnw quarkus:dev
```

Au premier appel, le wrapper télécharge Maven puis les dépendances : compter quelques minutes. Ensuite, les Dev Services de Quarkus détectent qu'aucune base n'est configurée en dev et montent tout seuls un conteneur PostgreSQL 17, exposé sur le port 5432 (par défaut, les Dev Services publient le conteneur sur un port aléatoire : la clé `quarkus.datasource.devservices.port=5432` du profil `%dev` le fixe pour respecter les ports conventionnels). Flyway applique alors les migrations, y compris le jeu de données de démonstration : un établissement fictif complet (carte, produits, options) prévu pour le développement. Quand le terminal affiche la bannière Quarkus et « Listening on: http://0.0.0.0:8080 », l'API est prête. La Dev UI est disponible sur `http://localhost:8080/q/dev-ui`.

**3. Lancer le front Commande.**

```bash
cd frontends/commande
npm install    # au premier lancement seulement
npm run dev
```

Vite démarre sur `http://localhost:5173` et consomme l'API locale via la valeur par défaut de `VITE_API_BASE_URL`.

**4. Ouvrir l'établissement de démonstration.** En production, Commande résout l'établissement depuis le sous-domaine (`{slug}.surplasse.com`). En développement, le slug vient de la variable `VITE_ESTABLISHMENT_SLUG`, avec l'établissement de démonstration (`le-cormoran`) par défaut (mécanisme fixé dans [conventions React](conventions-react.md)). Ouvrir `http://localhost:5173` dans le navigateur : la carte du Cormoran s'affiche. Le panier et le paiement arrivent avec la phase 2 (les clés Stripe de test permettront alors un paiement fictif avec `4242 4242 4242 4242`).

À ce stade, l'environnement est fonctionnel. Dashboard et Onboarding se lancent de la même façon depuis leurs répertoires respectifs, sur les ports 5174 et 5175. Avant de committer quoi que ce soit, lire le [workflow git](workflow-git.md) : branche unique `main`, commits fréquents, build docs obligatoire avant tout push touchant `docs/`.

## Résolution des problèmes courants

| Symptôme | Cause probable | Remède |
|---|---|---|
| `Port 8080 already in use` (ou 5173, 5432...) | un autre processus occupe le port conventionnel | identifier le processus (`lsof -i :8080`) et l'arrêter ; ne pas changer le port de l'application |
| erreurs de build frontend étranges, syntaxe non reconnue | mauvaise version de Node active | `node -v` doit afficher 24 ; sinon `nvm use` à la racine du repo |
| `release version 21 not supported` ou erreur de compilation Java | mauvais JDK actif | `java -version` doit afficher 21 ; sinon `sdk use java 21-tem` |
| les Dev Services échouent, `Could not connect to Docker` | le démon Docker n'est pas démarré | lancer Docker Desktop ou OrbStack, vérifier avec `docker info`, relancer `./mvnw quarkus:dev` |
| `docs:watch` ou `docs:build` échoue, binaire `retype` introuvable dans `.bin` | le lien `node_modules/.bin/retype` n'a pas été créé par npm | appeler Retype directement : `node node_modules/retypeapp/retype.js watch` (ou `build`) ; c'est d'ailleurs la forme utilisée par les scripts npm du `package.json` racine |
| le front affiche des erreurs réseau vers l'API | le backend n'est pas lancé, ou `VITE_API_BASE_URL` pointe ailleurs | vérifier que `http://localhost:8080/q/health` répond, vérifier le `.env` du frontend |
| le paiement de test échoue immédiatement | clés Stripe absentes ou mélange de clés (test côté back, autre compte côté front) | vérifier `STRIPE_SECRET_KEY` et `VITE_STRIPE_PUBLISHABLE_KEY` : même compte, toutes deux en mode test |

Si un problème sort de ce tableau, deux réflexes : la Dev UI de Quarkus (`/q/dev-ui`) pour tout ce qui touche au backend et aux Dev Services, et les logs du terminal Vite pour les frontends.

## Pour aller plus loin

| Page | Contenu |
|---|---|
| [Workflow git](workflow-git.md) | branche unique, format des messages de commit, vérifications avant push |
| [Conventions React](conventions-react.md) | structure des frontends, TypeScript strict, TanStack Query, package `shared/` |
| [Conventions Quarkus](conventions-quarkus.md) | modules Maven, Panache, Flyway, conventions de code backend |
| [Conventions API et contrat](conventions-api.md) | le contrat OpenAPI, génération des clients TS et des interfaces Java |
| [Tests](tests.md) | pyramide de tests, outillage par pile, ce qui est testé et à quel niveau |
| [CI/CD](ci-cd.md) | pipelines GitHub Actions, build, publication des docs, déploiement VPS |
| [Vue d'ensemble de l'architecture](../architecture/index.md) | ce que ces commandes font tourner, et pourquoi c'est découpé ainsi |
