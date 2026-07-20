---
label: Développement
order: 30
icon: rocket
description: Prérequis, installation, commandes, ports et premier lancement de l'environnement de développement Surplasse.
---

# Démarrer

Cette page est le point d'entrée de la section développement : ce qu'il faut installer sur sa machine, comment cloner et lancer le monorepo, quelles commandes exécuter dans chaque répertoire et comment diagnostiquer les problèmes les plus fréquents. Pour comprendre ce que l'on fait tourner avant de le lancer, lire d'abord la [vue d'ensemble de l'architecture](../architecture/index.md).

!!! info État actuel
Au 2026-07-19, existent : la documentation (`docs/`), la charte graphique (`brand/`), la préfiguration statique de l'Onboarding, le contrat (`api/openapi.yaml`) avec son lint et sa chaîne de génération, le Backend (`backend/` : modules `common`, `contract`, `catalog`, `order`, `payment`, `identity`, `application`), le package partagé (`frontends/shared/`), Commande (`frontends/commande/`) avec carte, panier, paiement et suivi, et le Dashboard minimal (`frontends/dashboard/`). Ce Dashboard permet la connexion par magic link, restaure la session, sélectionne un établissement autorisé, lit ses commandes opérationnelles par REST, les fait avancer jusqu'au service ou au retrait et actualise la file par SSE. L'Onboarding React reste à créer. La page distingue toujours ce qui est exécutable de ce qui est seulement prévu.
!!!

!!! info URL locales canoniques
Le navigateur utilise désormais exclusivement `https://surplasse.test` et ses sous-domaines. Les ports `localhost` restent des destinations internes et des outils de diagnostic. L'installation, la liste permanente des URL et le cockpit de modules sont détaillés dans [Domaines locaux](domaines-locaux.md).
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
| Python | 3.x, assets de marque seulement | `brew install python` | paquets `python3` et `python3-venv` de la distribution |
| dnsmasq | version Homebrew courante | installé par `npm run local:setup` | installation et intégration `systemd-resolved` manuelles |
| mkcert | 1.4.x ou plus | installé par `npm run local:setup` | binaire officiel et paquet `libnss3-tools` |
| Caddy | 2.x | installé par `npm run local:setup` | paquet officiel Caddy |

Précisions :

