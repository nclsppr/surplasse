---
label: Développement
order: 30
icon: rocket
description: Prérequis, installation, commandes, ports et premier lancement de l'environnement de développement Surplasse.
---

# Démarrer

Cette page est le point d'entrée de la section développement : ce qu'il faut installer sur sa machine, comment cloner et lancer le monorepo, quelles commandes exécuter dans chaque répertoire et comment diagnostiquer les problèmes les plus fréquents. Pour comprendre ce que l'on fait tourner avant de le lancer, lire d'abord la [vue d'ensemble de l'architecture](../architecture/index.md).

!!! info État actuel
Au 2026-07-19, existent : la documentation (`docs/`), la charte graphique (`brand/`), la préfiguration statique de l'Onboarding, le contrat (`api/openapi.yaml`) avec son lint et sa chaîne de génération, le Backend (`backend/` : modules `common`, `contract`, `catalog`, `order`, `payment`, `identity`, `application`), le package partagé (`frontends/shared/`), Commande (`frontends/commande/`) avec carte, panier, paiement et suivi, et le premier Dashboard (`frontends/dashboard/`). Ce Dashboard permet la connexion par magic link, restaure la session, sélectionne un établissement autorisé et lit ses commandes opérationnelles par REST. Il reste en lecture seule, sans flux SSE établissement. L'Onboarding React reste à créer. La page distingue toujours ce qui est exécutable de ce qui est seulement prévu.
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
| Stripe CLI | version courante | `brew install stripe/stripe-cli/stripe` | installation `apt` officielle décrite par [Stripe](https://docs.stripe.com/stripe-cli/install?locale=fr-FR) |
| Python | 3.x | `brew install python` | paquet `python3` de la distribution |

Précisions :

- **Node 24 via nvm** : un fichier `.nvmrc` à la racine fixe la version. `nvm use` dans un terminal ouvert à la racine suffit à basculer.
- **Java 21 via SDKMAN** : la distribution Temurin (identifiant du type `21.0.x-tem`, listé par `sdk list java`) est la référence. Toute LTS 21 fonctionne, mais la CI utilise Temurin.
- **Maven** : ne jamais dépendre d'un Maven global. Toutes les commandes backend passent par `./mvnw`, qui télécharge la bonne version de Maven au premier appel.
- **Docker** : indispensable même sans travailler sur l'infra, car les Dev Services de Quarkus s'en servent pour démarrer PostgreSQL automatiquement en développement (voir [le premier lancement](#le-premier-lancement-pas-à-pas)).
- **Stripe en mode test** : les clés de test (`sk_test_...`, `pk_test_...`) suffisent pour tout le développement. Aucun paiement réel ne transite en local.
- **Stripe CLI** : elle sert uniquement au développement pour relayer et rejouer les webhooks. Sous Windows, l'installation `apt` se fait dans WSL2. La CLI est absente de la production.
- **Python 3** : il ne sert qu'à prévisualiser les pages statiques de l'Onboarding et de la marque. Il n'entre ni dans les builds ni en production.
- **Bash, `curl` et `tar`** : présents par défaut sur macOS, Linux et WSL2, ils servent au contrôle de compatibilité OpenAPI. Ce sont uniquement des outils de build et de CI.

### Windows : passer par WSL2

Le tableau ci-dessus couvre macOS et Linux. Sous Windows, la référence est [WSL2](https://learn.microsoft.com/windows/wsl/) avec une distribution Ubuntu : cloner le repo dans le système de fichiers WSL2 et suivre la colonne Linux (nvm, SDKMAN, wrapper Maven), avec Docker Desktop configuré sur le backend WSL2. Le développement natif Windows, hors WSL2, n'est pas supporté : trop d'outils et de scripts supposent un shell POSIX.

Ce choix a un avantage : WSL2 avec Ubuntu, c'est le système de la production. Le VPS tourne sous Ubuntu LTS (voir [Exploitation](../operations/index.md)) ; en cas de comportement divergent entre macOS, Windows et Linux, c'est Ubuntu qui fait foi.

### Chaque nouveau module documente son lancement

!!! warning La règle vaut pour tout ajout
Tout ajout d'un module frontend, d'un module backend, d'un package ou d'un logiciel tiers (PostgreSQL, MinIO, Caddy, ...) met à jour cette page dans le même commit. La contribution indique son rôle, son état réel, sa catégorie d'exécution, sa version ou son image épinglée, ses dépendances, ses variables et volumes, ses prérequis, sa configuration, son lancement, son arrêt et sa vérification sur macOS, Windows (WSL2) et Linux.

La catégorie d'exécution est obligatoire : développement seulement, build ou CI, ou service de production. Un module bibliothèque précise qu'il n'a pas de processus autonome et donne sa commande de vérification. Un service destiné à la production met aussi à jour les pages [Opérations](../operations/index.md) avec son déploiement et son exploitation sous Ubuntu LTS. Un outil absent de la production le dit explicitement et nomme, si nécessaire, son équivalent de production.
!!!

## Installation

L'installation se fait en deux temps : l'outillage commun à la racine, puis les dépendances de chaque application dans son répertoire.

```bash
# 1. Clone the monorepo
git clone git@github.com:nclsppr/surplasse.git
cd surplasse

# 2. Install root tooling for documentation and the OpenAPI contract
nvm use
npm ci

# 3. Install current component dependencies from the repository root
(cd frontends/shared && npm ci)           # source package, no standalone server
(cd frontends/commande && npm ci)         # Commande application
(cd frontends/dashboard && npm ci)        # Dashboard application
(cd backend && ./mvnw dependency:resolve) # optional, quarkus:dev resolves them too
```

Le `npm ci` racine installe Retype, Spectral et OpenAPI Generator. Les frontends ont chacun leur propre `package.json` et leurs propres dépendances : il n'y a pas de workspace npm global. Le package partagé `frontends/shared/` est consommé en source via une dépendance `file:../shared`, conformément à l'[ADR-0014](../decisions/adr-0014-liaison-shared.md). Il faut donc installer `shared` avant de vérifier Commande ou le Dashboard. L'Onboarding actuel est statique et n'a pas encore de dépendances npm.

## Cycle de vie des composants actuels

| Composant | Nature et lancement local | Destination |
|---|---|---|
| `docs/` | Retype, `npm run docs:watch` à la racine | Build CI publié sur GitHub Pages, absent du VPS applicatif |
| `brand/` | Ressources statiques ; prévisualisation avec le serveur statique décrit plus bas | Intégré aux fronts et au site Pages, aucun processus autonome |
| `api/openapi.yaml` | Contrat vérifié par `npm run api:lint` et généré par `npm run api:generate` | Artefact de build ; copie exposée par le Backend, aucun service autonome |
| `backend/common` | Bibliothèque Maven ; `./mvnw -pl common -am test` | Embarquée dans le Backend, aucun conteneur distinct |
| `backend/contract` | Sources générées ; `npm run api:generate`, puis build Maven | Embarqué dans le Backend et consommé au build, aucun conteneur distinct |
| `backend/catalog`, `backend/order`, `backend/payment` | Modules métier ; `./mvnw -pl <module> -am test` | Embarqués dans le Backend, aucun conteneur distinct |
| `backend/identity` | Module métier des restaurateurs, magic links et sessions ; `./mvnw -pl identity -am test` | Embarqué dans le Backend, sans processus, port ni conteneur distinct |
| `backend/application` | Assemblage exécutable ; `./mvnw quarkus:dev` depuis `backend/` | Service Backend Quarkus en production |
| `frontends/shared` | Bibliothèque TypeScript ; `npm run check` et `npm test`, aucun serveur | Compilée dans les frontends, aucun conteneur distinct |
| `frontends/commande` | Application Vite ; `npm run dev` | Front statique Commande en production |
| `frontends/onboarding` | Préfiguration HTML statique ; aucun package npm actuellement | Publiée avec GitHub Pages aujourd'hui, futur front statique Onboarding sur le VPS |
| `frontends/dashboard` | Application Vite ; `npm run dev`, port strict 5174 | Exécutable localement, non déployée ; cible statique sur `dashboard.surplasse.com` |

## Cycle de vie des logiciels tiers

| Logiciel | Développement et tests | Production |
|---|---|---|
| PostgreSQL 17 | Requis. Démarré automatiquement par les Dev Services et Testcontainers, aucune installation serveur locale | Requis. Service persistant de la future pile Docker Compose, sauvegardé quotidiennement |
| Mailpit `axllent/mailpit:v1.30.4` | Développement seulement. Capture les emails du module `identity` sur les ports loopback 1025 et 8025, sans volume persistant | Absent de la CI et de la production. Un fournisseur SMTP transactionnel prendra le relais |
| Stripe CLI | Développement seulement, pour relayer et rejouer les webhooks | Absente. Stripe appelle directement le webhook public du Backend |
| Stripe | Compte et clés de test | Service SaaS requis avec comptes Connect et clés live |
| Retype | Prévisualisation locale et build CI | Aucun processus Retype. Le résultat statique est publié sur GitHub Pages |
| MinIO | Prévu avec le domaine `generation`, pas encore installé | Futur service persistant de la pile Docker Compose |
| Caddy | Inutile au développement quotidien ; prévu pour reproduire la topologie complète | Futur reverse proxy de la pile Docker Compose |

### Dépendances d'exécution du Dashboard

Le verrou exact des versions vit dans `frontends/dashboard/package-lock.json`. Leur catégorie d'exécution est la suivante :

| Dépendance | Version de référence | Catégorie | Sort en production |
|---|---|---|---|
| React et React DOM | 19 | Bibliothèques applicatives | Oui, intégrées au JavaScript statique produit par Vite ; aucun processus autonome |
| React Router | 7 | Bibliothèque applicative | Oui, intégrée au JavaScript statique |
| TanStack Query | 5 | Bibliothèque applicative | Oui, intégrée au JavaScript statique |
| `frontends/shared` | version du même commit | Paquet source interne | Oui, compilé dans le Dashboard ; aucun paquet ni conteneur séparé |
| Polices auto-hébergées de `brand/fonts/` et wordmark `brand/logo.svg` | version du même commit | Assets de marque au build | Oui, intégrés aux fichiers statiques ; aucune requête vers un CDN |
| Node.js | 24 | Développement, build et CI | Non, absent du serveur statique une fois les fichiers construits |
| Vite et son plugin React | 6 | Développement, build et CI | Non, absents du processus de production |
| Tailwind CSS et son plugin Vite | 4 | Développement et build | Non, seules les feuilles de style produites sont livrées |
| TypeScript | 5 | Build et CI | Non |
| ESLint et ses plugins | 9 | Développement et CI | Non |
| Vitest | 3 | Développement et CI | Non |

Après `npm run build`, le résultat est un dossier `dist/` statique. Il ne conserve aucune donnée, ne monte aucun volume et ne possède aucun processus Node. En local, seul le serveur Vite écoute sur 5174 pendant `npm run dev`.

## Commandes par répertoire

Chaque composant expose un petit jeu de commandes stables. Une ligne « vérification » remplace la commande de lancement pour les bibliothèques qui n'ont pas de processus autonome.

| Répertoire | Commande | Effet |
|---|---|---|
| racine | `npm run docs:watch` | serveur local de la documentation avec rechargement (port 5005) |
| racine | `npm run docs:build` | build de vérification des docs (sortie dans `docs-site/`), obligatoire avant tout push touchant `docs/` |
| racine | `npm run api:lint` | lint Spectral du contrat |
| racine | `npm run api:generate` | régénération des interfaces Java, du client TypeScript et de la copie Swagger UI |
| racine | `npm run api:diff` | contrôle de compatibilité du contrat par rapport à la révision de référence |
| `backend/` | `./mvnw quarkus:dev` | backend en mode dev : rechargement à chaud, Dev Services, Dev UI sur `/q/dev-ui` |
| `backend/` | `./mvnw test` | tests unitaires et d'intégration du backend |
| `backend/` | `./mvnw package` | build du déployable |
| `backend/` | `./mvnw -pl order -am test` | exemple de vérification d'un module et de ses dépendances, sans le lancer seul |
| `backend/` | `./mvnw -pl identity -am test` | tests du module `identity` et de ses dépendances, sans processus autonome |
| `frontends/shared/` | `npm run check && npm test` | typecheck et tests de la bibliothèque, sans serveur |
| `frontends/commande/` | `npm run dev` | serveur Vite de Commande avec rechargement à chaud |
| `frontends/commande/` | `npm run lint && npm test && npm run build` | vérification complète de Commande |
| `frontends/dashboard/` | `npm run dev` | serveur Vite du Dashboard avec rechargement à chaud, port strict 5174 |
| `frontends/dashboard/` | `npm run lint && npm test && npm run build` | vérification complète du Dashboard |
| racine | `python3 -m http.server 4173` | prévisualisation statique de l'Onboarding et de la marque |

Pour la prévisualisation statique, ouvrir `http://localhost:4173/frontends/onboarding/` ou `http://localhost:4173/brand/board.html`. La commande est identique sous macOS, Linux et Windows via WSL2. L'arrêter avec `Ctrl+C`.

Le détail des conventions par pile est dans les pages dédiées : [conventions React](conventions-react.md), [conventions Quarkus](conventions-quarkus.md), [conventions API et contrat](conventions-api.md). La stratégie de test complète est décrite dans [tests](tests.md).

### Cycle de vie du module `identity`

`identity` est une bibliothèque Maven embarquée dans `application`. Elle n'a aucun exécutable, processus, port ou conteneur propre. Sur macOS, Linux et Windows via WSL2, les commandes sont identiques et se lancent depuis `backend/` :

```bash
# Résoudre le module et ses dépendances
./mvnw -pl identity -am dependency:resolve

# Tester le module et ses dépendances
./mvnw -pl identity -am test

# Lancer l'assemblage Backend qui embarque identity
./mvnw quarkus:dev
```

Le Backend répond alors sur le port 8080. Avec Mailpit démarré, la vérification fonctionnelle minimale demande un lien au compte de démonstration et contrôle la réponse 202 :

```bash
curl --include \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"email":"pilote@le-cormoran.example"}' \
  http://localhost:8080/v1/auth/magic-links
```

Le message apparaît dans `http://localhost:8025`. `Ctrl+C` arrête le Backend et donc le module. `docker stop surplasse-mailpit` arrête séparément la capture SMTP. En cas de différence entre plateformes, le comportement sous Ubuntu LTS fait foi.

### Cycle de vie du Dashboard

Le Dashboard est une application Vite. Les mêmes commandes sont supportées sur macOS, Linux et Windows via WSL2. Le développement Windows natif reste exclu. Il dépend du Backend pour les sessions et les commandes, de Mailpit pour lire les magic links locaux et de `frontends/shared/` au build. Il ne crée aucune base, donnée persistante ni volume.

Depuis la racine du dépôt, installer les dépendances et créer la configuration locale :

```bash
(cd frontends/shared && npm ci)
cd frontends/dashboard
npm ci
cp .env.example .env
```

Le fichier d'exemple fixe `VITE_API_BASE_URL=http://localhost:8080`. Cette variable est publique et injectée au build. Elle ne contient jamais de secret.

Dans trois terminaux, lancer Mailpit, le Backend puis le Dashboard :

```bash
# Terminal 1, from the repository root
docker run --detach --rm \
  --name surplasse-mailpit \
  --publish 127.0.0.1:1025:1025 \
  --publish 127.0.0.1:8025:8025 \
  axllent/mailpit:v1.30.4
curl --fail http://localhost:8025/readyz
```

```bash
# Terminal 2
cd backend
./mvnw quarkus:dev
```

```bash
# Terminal 3
cd frontends/dashboard
npm run dev
```

Vérifier d'abord les deux services :

```bash
curl --fail http://localhost:8080/q/health/ready
curl --fail http://localhost:5174/
```

Ouvrir ensuite `http://localhost:5174/auth/login`, demander un lien pour `pilote@le-cormoran.example`, puis ouvrir `http://localhost:8025`. Le lien transporte le jeton dans le fragment `#token=...` : ce fragment n'est pas envoyé au serveur Vite, et le Dashboard le retire immédiatement de la barre d'adresse avant l'échange par POST. Après connexion, `/service` affiche en lecture seule les commandes opérationnelles de l'établissement autorisé.

Ne pas mélanger les noms d'hôte en local. Avec l'API configurée sur `http://localhost:8080`, ouvrir le Dashboard sur `http://localhost:5174`, pas sur `http://127.0.0.1:5174`. `localhost` et `127.0.0.1` ne forment pas le même site pour les cookies `SameSite`, même si les deux adresses visent la machine locale.

La vérification complète du module se lance sans Backend ni Mailpit :

```bash
cd frontends/dashboard
npm run lint
npm test
npm run build
```

Arrêter les deux processus interactifs avec `Ctrl+C`, puis arrêter Mailpit avec `docker stop surplasse-mailpit`. Le conteneur Mailpit utilise `--rm` et aucun volume : son arrêt supprime les messages capturés. Le dossier `dist/` peut être supprimé et reconstruit à volonté ; il ne contient aucune donnée utilisateur.

## Ports conventionnels

Chaque application a son port fixe en développement, pour que les URL locales soient stables et que les configurations (CORS, URL de base API) n'aient jamais à deviner.

| Port | Application | URL locale |
|---|---|---|
| 8080 | Backend (API Quarkus) | `http://localhost:8080` |
| 5432 | PostgreSQL (conteneur monté par les Dev Services, port fixé via `quarkus.datasource.devservices.port` dans le profil `%dev`) | `localhost:5432` |
| 5173 | Commande | `http://localhost:5173` |
| 5174 | Dashboard | `http://localhost:5174` |
| 5175 | Onboarding React, à sa création | `http://localhost:5175` |
| 5005 | Documentation (Retype) | `http://localhost:5005` |
| 4173 | Prévisualisation statique actuelle | `http://localhost:4173` |
| 1025 | Mailpit SMTP, publié sur l'interface loopback seulement | `localhost:1025` |
| 8025 | Mailpit, interface web et sonde de santé, publié sur l'interface loopback seulement | `http://localhost:8025` |

Les ports 5173 à 5175 suivent l'ordre alphabétique des noms d'applications (Commande, Dashboard, Onboarding). Commande et le Dashboard fixent déjà leur port avec `strictPort` dans leur `vite.config.ts`. Le port 5175 reste réservé à l'Onboarding React. Un port occupé doit faire échouer le lancement plutôt que de glisser silencieusement vers un port voisin.

## Variables d'environnement

Le principe : chaque application committe un fichier `.env.example` listant toutes ses variables avec des valeurs factices et un commentaire par variable. Le fichier `.env` réel est ignoré par git. Les composants actuels se configurent depuis la racine avec :

```bash
cp backend/.env.example backend/.env
cp frontends/commande/.env.example frontends/commande/.env
cp frontends/dashboard/.env.example frontends/dashboard/.env
```

En développement, la liste des variables réellement obligatoires est courte : les Dev Services fournissent PostgreSQL sans configuration, et les URL locales ont des valeurs par défaut. Les variables principales prévues :

| Variable | Application | Rôle | Requise en dev |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Backend | clé secrète Stripe (mode test en dev : `sk_test_...`) | oui, pour les parcours de paiement |
| `STRIPE_WEBHOOK_SECRET` | Backend | signature des webhooks Stripe (fournie par la CLI Stripe en local) | oui, pour les webhooks |
| `OPENAI_API_KEY` | Backend | future clé API OpenAI pour le domaine `generation`, absent actuellement | non, future phase 3 |
| `QUARKUS_DATASOURCE_JDBC_URL` | Backend | DSN PostgreSQL | non en dev (Dev Services), oui en production |
| `AUTH_MAGIC_LINK_LANDING_URL` | Backend | URL de la page Dashboard qui échange le magic link | non (défaut local : `http://localhost:5174/auth/magic-link`) |
| `AUTH_SECURE_COOKIES` | Backend | active l'attribut `Secure` sur les cookies restaurateur | non, `false` en HTTP local ; obligatoire à `true` en production |
| `AUTH_JWT_ISSUER` | Backend | émetteur attendu du JWT restaurateur | non, valeur locale fournie |
| `AUTH_JWT_AUDIENCE` | Backend | audience attendue du JWT restaurateur | non, valeur locale fournie |
| `VITE_API_BASE_URL` | chaque frontend | URL de base de l'API | non (défaut : `http://localhost:8080`) |
| `VITE_ESTABLISHMENT_SLUG` | Commande | slug utilisé sur localhost, sans sous-domaine | non (défaut : `le-cormoran`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Commande | clé publique Stripe pour le paiement côté client (`pk_test_...`) | oui, pour payer |

En `%dev` et `%test`, Quarkus génère les clés JWT de travail : aucune clé privée n'est à créer ni à conserver. Le profil `%dev` joint Mailpit sur `localhost:1025`, sans authentification ni TLS. Les variables `AUTH_JWT_PRIVATE_KEY_PATH`, `AUTH_JWT_KEY_ID`, `AUTH_JWT_JWKS_PATH` et `SMTP_*` sont réservées à la production et détaillées dans [Environnements](../operations/environnements.md#backend-quarkus).

!!! warning Jamais de secret dans git
Les clés réelles (même les clés Stripe de test) ne sont jamais committées : ni dans un `.env`, ni dans un fichier de config, ni dans un exemple. Le `.env.example` ne contient que des valeurs factices de la forme `sk_test_xxx`. En production, les secrets sont injectés par l'environnement Docker Compose du VPS, voir [operations](../operations/).
!!!

## Le premier lancement, pas à pas

Le scénario nominal du premier lancement traverse la moitié du système : Backend, base de données, migrations, Commande et Dashboard. Le voici raconté dans l'ordre.

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
npm ci         # si les dépendances n'ont pas encore été installées
npm run dev
```

Vite démarre sur `http://localhost:5173` et consomme l'API locale via la valeur par défaut de `VITE_API_BASE_URL`.

**3 bis. Capturer les magic links en local, si le parcours d'identité est testé.** Démarrer Mailpit avant de demander un lien. L'image est épinglée et les deux ports ne sont publiés que sur l'interface loopback :

```bash
docker run --detach --rm \
  --name surplasse-mailpit \
  --publish 127.0.0.1:1025:1025 \
  --publish 127.0.0.1:8025:8025 \
  axllent/mailpit:v1.30.4

curl --fail http://localhost:8025/readyz
```

Ouvrir ensuite `http://localhost:8025` pour lire le message. L'arrêt est explicite et supprime le conteneur jetable :

```bash
docker stop surplasse-mailpit
```

Ces commandes sont l'installation et le cycle de vie complet de Mailpit sur macOS, Linux et Windows via WSL2. Docker télécharge l'image au premier lancement. Aucun volume n'est monté : fermer le conteneur efface les messages capturés. Mailpit n'est utilisé ni en CI, où le mailer Quarkus est simulé, ni en production. Il ne faut jamais y envoyer une adresse ou un message réel.

**3 ter. Les webhooks Stripe en local.** Le passage d'une commande à « payée » ne vient que du webhook signé. En local, la CLI Stripe les relaie (connexion au compte Stripe requise, une fois) :

```bash
stripe listen --forward-to localhost:8080/v1/webhooks/stripe
# copier le whsec_... affiché dans STRIPE_WEBHOOK_SECRET du .env backend
```

Le fichier `.env` du Backend vit dans `backend/.env`, à côté de `backend/.env.example`, puisque les commandes Maven sont lancées depuis `backend/`. Les fichiers de Commande et du Dashboard vivent dans leur répertoire respectif, à côté de leur `.env.example`.

**4. Ouvrir l'établissement de démonstration.** En production, Commande résout l'établissement depuis le sous-domaine (`{slug}.surplasse.com`). En développement, le slug vient de la variable `VITE_ESTABLISHMENT_SLUG`, avec l'établissement de démonstration (`le-cormoran`) par défaut. Ouvrir `http://localhost:5173/?table=tbl_2f8e6a4c0b9d7e1f` : la carte du Cormoran s'affiche et le code de la Table 4 ouvre une session anonyme. Le panier, le paiement Stripe de test et le suivi sont disponibles. La carte de test standard est `4242 4242 4242 4242`.

**5. Lancer le Dashboard.** Avec Mailpit et le Backend encore actifs, lancer `npm run dev` dans `frontends/dashboard/`, puis ouvrir `http://localhost:5174/auth/login`. Demander le magic link du compte `pilote@le-cormoran.example`, l'ouvrir depuis `http://localhost:8025`, puis vérifier la liste REST sur `/service`. Le Dashboard ne modifie pas encore les commandes et n'ouvre pas encore de flux SSE établissement.

À ce stade, le Backend, Commande et le premier Dashboard sont fonctionnels localement. La préfiguration de l'Onboarding se consulte avec le serveur statique sur le port 4173 ; elle ne possède pas encore de serveur Vite. Avant de committer quoi que ce soit, lire le [workflow git](workflow-git.md) : branche unique `main`, commits fréquents, build docs obligatoire avant tout push touchant `docs/`.

## Résolution des problèmes courants

| Symptôme | Cause probable | Remède |
|---|---|---|
| `Port 8080 already in use` (ou 5173, 5432...) | un autre processus occupe le port conventionnel | identifier le processus (`lsof -i :8080`) et l'arrêter ; ne pas changer le port de l'application |
| erreurs de build frontend étranges, syntaxe non reconnue | mauvaise version de Node active | `node -v` doit afficher 24 ; sinon `nvm use` à la racine du repo |
| `OpenAPI generation requires JDK 21`, `release version 21 not supported` ou erreur de compilation Java | JDK absent ou mauvaise version active | `java -version` doit afficher 21 ; relever la dernière Temurin 21 avec `sdk list java`, puis exécuter `sdk install java <identifiant>` et `sdk use java <identifiant>` |
| les Dev Services échouent, `Could not connect to Docker` | le démon Docker n'est pas démarré | lancer Docker Desktop ou OrbStack, vérifier avec `docker info`, relancer `./mvnw quarkus:dev` |
| `docs:watch` ou `docs:build` échoue, binaire `retype` introuvable dans `.bin` | le lien `node_modules/.bin/retype` n'a pas été créé par npm | appeler Retype directement : `node node_modules/retypeapp/retype.js start --port 5005` (ou `build`) ; c'est d'ailleurs la forme utilisée par les scripts npm du `package.json` racine |
| le front affiche des erreurs réseau vers l'API | le backend n'est pas lancé, ou `VITE_API_BASE_URL` pointe ailleurs | vérifier que `http://localhost:8080/q/health` répond, vérifier le `.env` du frontend |
| le Dashboard revient à la connexion après le magic link | le Dashboard a été ouvert sur `127.0.0.1` alors que l'API et le lien utilisent `localhost`, donc le cookie `SameSite` n'est pas envoyé | ouvrir `http://localhost:5174` et conserver `VITE_API_BASE_URL=http://localhost:8080` ; ne pas mélanger les deux noms d'hôte |
| le paiement de test échoue immédiatement | clés Stripe absentes ou mélange de clés (test côté back, autre compte côté front) | vérifier `STRIPE_SECRET_KEY` et `VITE_STRIPE_PUBLISHABLE_KEY` : même compte, toutes deux en mode test |
| `./mvnw verify` échoue à charger des classes de test alors qu'elles compilent | `quarkus:dev` tourne sur le même workspace : les deux écrivent dans `target/` | arrêter le mode dev avant `verify` (ou inversement), puis relancer |

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
