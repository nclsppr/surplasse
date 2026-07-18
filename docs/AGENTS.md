# AGENTS.md : conventions et terminologie canonique

Ce fichier est la source de vérité pour toute contribution à la documentation et au code de Surplasse. Il est exclu du build Retype (voir `retype.yml`). Toute page de documentation doit respecter la terminologie, la stack et le style définis ici. En cas de contradiction entre une page et ce fichier, ce fichier gagne, et la page doit être corrigée.

## Le produit en bref

Surplasse permet aux restaurants indépendants de créer leur propre canal de commande directe, sans projet informatique. À partir du nom de l'établissement, d'une photo de la carte et de quelques images, Surplasse génère un mini-site élégant, une carte numérique structurée, un système de commande et des paiements intégrés. Le client scanne un QR code à table, commande et paie depuis son téléphone, sans application ni compte. La commande arrive en temps réel côté restaurant.

Positionnement : Surplasse n'est pas une marketplace. Le restaurant garde son identité, ses prix, ses clients et sa relation client. Slogan : « Le circuit court de la commande. »

## Terminologie canonique

| Terme | Définition | À ne pas confondre avec |
|---|---|---|
| **Restaurateur** | Le professionnel qui gère un établissement sur Surplasse | « marchand », « commerçant », « utilisateur pro » |
| **Client** | Le convive qui consulte la carte et commande | « consommateur », « utilisateur final », « guest » |
| **Établissement** | Le restaurant en tant qu'entité (un restaurateur peut en avoir plusieurs) | « boutique », « point de vente » |
| **La carte** | Le menu du restaurant (catégories, produits, options, prix) | « le menu » est acceptable, « catalogue » non |
| **Produit** | Un plat, une boisson ou tout article commandable | « article », « item » |
| **Option** | Une variante ou un supplément d'un produit (cuisson, taille, extra) | « modifier », « add-on » |
| **Commande** | L'acte d'achat d'un client (sur place ou à emporter) | « panier » désigne l'état avant validation |
| **Mini-site** | La vitrine web publique générée pour un établissement | « site », « page » |
| **Espace** | L'espace pré-généré d'un établissement identifié en ligne, à revendiquer | « fiche », « listing » |
| **Revendication** | L'acte par lequel un restaurateur prend possession de son espace pré-généré | « claim » (réservé au code) |
| **Embarquement** | Le parcours de création d'un établissement (photo de la carte, génération, activation) | « onboarding » est acceptable dans le code |
| **Le contrat** | Le fichier OpenAPI, source de vérité de l'API | « le swagger », « la spec » |

## Les applications

Quatre applications, un backend, un contrat :

| Nom canonique | Répertoire cible | Domaine | Rôle |
|---|---|---|---|
| **Onboarding** | `frontends/onboarding/` | `surplasse.com` | Vitrine produit et tunnel d'embarquement des restaurateurs |
| **Commande** | `frontends/commande/` | `{slug}.surplasse.com` | Mini-site de l'établissement, carte numérique, commande et paiement client |
| **Dashboard** | `frontends/dashboard/` | `dashboard.surplasse.com` | Suivi des commandes en temps réel, gestion de la carte, métriques et analyse |
| **Backend** | `backend/` | `api.surplasse.com` | API REST Quarkus, logique métier, persistance, intégrations |

Le contrat OpenAPI vit dans `api/openapi.yaml`. Il est la source de vérité : le backend l'implémente, les frontends consomment des clients TypeScript générés depuis lui.

## Stack de référence

| Couche | Choix | Version de référence | Notes |
|---|---|---|---|
| Backend | Quarkus | 3.x (dernière LTS) | Java 21 (LTS), Maven multi-modules |
| ORM | Hibernate ORM avec Panache | livré par Quarkus | Repository pattern |
| Base de données | PostgreSQL | 17 | Une seule base, schémas par domaine si besoin |
| Migrations | Flyway | livré par Quarkus | Migrations versionnées, jamais de DDL manuel |
| Temps réel | SSE (Server-Sent Events) | natif Quarkus | WebSockets envisagé plus tard si besoin bidirectionnel |
| Frontends | React | 19 | TypeScript strict, Vite, un package partagé `frontends/shared/` |
| État serveur | TanStack Query | 5 | Pas de Redux |
| Contrat | OpenAPI | 3.1 | Contract-first, générateurs de clients TS et d'interfaces Java |
| Paiement | Stripe | API courante | CB, Apple Pay, Google Pay ; PayPal en roadmap |
| Auth restaurateur | Magic link par email | MVP | Le client final n'a jamais de compte |
| IA | API Claude (vision) | modèles courants | Extraction de carte depuis photo, enrichissement de données publiques |
| Impression | Imprimante thermique ESC/POS | à trancher (ADR) | Tickets cuisine optionnels |
| Docs | Retype | 4.6+ | Ce site ; déployé sur GitHub Pages |
| CI/CD | GitHub Actions | | Déploiement cible : VPS avec Docker Compose |
| Node | 24 | via nvm | Pour l'outillage frontend et docs |