- **Node 24 via nvm** : un fichier `.nvmrc` à la racine fixe la version. `nvm use` dans un terminal ouvert à la racine suffit à basculer.
- **Java 21 via SDKMAN** : la distribution Temurin (identifiant du type `21.0.x-tem`, listé par `sdk list java`) est la référence. Toute LTS 21 fonctionne, mais la CI utilise Temurin.
- **Maven** : ne jamais dépendre d'un Maven global. Toutes les commandes backend passent par `./mvnw`, qui télécharge la bonne version de Maven au premier appel.
- **Docker** : indispensable même sans travailler sur l'infra, car les Dev Services de Quarkus s'en servent pour démarrer PostgreSQL automatiquement en développement (voir [le premier lancement](#le-premier-lancement-pas-à-pas)).
- **Stripe en mode test** : les clés de test (`sk_test_...`, `pk_test_...`) suffisent pour tout le développement. Aucun paiement réel ne transite en local.
- **Stripe CLI** : elle sert uniquement au développement pour relayer et rejouer les webhooks. Sous Windows, l'installation `apt` se fait dans WSL2. La CLI est absente de la production.
- **Python 3** : il sert seulement à générer et vérifier les QR de marque avec `scripts/requirements.txt`. C'est un outil de développement et de CI, absent de l'exécution applicative et de la production.
- **dnsmasq et mkcert** : développement seulement. dnsmasq fournit le wildcard local et mkcert le certificat approuvé par le poste. Ils sont absents de la production.
- **Caddy** : reverse proxy local et futur reverse proxy de production, mais avec deux configurations distinctes. Le local utilise mkcert ; la production cible Let's Encrypt par défi DNS-01.
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
| `backend/common` | Bibliothèque Maven ; `scripts/run-with-domain-profile.sh development ./backend/mvnw -f backend/pom.xml -pl common -am test` | Embarquée dans le Backend, aucun conteneur distinct |
| `backend/contract` | Sources générées ; `npm run api:generate`, puis build Maven | Embarqué dans le Backend et consommé au build, aucun conteneur distinct |
| `backend/catalog`, `backend/order`, `backend/payment` | Modules métier ; `scripts/run-with-domain-profile.sh development ./backend/mvnw -f backend/pom.xml -pl <module> -am test` | Embarqués dans le Backend, aucun conteneur distinct |
| `backend/identity` | Module métier des restaurateurs, magic links et sessions ; `scripts/run-with-domain-profile.sh development ./backend/mvnw -f backend/pom.xml -pl identity -am test` | Embarqué dans le Backend, sans processus, port ni conteneur distinct |
| `backend/application` | Assemblage exécutable ; `npm run backend:dev` depuis la racine | Service Backend Quarkus en production |
| `frontends/shared` | Bibliothèque TypeScript ; `npm run check` et `npm test`, aucun serveur | Compilée dans les frontends, aucun conteneur distinct |
| `frontends/commande` | Application Vite ; `npm run dev` | Front statique Commande en production |
| `frontends/onboarding` | Préfiguration HTML statique ; aucun package npm actuellement | Publiée avec GitHub Pages aujourd'hui, futur front statique Onboarding sur le VPS |
| `frontends/dashboard` | Application Vite ; `npm run dev`, port strict 5174 | Exécutable localement, non déployée ; cible statique sur `dashboard.surplasse.com` |
| `scripts/dev-cockpit` | Serveur Node sans dépendance ; `npm run local:cockpit`, port 4174 | Développement seulement, absent des builds et de la production |
| `infra/local` | Caddyfile et scripts de DNS et TLS local | Développement seulement ; la production recevra sa propre configuration Caddy |

## Cycle de vie des logiciels tiers

| Logiciel | Développement et tests | Production |
|---|---|---|
| PostgreSQL 17 | Requis. Démarré automatiquement par les Dev Services et Testcontainers, aucune installation serveur locale | Requis. Service persistant de la future pile Docker Compose, sauvegardé quotidiennement |
| Mailpit `axllent/mailpit:v1.30.4` | Développement seulement. Capture les emails du module `identity` sur les ports loopback 1025 et 8025, sans volume persistant | Absent de la CI et de la production. Un fournisseur SMTP transactionnel prendra le relais |
| Stripe CLI | Développement seulement, pour relayer et rejouer les webhooks | Absente. Stripe appelle directement le webhook public du Backend |
| Stripe | Compte et clés de test | Service SaaS requis avec comptes Connect et clés live |
| Retype | Prévisualisation locale et build CI | Aucun processus Retype. Le résultat statique est publié sur GitHub Pages |
| MinIO | Prévu avec le domaine `generation`, pas encore installé | Futur service persistant de la pile Docker Compose |
| dnsmasq | Requis pour le wildcard `*.surplasse.test`, instance locale sans donnée | Absent ; le fournisseur DNS public porte l'apex et le wildcard `.com` |
| mkcert | Requis pour le certificat local approuvé, sans donnée applicative | Absent ; Let's Encrypt fournit le certificat public |
| Caddy | Requis localement pour HTTPS et le routage par hostname | Futur reverse proxy de la pile Docker Compose, avec configuration et cycle de vie Ubuntu distincts |

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
| racine | `npm run local:setup` | installation idempotente du DNS wildcard et du certificat sur macOS |
| racine | `npm run local:proxy` | validation puis démarrage ou rechargement de Caddy |
| racine | `npm run local:cockpit` | cockpit local et contrôle des modules, port 4174 |
| racine | `npm run local:cockpit:test` | tests isolés du cockpit, sans lancer de module |
| racine | `npm run backend:dev` | Backend en mode dev avec profil central injecté, rechargement à chaud, Dev Services et Dev UI |
| racine | `npm run backend:verify` | compilation, tests et package Backend avec le profil central injecté |
| racine | `scripts/run-with-domain-profile.sh development ./backend/mvnw -f backend/pom.xml -pl order -am test` | exemple de vérification ciblée avec le même profil |
| racine | `scripts/run-with-domain-profile.sh development ./backend/mvnw -f backend/pom.xml -pl identity -am test` | tests du module `identity`, sans processus autonome |
| `frontends/shared/` | `npm run check && npm test` | typecheck et tests de la bibliothèque, sans serveur |
| `frontends/commande/` | `npm run dev` | serveur Vite de Commande avec rechargement à chaud |
| `frontends/commande/` | `npm run lint && npm test && npm run build` | vérification complète de Commande |
| `frontends/dashboard/` | `npm run dev` | serveur Vite du Dashboard avec rechargement à chaud, port strict 5174 |
| `frontends/dashboard/` | `npm run lint && npm test && npm run build` | vérification complète du Dashboard |
| racine | `node scripts/dev-cockpit/onboarding-server.mjs` | serveur statique allowlisté de l'Onboarding et de la marque, port 4173 |

Pour la prévisualisation statique, ouvrir `https://surplasse.test` ou `https://surplasse.test/brand/board.html` après avoir lancé Caddy et l'Onboarding depuis le cockpit. Le serveur Node ne sert que les fichiers publics explicitement autorisés : `.certs/`, les fichiers d'environnement et le reste du dépôt restent inaccessibles même par le port 4173. L'arrêter avec `Ctrl+C` dans son terminal ou avec le bouton du cockpit s'il en est propriétaire.

Le détail des conventions par pile est dans les pages dédiées : [conventions React](conventions-react.md), [conventions Quarkus](conventions-quarkus.md), [conventions API et contrat](conventions-api.md). La stratégie de test complète est décrite dans [tests](tests.md).

### Cycle de vie du module `identity`

`identity` est une bibliothèque Maven embarquée dans `application`. Elle n'a aucun exécutable, processus, port ou conteneur propre. Sur macOS, Linux et Windows via WSL2, les commandes sont identiques et se lancent depuis la racine afin que le profil public soit injecté :

```bash
# Resolve the module and its dependencies
./backend/mvnw -f backend/pom.xml -pl identity -am dependency:resolve

# Test the module and its dependencies
scripts/run-with-domain-profile.sh development \
  ./backend/mvnw -f backend/pom.xml -pl identity -am test

# Start the Backend assembly that embeds identity
npm run backend:dev
```

Le Backend répond alors sur le port 8080. Avec Mailpit démarré, la vérification fonctionnelle minimale demande un lien au compte de démonstration et contrôle la réponse 202 :

```bash
curl --include \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"email":"pilote@le-cormoran.example"}' \
  https://api.surplasse.test/v1/auth/magic-links
```

Le message apparaît dans `https://mail.surplasse.test`. `Ctrl+C` arrête le Backend et donc le module s'il a été lancé dans ce terminal. Le bouton du cockpit arrête le Backend ou Mailpit seulement s'il les a démarrés. En cas de différence entre plateformes, le comportement sous Ubuntu LTS fait foi.

### Cycle de vie du Dashboard

Le Dashboard est une application Vite. Les mêmes commandes sont supportées sur macOS, Linux et Windows via WSL2. Le développement Windows natif reste exclu. Il dépend du Backend pour les sessions et les commandes, de Mailpit pour lire les magic links locaux et de `frontends/shared/` au build. Il ne crée aucune base, donnée persistante ni volume.

Depuis la racine du dépôt, installer les dépendances. Les domaines viennent du profil central, aucun `.env` frontend n'est requis pour le parcours nominal :

```bash
(cd frontends/shared && npm ci)
cd frontends/dashboard
npm ci
```

Le fichier `.env.example` ne documente que des overrides exceptionnels. Le mode Vite sélectionne `config/domains/development.env` et le build sélectionne `config/domains/production.env`.

Dans trois terminaux, lancer Mailpit, le Backend puis le Dashboard :

```bash
# Terminal 1, from the repository root
docker run --detach --rm \
  --name surplasse-mailpit \
  --publish 127.0.0.1:1025:1025 \
  --publish 127.0.0.1:8025:8025 \
  axllent/mailpit:v1.30.4
curl --fail http://127.0.0.1:8025/readyz
```

```bash
# Terminal 2, from the repository root
npm run backend:dev
```

```bash
# Terminal 3
cd frontends/dashboard
npm run dev
```

Vérifier d'abord les deux services :

```bash
curl --fail https://api.surplasse.test/q/health/ready
curl --fail https://dashboard.surplasse.test/
```

Ouvrir ensuite `https://dashboard.surplasse.test/auth/login`, demander un lien pour `pilote@le-cormoran.example`, puis ouvrir `https://mail.surplasse.test`. Le lien transporte le jeton dans le fragment `#token=...` : ce fragment n'est pas envoyé au serveur Vite, et le Dashboard le retire immédiatement de la barre d'adresse avant l'échange par POST. Après connexion, `/service` affiche les commandes opérationnelles de l'établissement autorisé. Les actions permettent de les accepter, de lancer leur préparation, de les marquer prêtes, puis servies ou retirées selon leur type.

Ne pas revenir aux ports HTTP dans le navigateur. Le couple canonique est `https://dashboard.surplasse.test` et `https://api.surplasse.test`. Il exerce les cookies `Secure`, le CORS, le hostname et les en-têtes de proxy comme la production.

La vérification complète du module se lance sans Backend ni Mailpit :

```bash
cd frontends/dashboard
npm run lint
npm test
npm run build
```

Arrêter les deux processus interactifs avec `Ctrl+C`, puis arrêter Mailpit avec `docker stop surplasse-mailpit`. Le conteneur Mailpit utilise `--rm` et aucun volume : son arrêt supprime les messages capturés. Le dossier `dist/` peut être supprimé et reconstruit à volonté ; il ne contient aucune donnée utilisateur.

## Ports conventionnels

Chaque processus conserve un port interne fixe, mais le navigateur passe par Caddy et les URL HTTPS de `surplasse.test`. Cette séparation stabilise les sondes et le routage sans exposer les particularités de port au code applicatif.

| Port interne | Application | URL navigateur canonique |
|---|---|---|
| 443 | Caddy | toutes les URL `https://*.surplasse.test` |
| 8080 | Backend (API Quarkus) | `https://api.surplasse.test` |
| 5432 | PostgreSQL (conteneur monté par les Dev Services, port fixé via `quarkus.datasource.devservices.port` dans le profil `%dev`) | `localhost:5432` |
| 5173 | Commande | `https://{slug}.surplasse.test` |
| 5174 | Dashboard | `https://dashboard.surplasse.test` |
| 5175 | Onboarding React, à sa création | futur `https://surplasse.test` |
| 5005 | Documentation (Retype) | `https://docs.surplasse.test` |
| 5006 | Débogueur JDWP du Backend en mode développement | connexion directe depuis l'IDE sur `localhost:5006` |
| 4173 | Prévisualisation statique actuelle | `https://surplasse.test` |
| 4174 | Cockpit local | `https://local.surplasse.test` |
| 1025 | Mailpit SMTP, publié sur l'interface loopback seulement | `localhost:1025` |
| 8025 | Mailpit, interface web et sonde de santé, publié sur l'interface loopback seulement | `https://mail.surplasse.test` |

Les ports 5173 à 5175 suivent l'ordre alphabétique des noms d'applications (Commande, Dashboard, Onboarding). Commande et le Dashboard fixent déjà leur port avec `strictPort` dans leur `vite.config.ts`. Le port 5175 reste réservé à l'Onboarding React et le cockpit utilise 4174. Quarkus utilise explicitement 5006 pour le débogueur afin de laisser 5005 à Retype. Un port occupé doit faire échouer le lancement plutôt que de glisser silencieusement vers un port voisin.

## Variables d'environnement

Le principe : chaque application committe un fichier `.env.example` listant toutes ses variables avec des valeurs factices et un commentaire par variable. Le fichier `.env` réel est ignoré par git. Les composants actuels se configurent depuis la racine avec :

```bash
cp backend/.env.example backend/.env
cp frontends/commande/.env.example frontends/commande/.env
cp frontends/dashboard/.env.example frontends/dashboard/.env
```

Les URL publiques sont centralisées dans `config/domains/development.env` et `config/domains/production.env`. Les fichiers `.env` propres aux applications gardent les secrets factices et les overrides ponctuels. Les variables principales sont :

`npm run backend:dev` et le cockpit lancent Maven depuis `backend/`, ce qui permet à Quarkus de charger `backend/.env`. Le wrapper ajoute ensuite le profil de domaines central sans recopier ses URL dans ce fichier local.

| Variable | Application | Rôle | Requise en dev |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Backend | clé secrète Stripe (mode test en dev : `sk_test_...`) | oui, pour les parcours de paiement |
| `STRIPE_PAYMENT_WEBHOOK_SECRET` | Backend | signature de la destination d'événements de paiement Connect au format snapshot | oui, pour confirmer les paiements |
| `STRIPE_ACCOUNT_WEBHOOK_SECRET` | Backend | signature de la destination d'événements fins Accounts v2 | oui, pour synchroniser les capacités |
| `STRIPE_LIVE_MODE` | Backend | mode attendu des objets et webhooks Stripe ; `false` en développement et test, `true` en production | non, `false` en développement |
| `OPENAI_API_KEY` | Backend | future clé API OpenAI pour le domaine `generation`, absent actuellement | non, future phase 3 |
| `QUARKUS_DATASOURCE_JDBC_URL` | Backend | DSN PostgreSQL | non en dev (Dev Services), oui en production |
| `APP_SCHEME`, `APP_BASE_DOMAIN`, `APP_BASE_URL` | tous | racine des URL publiques et génération des mini-sites | oui, fournis par le profil versionné |
| `DASHBOARD_URL`, `API_URL` | tous | origines canoniques du Dashboard et du Backend | oui, fournies par le profil versionné |
| `PROBLEM_TYPE_BASE` | Backend, Commande et Dashboard | base canonique des types RFC 9457, toujours `https://surplasse.com/problems/` même en local | oui, fournie par le profil versionné |
| `RESERVED_SUBDOMAINS` | Commande et infrastructure | noms exclus des slugs d'établissement | oui, fourni par le profil versionné |
| `COOKIE_DOMAIN` | décision de sécurité | doit rester vide pour des cookies API hôte uniquement | oui, vide dans les deux profils |
| `CORS_PUBLIC_ORIGINS` | Backend | apex exact et motif du sous-domaine direct courant, sans credentials | oui, dérivé par le wrapper de profil |
| `AUTH_JWT_AUDIENCE` | Backend | audience attendue du JWT restaurateur | non, valeur locale fournie |
| `VITE_API_BASE_URL` | chaque frontend | override de l'URL de base de l'API | non, profil local `https://api.surplasse.test` |
| `VITE_ESTABLISHMENT_SLUG` | Commande | repli pour un test direct du port Vite, sans sous-domaine | non, défaut `le-cormoran` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Commande | clé publique Stripe pour le paiement côté client (`pk_test_...`) | oui, pour payer |

En `%dev` et `%test`, Quarkus génère les clés JWT de travail : aucune clé privée n'est à créer ni à conserver. Le profil `%dev` joint Mailpit sur `localhost:1025`, sans authentification ni TLS. Les variables `AUTH_JWT_PRIVATE_KEY_PATH`, `AUTH_JWT_KEY_ID`, `AUTH_JWT_JWKS_PATH` et `SMTP_*` sont réservées à la production et détaillées dans [Environnements](../operations/environnements.md#backend-quarkus).

Le magic link est toujours dérivé de `DASHBOARD_URL`, l'émetteur JWT de `API_URL`, et les cookies sont `Secure` dans tous les profils sauf `%test`. Ces invariants ne possèdent aucun override d'environnement distinct, afin d'éviter une deuxième source de vérité.

!!! warning Jamais de secret dans git
Les clés réelles (même les clés Stripe de test) ne sont jamais committées : ni dans un `.env`, ni dans un fichier de config, ni dans un exemple. Le `.env.example` ne contient que des valeurs factices de la forme `sk_test_xxx`. En production, les secrets sont injectés par l'environnement Docker Compose du VPS, voir [operations](../operations/).
!!!

## Le premier lancement, pas à pas

Le scénario nominal passe par le domaine local et le cockpit.

**1. Démarrer Docker.** Vérifier que `docker info` répond. Le Backend l'utilise pour PostgreSQL Dev Services et le cockpit pour Mailpit.

**2. Installer une fois le DNS et le certificat.**

```bash
npm run local:setup
```

Le script macOS installe les formules manquantes, configure le wildcard `surplasse.test` et crée le certificat mkcert. Linux et WSL2 suivent les étapes manuelles de [Domaines locaux](domaines-locaux.md#linux-et-windows-avec-wsl2).

**3. Démarrer Caddy puis le cockpit.**

```bash
npm run local:proxy
npm run local:cockpit
```

Ouvrir `https://local.surplasse.test`, puis utiliser « Démarrer le parcours principal ». Mailpit démarre d'abord, puis le Backend, Commande et le Dashboard. Les Dev Services créent PostgreSQL 17 sur le port interne 5432 et Flyway applique les migrations ainsi que le seed de démonstration. Le cockpit affiche la progression et les liens utiles.

**4. Vérifier l'établissement de démonstration.**

Ouvrir `https://le-cormoran.surplasse.test/?table=tbl_2f8e6a4c0b9d7e1f`. Le hostname fournit le slug `le-cormoran`, la Table 4 ouvre une session anonyme et la carte du Cormoran s'affiche.

Le routage Connect du seed est volontairement fictif et sert uniquement aux doublures automatisées. Le parcours réel de paiement reste fermé tant qu'un compte Connect de test encaissable n'a pas été rattaché à l'établissement. La [fiche de preuve Stripe Connect](../operations/preuve-stripe-connect-2026-07-20.md) décrit le blocage actuel et la reprise.

**5. Vérifier le Dashboard et les magic links.**

Ouvrir `https://dashboard.surplasse.test/auth/login`, demander un lien pour `pilote@le-cormoran.example`, puis lire le message dans `https://mail.surplasse.test`. Après échange du jeton, `/service` affiche les commandes opérationnelles et l'indicateur « Temps réel actif ». Les commandes déjà payées du seed permettent de vérifier leur avancement jusqu'à `served` et leur sortie de la file active. Après rattachement d'un vrai compte Connect de test et configuration du relais webhook, payer une nouvelle commande avec la carte Stripe de test standard `4242 4242 4242 4242` et vérifier qu'elle apparaît sans actualisation manuelle.

**6. Relayer les webhooks Stripe si le paiement est testé.**

Ouvrir deux terminaux à la racine du dépôt. Le premier relaie les événements snapshot des Payment Intents créés sur les comptes connectés :

```bash
set -a
source config/domains/development.env
set +a

stripe listen \
  --events payment_intent.succeeded,payment_intent.payment_failed \
  --forward-connect-to "${API_URL}/v1/webhooks/stripe"
# Copier le whsec_... affiché dans STRIPE_PAYMENT_WEBHOOK_SECRET de backend/.env
```

Le second relaie les événements fins des comptes connectés Accounts v2 :

```bash
set -a
source config/domains/development.env
set +a

stripe listen \
  --thin-events 'v2.core.account.updated,v2.core.account.closed,v2.core.account[configuration.merchant].capability_status_updated' \
  --forward-thin-connect-to "${API_URL}/v1/webhooks/stripe/accounts"
# Copier l'autre whsec_... dans STRIPE_ACCOUNT_WEBHOOK_SECRET de backend/.env
```

Stripe CLI reste interactif et hors du cockpit. `--forward-connect-to` est obligatoire pour les événements snapshot des charges directes et `--forward-thin-connect-to` pour les événements fins Accounts v2 des comptes connectés. Les deux processus fournissent des secrets distincts qui ne sont jamais interchangeables. Le passage d'une commande à `paid` ne vient que du webhook de paiement signé.

Les modules peuvent toujours être lancés dans des terminaux séparés avec leurs commandes propres. Le cockpit les marque alors « lancé hors cockpit » et refuse de les arrêter. Avant de committer, lire le [workflow git](workflow-git.md) et exécuter les vérifications adaptées.

## Résolution des problèmes courants

| Symptôme | Cause probable | Remède |
|---|---|---|
| `Port 8080 already in use` (ou 5173, 5432...) | un autre processus occupe le port conventionnel | identifier le processus (`lsof -i :8080`) et l'arrêter ; ne pas changer le port de l'application |
| erreurs de build frontend étranges, syntaxe non reconnue | mauvaise version de Node active | `node -v` doit afficher 24 ; sinon `nvm use` à la racine du repo |
| `OpenAPI generation requires JDK 21`, `release version 21 not supported` ou erreur de compilation Java | JDK absent ou mauvaise version active | `java -version` doit afficher 21 ; relever la dernière Temurin 21 avec `sdk list java`, puis exécuter `sdk install java <identifiant>` et `sdk use java <identifiant>` |
| les Dev Services échouent, `Could not connect to Docker` | le démon Docker n'est pas démarré | lancer Docker Desktop ou OrbStack, vérifier avec `docker info`, relancer `npm run backend:dev` |
| `docs:watch` ou `docs:build` échoue, binaire `retype` introuvable dans `.bin` | le lien `node_modules/.bin/retype` n'a pas été créé par npm | appeler Retype directement : `node node_modules/retypeapp/retype.js start --port 5005` (ou `build`) ; c'est d'ailleurs la forme utilisée par les scripts npm du `package.json` racine |
| le front affiche des erreurs réseau vers l'API | le Backend est arrêté, Caddy ne tourne pas, ou `VITE_API_BASE_URL` pointe ailleurs | vérifier le cockpit puis `curl --fail https://api.surplasse.test/q/health/ready` |
| le Dashboard revient à la connexion après le magic link | la page a été ouverte par le port HTTP ou le cookie `Secure` ne peut pas être posé | utiliser uniquement `https://dashboard.surplasse.test` et `https://api.surplasse.test`, puis vérifier le certificat mkcert |
| le paiement de test échoue immédiatement | clés Stripe absentes ou mélange de clés (test côté back, autre compte côté front) | vérifier `STRIPE_SECRET_KEY` et `VITE_STRIPE_PUBLISHABLE_KEY` : même compte, toutes deux en mode test |
| `npm run backend:verify` échoue à charger des classes de test alors qu'elles compilent | `quarkus:dev` tourne sur le même workspace : les deux écrivent dans `target/` | arrêter le mode dev avant `verify` (ou inversement), puis relancer |

Si un problème sort de ce tableau, deux réflexes : la Dev UI de Quarkus (`/q/dev-ui`) pour tout ce qui touche au backend et aux Dev Services, et les logs du terminal Vite pour les frontends.

## Pour aller plus loin

| Page | Contenu |
|---|---|
| [Domaines locaux](domaines-locaux.md) | DNS wildcard, certificat mkcert, Caddy, URL réservées, cockpit et procédures par plateforme |
| [Workflow git](workflow-git.md) | branche unique, format des messages de commit, vérifications avant push |
| [Conventions React](conventions-react.md) | structure des frontends, TypeScript strict, TanStack Query, package `shared/` |
| [Conventions Quarkus](conventions-quarkus.md) | modules Maven, Panache, Flyway, conventions de code backend |
| [Conventions API et contrat](conventions-api.md) | le contrat OpenAPI, génération des clients TS et des interfaces Java |
| [Tests](tests.md) | pyramide de tests, outillage par pile, ce qui est testé et à quel niveau |
| [CI/CD](ci-cd.md) | pipelines GitHub Actions, build, publication des docs, déploiement VPS |
| [Vue d'ensemble de l'architecture](../architecture/index.md) | ce que ces commandes font tourner, et pourquoi c'est découpé ainsi |