Toute décision structurante est consignée dans un ADR sous `docs/decisions/`. Si une page contredit un ADR, l'ADR gagne.

## Arborescence cible du monorepo

```
surplasse/
├── docs/                    # Documentation Retype (ce site)
├── api/
│   └── openapi.yaml         # Le contrat, source de vérité de l'API
├── backend/                 # Quarkus (Maven multi-modules)
├── frontends/
│   ├── shared/              # Design system, client API généré, utilitaires
│   ├── onboarding/          # surplasse.com
│   ├── commande/            # {slug}.surplasse.com
│   └── dashboard/           # dashboard.surplasse.com
├── infra/                   # Docker Compose, configuration VPS
└── .github/workflows/       # CI/CD
```

Seuls `docs/` et la configuration racine existent aujourd'hui. Le reste est créé au fil de la roadmap.

## Arborescence de la documentation

```
docs/
├── README.md                        # Accueil : carte de la documentation
├── produit/                         # Vision, personas, fonctionnalités, parcours
│   └── parcours/                    # Les trois parcours détaillés
├── architecture/                    # Vue d'ensemble, frontends, backend, API, données, intégrations, sécurité
├── developpement/                   # Setup, conventions React/Quarkus/API, git, tests, CI/CD
├── operations/                      # Environnements, observabilité, RGPD
├── decisions/                       # ADR numérotés (adr-NNNN-titre.md)
├── roadmap.md
├── glossaire.md
└── AGENTS.md                        # Ce fichier (exclu du build)
```

## Style rédactionnel

- **Langue : français.** Les identifiants de code, noms de fichiers et termes techniques consacrés restent en anglais (`contract-first`, `magic link`, `slug`).
- **Jamais de cadratin ni de demi-cadratin** (les tirets longs). Utiliser deux-points, virgules, parenthèses ou une nouvelle phrase.
- Guillemets français « avec espaces » pour les citations et les libellés d'interface.
- Ton sobre, précis, direct. Pas d'emphase marketing dans la documentation technique (la page vision est la seule exception, elle assume le ton produit).
- Phrases courtes. Une idée par paragraphe. Tableaux pour les faits énumérables, prose pour les explications.
- Dates en toutes lettres ou au format AAAA-MM-JJ. Jamais de date relative (« récemment », « bientôt »).

## Conventions Retype

- Front matter YAML en tête de chaque page : `label` (titre court pour la sidebar), `order` (entier, tri croissant), `icon` (nom Octicon, optionnel), `description` (une phrase, pour le SEO).
- Chaque dossier a un `index.yml` (`label`, `order`, `expanded`) et, s'il a un contenu propre, un `index.md`.
- Liens internes en chemins relatifs vers les fichiers `.md` (`../architecture/api.md`).
- Composants Retype autorisés : callouts (`!!! info`, `!!! warning`), onglets (`+++`), accordéons (`==-`), badges. Ne pas en abuser : un callout par section maximum.
- Diagrammes en ASCII dans des blocs de code (Retype ne rend pas mermaid). Les garder simples et alignés.
- Pas d'images tant qu'il n'y a pas de produit à montrer.

## Workflow git

- **Branche unique `main`, pas de PR** : on committe et on pousse directement, le plus souvent possible (une unité de travail vérifiée = un commit poussé).
- Messages de commit en français, impératif, préfixés par le périmètre : `docs:`, `api:`, `backend:`, `front(commande):`, `infra:`, `ci:`.
- Le build docs doit passer avant tout push touchant `docs/` : `npm run docs:build`.

## Build et prévisualisation des docs

```bash
npm install          # une fois
npm run docs:build   # build de vérification (sortie dans docs-site/)
npm run docs:watch   # serveur local avec rechargement
```

Le déploiement est automatique : chaque push sur `main` publie la doc sur GitHub Pages via `.github/workflows/docs.yml`.
