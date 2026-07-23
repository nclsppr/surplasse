---
label: Développement
order: 30
icon: rocket
description: Prérequis, installation, commandes, ports et premier lancement de l'environnement de développement Surplasse.
---

# Démarrer

Cette page est le point d'entrée de la section développement : ce qu'il faut installer sur sa machine, comment cloner et lancer le monorepo, quelles commandes exécuter dans chaque répertoire et comment diagnostiquer les problèmes les plus fréquents. Pour comprendre ce que l'on fait tourner avant de le lancer, lire d'abord la [vue d'ensemble de l'architecture](../architecture/index.md).

!!! info État actuel
Au 2026-07-23, la documentation, le contrat OpenAPI, le Backend Quarkus, Commande, le Dashboard, la préfiguration statique de l'Onboarding et le package partagé sont exécutables. Le cluster Docker Compose local assemble Caddy, PostgreSQL, ces applications, Mailpit et la documentation sous `surplasse.test`. Le profil facultatif `frontend-experiment` ajoute Onboarding2, Commande2 et Dashboard2, fondés sur `design-system2`, pour comparer une direction Untitled UI conformément à l'[ADR-0033](../decisions/adr-0033-frontends-alternatifs-untitled-ui.md). Ces variantes restent absentes des routes et images de production. Un autre profil facultatif ajoute Prometheus et Grafana sans les placer dans le chemin applicatif. Le cockpit pilote les services autorisés du profil development, lance le smoke Playwright local et publie son dernier rapport Allure sur `REPORTS_URL`. Le cluster canonique exerce le même graphe applicatif, les mêmes recettes applicatives et le même routage Caddy que la cible `surplasse.com`. Aucun VPS public n'est encore provisionné.
!!!

!!! info URL locales canoniques
Le navigateur utilise exclusivement `https://surplasse.test` et ses sous-domaines. Un accès direct par `localhost`, `127.0.0.1` ou `::1` est refusé par les surfaces locales. Le loopback ne sert qu'à l'écoute privée des processus, au reverse proxy, aux sondes techniques, à PostgreSQL, à SMTP et au débogueur. Il ne sert jamais de lien, d'origine applicative, de base de test de bout en bout ou de solution de repli. L'installation, la liste permanente des URL et le cockpit de modules sont détaillés dans [Domaines locaux](domaines-locaux.md).
!!!

## Prérequis

L'environnement de développement repose sur des gestionnaires de versions (nvm, SDKMAN) plutôt que sur des installations système : ils permettent d'épingler exactement les versions de référence du projet et de cohabiter avec d'autres projets sur la même machine.

| Outil | Version | Installation recommandée (macOS) | Installation recommandée (Linux) |
|---|---|---|---|
| git | 2.40 ou plus | livré avec les Command Line Tools (`xcode-select --install`) | paquet de la distribution (`apt install git`, `dnf install git`) |
| Node.js | 24 | [nvm](https://github.com/nvm-sh/nvm) puis `nvm install 24` | nvm, identique |
| Java (JDK) | 25 (LTS) | [SDKMAN](https://sdkman.io/) puis `sdk env install` depuis la racine | SDKMAN, identique |
| Maven | 3.9.16 | non requis : le wrapper `mvnw` est committé dans `backend/` | idem, le wrapper suffit |
| Docker | Docker Engine 27 ou plus | Docker Desktop ou [OrbStack](https://orbstack.dev/) | Docker Engine + plugin Compose (paquets officiels Docker) |
| Docker Compose | v2 (plugin `docker compose`) | inclus dans Docker Desktop et OrbStack | inclus dans les paquets officiels |
| Compte Stripe | mode test | création sur [stripe.com](https://stripe.com), aucune donnée bancaire réelle requise | identique |
| Stripe CLI | version courante | `brew install stripe/stripe-cli/stripe` | installation `apt` officielle décrite par [Stripe](https://docs.stripe.com/stripe-cli/install?locale=fr-FR) |
| Python | 3.x, assets de marque seulement | `brew install python` | paquets `python3` et `python3-venv` de la distribution |
| dnsmasq | version Homebrew courante | installé par `npm run local:setup` | installation et intégration `systemd-resolved` manuelles |
| mkcert | 1.4.x ou plus | installé par `npm run local:setup` | binaire officiel et paquet `libnss3-tools` |
| Caddy | 2.11.4 | image épinglée, aucune installation hôte | image épinglée, construite avec le module DNS choisi |
| Playwright et Chromium | Playwright 1.61.1, navigateur verrouillé par le package | `npm ci --prefix e2e`, puis `npm run e2e:install` | mêmes commandes ; en CI Ubuntu, installation avec `--with-deps` |
| Prometheus et Grafana | images 3.13.1 `busybox` et 13.1.1 | aucune installation hôte, services du profil Compose `observability` | identique sous WSL2 et Linux |

Précisions :

- **Node 24 via nvm** : un fichier `.nvmrc` à la racine fixe la version. `nvm use` dans un terminal ouvert à la racine suffit à basculer.
- **Java 25 via SDKMAN** : `.sdkmanrc` fixe Temurin 25.0.3. `sdk env install` installe cette version et `sdk env` l'active. La CI et les images utilisent aussi Temurin 25.
- **Maven** : ne jamais dépendre d'un Maven global. Toutes les commandes backend passent par `./mvnw`, qui télécharge la bonne version de Maven au premier appel.
- **Docker et Compose** : indispensables au cluster d'intégration. Compose démarre PostgreSQL, Caddy et tous les services avec la topologie destinée au VPS. Les Dev Services de Quarkus restent disponibles uniquement pour la boucle native `backend:dev`.
- **Stripe en mode test** : les clés de test (`sk_test_...`, `pk_test_...`) suffisent pour tout le développement. Aucun paiement réel ne transite en local.
- **Stripe CLI** : elle sert uniquement au développement pour relayer et rejouer les webhooks. Sous Windows, l'installation `apt` se fait dans WSL2. La CLI est absente de la production.
- **Python 3** : il sert seulement à générer et vérifier les QR de marque avec `scripts/requirements.txt`. C'est un outil de développement et de CI, absent de l'exécution applicative et de la production.
- **dnsmasq et mkcert** : développement seulement. dnsmasq fournit le wildcard local et mkcert le certificat approuvé par le poste. Ils sont absents de la production.
- **Caddy** : un seul Caddy de bord et un routage commun. La surcharge locale monte mkcert ; la surcharge production cible Let's Encrypt par défi DNS-01.
- **Playwright et Chromium** : outils de test locaux et CI uniquement. Ils pilotent la pile par ses URL HTTPS publiques et ne sont jamais copiés dans une image applicative ni installés sur le VPS.
- **Prometheus et Grafana** : services facultatifs de développement et de production. Les images sont épinglées dans le catalogue commun. Ils ne sont ni installés sur l'hôte, ni requis pour démarrer le Backend. Grafana est servi par l'URL centrale seulement en développement.
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
(cd e2e && npm ci && npx playwright install chromium) # E2E and local browser
(cd backend && ./mvnw dependency:resolve) # optional, quarkus:dev resolves them too

# 4. Install the optional UI2 experiment when working on it
npm run frontend2:install
```

Le `npm ci` racine installe Retype, Spectral et OpenAPI Generator. Les frontends et `e2e/` ont chacun leur propre `package.json` et leurs propres dépendances : il n'y a pas de workspace npm global. Le package partagé `frontends/shared/` est consommé en source via une dépendance `file:../shared`, conformément à l'[ADR-0014](../decisions/adr-0014-liaison-shared.md). Il faut donc installer `shared` avant de vérifier Commande ou le Dashboard. L'Onboarding actuel est statique et n'a pas encore de dépendances npm. L'installation E2E télécharge seulement Chromium ; Firefox et WebKit ne font pas partie du smoke initial.

`npm run frontend2:install` installe de façon verrouillée `shared`, `design-system2` et les trois applications suffixées `2`. Cette commande est facultative pour le développement canonique et identique sur macOS, Linux et Windows via WSL2. Les versions, prérequis et commandes isolées sont détaillés dans [Frontends alternatifs](frontends-alternatifs.md).

## Cycle de vie des composants actuels

| Composant | Nature et lancement local | Destination |
|---|---|---|
| `docs/` | Image statique dans Compose ou Retype avec `npm run docs:watch` | Build CI publié sur GitHub Pages, absent du VPS applicatif |
| `brand/` | Ressources statiques ; prévisualisation avec le serveur statique décrit plus bas | Intégré aux fronts et au site Pages, aucun processus autonome |
| `api/openapi.yaml` | Contrat vérifié par `npm run api:lint` et généré par `npm run api:generate` | Artefact de build ; copie exposée par le Backend, aucun service autonome |
| `backend/common` | Bibliothèque Maven ; `scripts/run-with-domain-profile.sh development ./backend/mvnw -f backend/pom.xml -pl common -am test` | Embarquée dans le Backend, aucun conteneur distinct |
| `backend/contract` | Sources générées ; `npm run api:generate`, puis build Maven | Embarqué dans le Backend et consommé au build, aucun conteneur distinct |
| `backend/catalog`, `backend/order`, `backend/payment` | Modules métier ; `scripts/run-with-domain-profile.sh development ./backend/mvnw -f backend/pom.xml -pl <module> -am test` | Embarqués dans le Backend, aucun conteneur distinct |
| `backend/identity` | Module métier des restaurateurs, magic links et sessions ; `scripts/run-with-domain-profile.sh development ./backend/mvnw -f backend/pom.xml -pl identity -am test` | Embarqué dans le Backend, sans processus, port ni conteneur distinct |
| `backend/application` | Image Compose ou boucle à chaud avec `npm run backend:dev` | Image Backend Quarkus du même Dockerfile |
| `frontends/shared` | Bibliothèque TypeScript ; `npm run check` et `npm test`, aucun serveur | Compilée dans les frontends, aucun conteneur distinct |
| `frontends/commande` | Image statique Compose ou Vite avec `npm run dev` | Image NGINX statique construite avec le profil production |
| `frontends/onboarding` | Image Node allowlistée ; la session Stripe intégrée est réservée au profil development | Même Dockerfile, fichiers statiques servis par NGINX sans pilote ni secret Stripe |
| `frontends/dashboard` | Image statique Compose ou Vite avec `npm run dev`, port natif strict 5174 | Image NGINX statique construite avec le profil production |
| `frontends/design-system2` | Bibliothèque TypeScript expérimentale ; `npm run check` et `npm test`, aucun serveur | Développement, build de validation et démo Pages seulement, absente du VPS |
| `frontends/onboarding2` | Profil Compose `frontend-experiment` ou Vite sur le listener strict 5175 | Développement et démo statique Pages seulement, absente des routes `.com` et du VPS |
| `frontends/commande2` | Profil Compose `frontend-experiment` ou Vite sur le listener strict 5176 | Développement et démo statique Pages seulement, absente des routes `.com` et du VPS |
| `frontends/dashboard2` | Profil Compose `frontend-experiment` ou Vite sur le listener strict 5177 | Développement et démo statique Pages seulement, absente des routes `.com` et du VPS |
| `scripts/dev-cockpit` | Serveur Node sans dépendance ; après `local:up`, `npm run local:cockpit` pilote les services autorisés de Compose development, lance les suites fixes et sert le rapport Allure local | Développement seulement, absent des builds et de la production |
| `e2e/` | Lanceur Playwright et générateur Allure 3 ; vise explicitement `development`, `production` ou `custom` ; état sous `.surplasse/e2e/` | Outil local et GitHub Actions, absent des images et du VPS |
| `compose.yaml`, `infra/caddy`, `infra/images`, `infra/observability` | Graphe, routage, recettes, règles et tableaux de bord sélectionnés par `scripts/compose.sh development` | Les mêmes fichiers avec `compose.production.yaml`, le profil production et une activation explicite de l'observabilité |

## Cycle de vie des logiciels tiers

| Logiciel | Développement et tests | Production |
|---|---|---|
| PostgreSQL 17.10 | Service Compose persistant pour le cluster ; Dev Services et Testcontainers pour les tests et la boucle native | Service Compose persistant, sauvegardé quotidiennement |
| Mailpit `axllent/mailpit:v1.30.4` | Développement seulement. Capture les emails du module `identity` sur les ports loopback 1025 et 8025, sans volume persistant | Absent de la CI et de la production. Un fournisseur SMTP transactionnel prendra le relais |
| Stripe CLI | Développement seulement, pour relayer et rejouer les webhooks | Absente. Stripe appelle directement le webhook public du Backend |
| Stripe | Compte et clés de test | Service SaaS requis avec comptes Connect et clés live |
| Retype | Prévisualisation locale et build CI | Aucun processus Retype. Le résultat statique est publié sur GitHub Pages |
| MinIO | Prévu avec le domaine `generation`, pas encore installé | Absent de la pile tant que le module applicatif n'existe pas |
| dnsmasq | Requis pour le wildcard `*.surplasse.test`, instance locale sans donnée | Absent ; le fournisseur DNS public porte l'apex et le wildcard `.com` |
| mkcert | Requis pour le certificat local approuvé, sans donnée applicative | Absent ; Let's Encrypt fournit le certificat public |
| Caddy 2.11.4 | Conteneur de bord avec certificat mkcert monté | Conteneur de bord commun, construit avec le module DNS-01 choisi |
| Playwright 1.61.1 et Chromium | Tests E2E locaux et GitHub Actions, navigateur téléchargé dans le cache utilisateur | Absents du VPS ; les tests accèdent à la production depuis un runner externe |
| Allure Report 3.14.3 | Génération locale et CI des rapports, historique JSONL sous `.surplasse/e2e/` | Aucun service sur le VPS ; rapports conservés comme artefacts GitHub Actions |
| Prometheus 3.13.1 `busybox` | Service facultatif, collecte interne de `/q/metrics`, volume `prometheus_data` | Même service facultatif sur le VPS, réseau Compose seulement, volume reconstructible |
| Grafana 13.1.1 | Service facultatif, tableau de bord provisionné sur `GRAFANA_URL`, volume `grafana_data` | Même service facultatif, aucun domaine public, port loopback et tunnel SSH, volume reconstructible |

### Dépendances d'exécution du Dashboard

Le verrou exact des versions vit dans `frontends/dashboard/package-lock.json`. Leur catégorie d'exécution est la suivante :

| Dépendance | Version de référence | Catégorie | Sort en production |
|---|---|---|---|
| React et React DOM | 19 | Bibliothèques applicatives | Oui, intégrées au JavaScript statique produit par Vite ; aucun processus autonome |
| React Router | 7 | Bibliothèque applicative | Oui, intégrée au JavaScript statique |
| TanStack Query | 5 | Bibliothèque applicative | Oui, intégrée au JavaScript statique |
| `frontends/shared` | version du même commit | Paquet source interne | Oui, compilé dans le Dashboard ; aucun paquet ni conteneur séparé |
| Polices auto-hébergées de `brand/fonts/` et logos SVG de `brand/` | version du même commit | Assets de marque au build | Oui, intégrés aux fichiers statiques ; aucune requête vers un CDN |
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
| racine | `npm run local:config` | validation silencieuse du modèle Compose et de ses variables |
| racine | `npm run compose:config:test` | validation des deux profils et des refus de configuration dangereux en production |
| racine | `npm run local:build` | construction des images du profil development |
| racine | `npm run local:up` | construction, démarrage en arrière-plan et attente de tous les healthchecks |
| racine | `scripts/compose.sh development up --detach --wait prometheus grafana` | démarrage explicite du profil facultatif `observability`, sans redémarrer le Backend |
| racine | `npm run local:start` | construction et démarrage au premier plan avec les logs |
| racine | `npm run local:ps` | état et santé des conteneurs |
| racine | `npm run local:logs` | suivi des logs Compose |
| racine | `npm run local:stop` | arrêt des conteneurs avec conservation des volumes |
| racine | `scripts/compose.sh development stop prometheus grafana` | arrêt indépendant de la supervision, volumes conservés |
| racine | `npm run local:down` | retrait des conteneurs et du réseau avec conservation des volumes |
| racine | `npm run local:proxy` | commande de compatibilité qui démarre le Caddy Compose et ses dépendances |
| racine | `npm run local:cockpit` | cockpit local après `local:up`, pilotage des services Compose development et rapports, port interne 4174 |
| racine | `npm run local:cockpit:test` | tests isolés du cockpit et de son contrôleur Compose, sans lancer Docker ni un module |
| racine | `npm run e2e:check` | tests unitaires du résolveur de cibles et de l'isolation des artefacts |
| racine | `npm run e2e:test -- development` | smoke E2E du cluster local par ses domaines HTTPS canoniques |
| racine | `npm run e2e:test -- production` | même smoke en lecture seule sur le profil production |
| racine | `npm run e2e:report -- <target>` | ouverture directe du rapport HTML autonome d'une cible, sans serveur permanent |
| racine | `npm run backend:dev` | Backend en mode dev avec profil central injecté, rechargement à chaud, Dev Services et Dev UI |
| racine | `npm run backend:verify` | compilation, tests et package Backend avec le profil central injecté ; utilise Java 25 local ou l'image Temurin 25 épinglée via Docker |
| racine | `npm run frontend2:install` | installation verrouillée de `shared`, `design-system2`, Onboarding2, Commande2 et Dashboard2 |
| racine | `npm run frontend2:check` | typecheck, lint, tests et builds des quatre packages expérimentaux |
| racine | `npm run local:experiment:up` | construction et démarrage du cluster development avec le profil `frontend-experiment` |
| racine | `npm run local:experiment:stop` | arrêt ciblé des trois applications UI2 sans arrêter le cluster canonique |
| racine | `scripts/run-with-domain-profile.sh development ./backend/mvnw -f backend/pom.xml -pl order -am test` | exemple de vérification ciblée avec le même profil |
| racine | `scripts/run-with-domain-profile.sh development ./backend/mvnw -f backend/pom.xml -pl identity -am test` | tests du module `identity`, sans processus autonome |
| `frontends/shared/` | `npm run check && npm test` | typecheck et tests de la bibliothèque, sans serveur |
| `frontends/commande/` | `npm run dev` | serveur Vite de Commande avec rechargement à chaud |
| `frontends/commande/` | `npm run lint && npm test && npm run build` | vérification complète de Commande |
| `frontends/dashboard/` | `npm run dev` | serveur Vite du Dashboard avec rechargement à chaud, port strict 5174 |
| `frontends/dashboard/` | `npm run lint && npm test && npm run build` | vérification complète du Dashboard |
| `frontends/design-system2/` | `npm run check && npm test` | vérification de la bibliothèque UI2, sans serveur autonome |
| `frontends/onboarding2/` | `npm run dev` | boucle Vite expérimentale sur le listener strict 5175 |
| `frontends/commande2/` | `npm run dev` | boucle Vite expérimentale sur le listener strict 5176 |
| `frontends/dashboard2/` | `npm run dev` | boucle Vite expérimentale sur le listener strict 5177 |
| racine | `node scripts/dev-cockpit/onboarding-server.mjs` | boucle native facultative du serveur Onboarding, port privé 4173 |

Pour le parcours nominal, lancer `npm run local:up`, puis ouvrir `https://surplasse.test` ou `https://surplasse.test/brand/board.html`. Le serveur Node de l'Onboarding ne sert que les fichiers publics explicitement autorisés : `.certs/`, les fichiers d'environnement et le reste du dépôt restent inaccessibles. Le cockpit complète le cluster en le pilotant par Compose. Les commandes natives restent disponibles séparément pour une boucle à chaud, puis la validation finale repasse par le cluster.

Le package E2E n'a ni port permanent, ni conteneur, ni volume. Chaque lancement construit une publication immuable avec résultats, diagnostics, historique et rapport autonome, puis la rend visible par une bascule atomique de `current.json`. Pour development, le cockpit sert le dernier rapport sur `REPORTS_URL`. Supprimer volontairement `.surplasse/e2e/{history-id}/` remet à zéro uniquement l'historique local de cette cible. Pour `custom`, l'identifiant de stockage contient une empreinte du domaine. La configuration détaillée, la cible personnalisée et les scénarios futurs sont décrits dans [Tests](tests.md).

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

Le message apparaît dans `https://mail.surplasse.test`. `Ctrl+C` arrête le Backend et donc le module s'il a été lancé dans ce terminal. Dans le cluster, le bouton du cockpit arrête le service Compose Backend ou Mailpit quel que soit le terminal qui l'a démarré. En cas de différence entre plateformes, le comportement sous Ubuntu LTS fait foi.

### Cycle de vie du Dashboard

Le Dashboard est une application Vite. Les mêmes commandes sont supportées sur macOS, Linux et Windows via WSL2. Le développement Windows natif reste exclu. Il dépend du Backend pour les sessions et les commandes, de Mailpit pour lire les magic links locaux et de `frontends/shared/` au build. Il ne crée aucune base, donnée persistante ni volume.

Depuis la racine du dépôt, installer les dépendances. Les domaines viennent du profil central, aucun `.env` frontend n'est requis pour le parcours nominal :

```bash
(cd frontends/shared && npm ci)
cd frontends/dashboard
npm ci
```

Le fichier `.env.example` ne documente que les variables propres à l'application, jamais une URL. Le mode Vite sélectionne `config/domains/development.env` et le build sélectionne `config/domains/production.env`.

Le parcours d'intégration démarre toutes les dépendances avec Compose :

```bash
npm run local:up
curl --fail https://api.surplasse.test/q/health/ready
curl --fail https://dashboard.surplasse.test/
```

Le serveur Vite reste disponible pour une boucle React courte, sans constituer une validation de la topologie publique :

```bash
cd frontends/dashboard
npm run dev
```

Après cette boucle, reconstruire et vérifier le service réel avec `npm run local:up`.

Ouvrir ensuite `https://dashboard.surplasse.test/auth/login`, demander un lien pour `pilote@le-cormoran.example`, puis ouvrir `https://mail.surplasse.test`. Le lien transporte le jeton dans le fragment `#token=...` : ce fragment n'est pas envoyé au serveur Vite, et le Dashboard le retire immédiatement de la barre d'adresse avant l'échange par POST. Après connexion, `/service` affiche les commandes opérationnelles de l'établissement autorisé. Les actions permettent de les accepter, de lancer leur préparation, de les marquer prêtes, puis servies ou retirées selon leur type.

Ne pas revenir aux ports HTTP dans le navigateur. Le couple canonique est `https://dashboard.surplasse.test` et `https://api.surplasse.test`. Il exerce les cookies `Secure`, le CORS, le hostname et les en-têtes de proxy comme la production.

La vérification complète du module se lance sans Backend ni Mailpit :

```bash
cd frontends/dashboard
npm run lint
npm test
npm run build
```

Arrêter les processus natifs avec `Ctrl+C`. `npm run local:stop` conserve le volume PostgreSQL du cluster ; Mailpit reste jetable. Le dossier `dist/` peut être supprimé et reconstruit à volonté, car il ne contient aucune donnée utilisateur.

## Ports conventionnels

Dans le cluster, seul Caddy publie `127.0.0.1:443`. Tous les autres ports Compose restent sur son réseau. Le cockpit facultatif écoute aussi sur 4174 afin que Caddy puisse le joindre depuis son conteneur, mais il refuse toute requête qui ne porte pas le jeton amont. Le navigateur ne connaît donc que les URL HTTPS du profil.

| Port ou listener | Composant | URL navigateur canonique |
|---|---|---|
| 443 | Caddy | toutes les URL `https://*.surplasse.test` |
| 8080 | Backend | `https://api.surplasse.test` |
| 8080 | NGINX de Commande et du Dashboard | domaines respectifs via Caddy |
| 4173 | Onboarding Node | `https://surplasse.test` |
| 5432 | PostgreSQL | aucune, réseau Compose seulement |
| 1025 et 8025 | Mailpit | SMTP interne et `https://mail.surplasse.test` |
| 4174 | Cockpit sur l'hôte, joint par Caddy | `https://local.surplasse.test` et `https://reports.surplasse.test` |
| 9090 | Prometheus | aucune, réseau Compose seulement |
| 3000 | Grafana | `GRAFANA_URL` via Caddy, réseau Compose seulement |

Les commandes natives conservent 5173 pour Commande, 5174 pour le Dashboard, 4173 pour l'Onboarding, 4174 pour le cockpit, 5005 pour Retype, 5006 pour JDWP et 8080 pour Quarkus. L'expérience UI2 réserve 5175 à Onboarding2, 5176 à Commande2 et 5177 à Dashboard2. Ces listeners servent à la mise au point et aux sondes, pas à définir des URL applicatives. Un port occupé doit faire échouer le lancement au lieu de glisser vers un voisin.

## Variables d'environnement

Le principe : chaque application committe un fichier `.env.example` listant toutes ses variables avec des valeurs factices et un commentaire par variable. Le fichier `.env` réel est ignoré par git. Les composants actuels se configurent depuis la racine avec :

```bash
cp backend/.env.example backend/.env
cp frontends/commande/.env.example frontends/commande/.env
cp frontends/dashboard/.env.example frontends/dashboard/.env
```

Le domaine racine public est centralisé dans `config/domains/development.env` et `config/domains/production.env`. Le chargeur en dérive toutes les URL applicatives. Les fichiers `.env` propres aux applications gardent uniquement les secrets factices et les réglages qui ne décrivent pas la topologie. Les variables principales sont :

`npm run backend:dev` lance Maven depuis `backend/`, ce qui permet à Quarkus de charger `backend/.env`. Le wrapper ajoute ensuite le profil de domaines central sans recopier ses URL dans ce fichier local. Le cockpit ne lance pas de processus Quarkus natif : il pilote le service Backend de Compose et exécute les suites de qualité par leurs commandes fixes à la racine.

| Variable | Application | Rôle | Requise en dev |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Backend | clé secrète Stripe (mode test en dev : `sk_test_...`) | oui, pour les parcours de paiement |
| `STRIPE_CONNECT_PILOT_ACCOUNT_ID` | Onboarding local | compte Accounts v2 utilisé uniquement par la qualification intégrée du pilote | oui, pour le pilote Connect |
| `STRIPE_CONNECT_PILOT_ESTABLISHMENT_NAME` | Onboarding local | nom public affiché autour du composant Connect du pilote | oui, pour le pilote Connect |
| `STRIPE_PAYMENT_WEBHOOK_SECRET` | Backend | signature de la destination d'événements de paiement Connect au format snapshot | oui, pour confirmer les paiements |
| `STRIPE_ACCOUNT_WEBHOOK_SECRET` | Backend | signature de la destination d'événements fins Accounts v2 | oui, pour synchroniser les capacités |
| `STRIPE_LIVE_MODE` | Backend | mode attendu des objets et webhooks Stripe ; `false` en développement et test, `true` en production | non, `false` en développement |
| `OPENAI_API_KEY` | Backend | future clé API OpenAI pour le domaine `generation`, absent actuellement | non, future phase 3 |
| `QUARKUS_DATASOURCE_JDBC_URL` | Backend | DSN PostgreSQL interne | injectée par Compose ; Dev Services la fournit dans la boucle native |
| `APP_SCHEME`, `APP_BASE_DOMAIN` | tous | racine unique dont dérivent les URL publiques et les mini-sites | oui, fournis par le profil versionné |
| `APP_BASE_URL`, `ONBOARDING_URL`, `DASHBOARD_URL`, `API_URL`, `DOCS_URL` | tous | origines canoniques calculées depuis `APP_BASE_DOMAIN` | oui, dérivées par le chargeur central |
| `LOCAL_CONTROL_URL`, `MAILPIT_URL`, `REPORTS_URL`, `GRAFANA_URL` | outillage development | cockpit, Mailpit, dernier rapport Allure local et interface Grafana locale | dérivées uniquement pour development |
| `PROBLEM_TYPE_BASE` | Backend, Commande et Dashboard | base canonique des types RFC 9457, toujours `https://surplasse.com/problems/` même en local | oui, fournie par le profil versionné |
| `RESERVED_SUBDOMAINS` | Commande et infrastructure | noms exclus des slugs d'établissement | oui, fourni par le profil versionné |
| `COOKIE_DOMAIN` | décision de sécurité | doit rester vide pour des cookies API hôte uniquement | oui, vide dans les deux profils |
| `CORS_PUBLIC_ORIGINS` | Backend | apex exact et motif du sous-domaine direct courant, sans credentials | oui, dérivé par le wrapper de profil |
| `AUTH_JWT_AUDIENCE` | Backend | audience attendue du JWT restaurateur | non, valeur locale fournie |
| `VITE_API_BASE_URL` | chaque frontend | valeur injectée par le chargeur depuis l'URL API dérivée | oui, générée depuis `APP_BASE_DOMAIN` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Commande | clé publique Stripe pour le paiement côté client (`pk_test_...`) | oui, pour payer |

En `%dev` et `%test`, Quarkus génère les clés JWT de travail : aucune clé privée n'est à créer ni à conserver. Compose injecte `mailpit:1025` dans le conteneur Backend ; la boucle native utilise son listener loopback. Les variables `AUTH_JWT_PRIVATE_KEY_PATH`, `AUTH_JWT_KEY_ID`, `AUTH_JWT_JWKS_PATH` et les identifiants SMTP réels sont réservés à la production et détaillés dans [Environnements](../operations/environnements.md#backend).

Le magic link est toujours dérivé de `DASHBOARD_URL`, l'émetteur JWT de `API_URL`, et les cookies sont `Secure` dans tous les profils sauf `%test`. Ces invariants ne possèdent aucun override d'environnement distinct, afin d'éviter une deuxième source de vérité.

!!! warning Jamais de secret dans git
Les clés réelles (même les clés Stripe de test) ne sont jamais committées : ni dans un `.env`, ni dans un fichier de config, ni dans un exemple. Le `.env.example` ne contient que des valeurs factices de la forme `sk_test_xxx`. En production, les secrets sont injectés par l'environnement Docker Compose du VPS, voir [operations](../operations/).
!!!

## Le premier lancement, pas à pas

Le scénario nominal passe par le cluster Compose et les domaines locaux.

**1. Démarrer Docker.** Vérifier que `docker info` et `docker compose version` répondent.

**2. Installer une fois le DNS et le certificat.**

```bash
npm run local:setup
```

Le script macOS installe les formules manquantes, configure le wildcard `surplasse.test` et crée le certificat mkcert. Linux et WSL2 suivent les étapes manuelles de [Domaines locaux](domaines-locaux.md#linux-et-windows-avec-wsl2).

**3. Construire et démarrer le cluster.**

```bash
npm run local:up
npm run local:ps
```

Compose démarre PostgreSQL, le Backend, les trois fronts, Mailpit, la documentation et Caddy, puis attend leurs healthchecks. Flyway applique les migrations et le seed de démonstration avant que le Backend devienne prêt. Caddy est le seul service publié sur l'hôte. Prometheus et Grafana restent arrêtés tant que le profil `observability` n'est pas demandé : leur absence ne change pas la readiness du Backend.

Pour comparer les variantes UI2 sur les mêmes données, ajouter ensuite le profil expérimental :

```bash
npm run local:experiment:up
curl --fail https://surplasse.test/_experiments/untitled/
curl --fail 'https://le-cormoran.surplasse.test/_experiments/untitled/?table=tbl_2f8e6a4c0b9d7e1f'
curl --fail https://dashboard.surplasse.test/_experiments/untitled/auth/login
```

`npm run local:experiment:stop` arrête seulement Onboarding2, Commande2 et Dashboard2. Les variantes ne possèdent ni volume ni donnée serveur propre. Leur arrêt ne demande donc ni sauvegarde, ni migration, ni retour arrière. Le cluster canonique continue de fonctionner.

GitHub Pages publie aussi un [sélecteur de démos UI2](https://nclsppr.github.io/surplasse/_experiments/untitled/), puis un build distinct pour Onboarding2, Commande2 et Dashboard2. Ces fichiers portent `noindex` et servent uniquement à la revue visuelle publique du SHA construit. Ils utilisent le profil de configuration development, ne fournissent ni Backend, ni session réelle, ni paiement et ne créent aucune route de production. Dashboard2 y emploie une session et des commandes synthétiques en mémoire pour rendre le tableau de service visible. La validation des parcours alimentés par les données reste celle du profil Compose local décrit ci-dessus.

Pour observer le cluster, démarrer ensuite les deux services facultatifs :

```bash
scripts/compose.sh development up --detach --wait prometheus grafana
curl --fail https://grafana.surplasse.test/api/health
```

Grafana ouvre le tableau de bord provisionné `Surplasse / Vue opérationnelle`. La lecture anonyme locale utilise le rôle `Viewer`. Prometheus n'a aucune URL navigateur. Le profil conserve 7 jours de séries dans `prometheus_data` et l'état Grafana dans `grafana_data`. Arrêter les deux services avec la commande ciblée ci-dessus laisse le Backend sain et conserve les volumes.

Le cockpit reste facultatif. Après `local:up`, `npm run local:cockpit` charge le jeton amont créé par le wrapper et l'expose à travers Caddy sur `https://local.surplasse.test`. Il affiche les liens, les sondes et l'état Compose, puis peut démarrer ou arrêter les services autorisés, y compris Prometheus et Grafana. Caddy reste visible en lecture seule. La page `/tests` lance les suites fixes, dont Playwright uniquement sur development, et lie le dernier rapport sur `https://reports.surplasse.test`. Arrêter le cockpit ne stoppe pas le cluster.

La suite Backend intégré exige que `quarkus:dev` soit arrêté, car Maven et ce mode partagent les répertoires `target/`. Elle utilise Java 25 local lorsqu'il est disponible, sinon l'image Temurin épinglée. Les résultats et le cache `.surplasse/` sont locaux, ignorés par git et absents de la production. L'historique E2E y reste conservé jusqu'à sa suppression volontaire.

**4. Vérifier l'établissement de démonstration.**

Ouvrir `https://le-cormoran.surplasse.test/?table=tbl_2f8e6a4c0b9d7e1f`. Le hostname fournit le slug `le-cormoran`, la Table 4 ouvre une session anonyme et la carte du Cormoran s'affiche.

Le routage Connect du seed est volontairement fictif et sert uniquement aux doublures automatisées. Le parcours réel de paiement reste fermé tant qu'un compte Connect de test encaissable n'a pas été rattaché à l'établissement. La [fiche de preuve Stripe Connect](../operations/preuve-stripe-connect-2026-07-20.md) décrit le blocage actuel et la reprise.

Pour qualifier l'embarquement Connect intégré, renseigner dans `backend/.env` le compte test et son nom, puis reconstruire le cluster avec `npm run local:up`. La clé publique vient de `frontends/commande/.env`, la clé secrète de `backend/.env`. Ouvrir ensuite `https://surplasse.test/connect.html`. Le navigateur reçoit uniquement la clé publique et un secret de session court. La clé secrète reste dans le conteneur Onboarding. Le même chemin publié sur GitHub Pages affiche seulement un état de démonstration et ne peut créer aucune session Stripe.

**5. Vérifier le Dashboard et les magic links.**

Ouvrir `https://dashboard.surplasse.test/auth/login`, demander un lien pour `pilote@le-cormoran.example`, puis lire le message dans `https://mail.surplasse.test`. Après échange du jeton, `/service` affiche les commandes opérationnelles et l'indicateur « Temps réel actif ». Les commandes déjà payées du seed permettent de vérifier leur avancement jusqu'à `served` ou leur remboursement intégral et leur sortie de la file active. Après rattachement d'un vrai compte Connect de test et configuration du relais webhook, payer une nouvelle commande avec la carte Stripe de test standard `4242 4242 4242 4242`, vérifier qu'elle apparaît sans actualisation manuelle, puis la refuser et rapprocher son remboursement.

**6. Relayer les webhooks Stripe si le paiement est testé.**

Ouvrir deux terminaux à la racine du dépôt. Le premier relaie les événements snapshot des Payment Intents et remboursements sur les comptes connectés :

```bash
scripts/run-with-domain-profile.sh development bash -c '
  stripe listen \
    --events payment_intent.succeeded,payment_intent.payment_failed,refund.created,refund.updated,refund.failed \
    --forward-connect-to "${API_URL}/v1/webhooks/stripe"
'
# Copier le whsec_... affiché dans STRIPE_PAYMENT_WEBHOOK_SECRET de backend/.env
```

Le second relaie les événements fins des comptes connectés Accounts v2 :

```bash
scripts/run-with-domain-profile.sh development bash -c '
  stripe listen \
    --thin-events "v2.core.account.updated,v2.core.account.closed,v2.core.account[configuration.merchant].capability_status_updated" \
    --forward-thin-connect-to "${API_URL}/v1/webhooks/stripe/accounts"
'
# Copier l'autre whsec_... dans STRIPE_ACCOUNT_WEBHOOK_SECRET de backend/.env
```

Stripe CLI reste interactif et hors du cockpit. `--forward-connect-to` est obligatoire pour les événements snapshot des charges directes et des remboursements, puis `--forward-thin-connect-to` pour les événements fins Accounts v2 des comptes connectés. Les deux processus fournissent des secrets distincts qui ne sont jamais interchangeables. Le passage d'une commande à `paid` et le rapprochement asynchrone d'un remboursement viennent uniquement du webhook snapshot signé.

Les modules peuvent toujours être lancés dans des terminaux séparés pour une boucle courte. Cette exécution native ne remplace pas la validation finale du cluster avec `npm run local:up`. Avant de committer, lire le [workflow git](workflow-git.md) et exécuter les vérifications adaptées.

## Résolution des problèmes courants

| Symptôme | Cause probable | Remède |
|---|---|---|
| `Bind for 127.0.0.1:443 failed` | un autre reverse proxy occupe le port public local | identifier le processus avec `lsof -nP -iTCP:443 -sTCP:LISTEN`, l'arrêter, puis relancer `npm run local:up` |
| un service reste `unhealthy` | son démarrage, une migration ou une configuration a échoué | lire `scripts/compose.sh development logs --tail 200 <service>` puis corriger la cause, sans changer son port interne |
| erreurs de build frontend étranges, syntaxe non reconnue | mauvaise version de Node active | `node -v` doit afficher 24 ; sinon `nvm use` à la racine du repo |
| `OpenAPI generation requires JDK 25`, `release version 25 not supported` ou erreur de compilation Java | JDK absent ou mauvaise version active | `java -version` doit afficher 25 ; à la racine, exécuter `sdk env install`, puis `sdk env` |
| Compose ou les Dev Services échouent avec `Could not connect to Docker` | le démon Docker n'est pas démarré | lancer Docker Desktop ou OrbStack, vérifier avec `docker info`, puis relancer la commande |
| `docs:watch` ou `docs:build` échoue, binaire `retype` introuvable dans `.bin` | le lien `node_modules/.bin/retype` n'a pas été créé par npm | appeler Retype directement : `node node_modules/retypeapp/retype.js start --port 5005` (ou `build`) ; c'est d'ailleurs la forme utilisée par les scripts npm du `package.json` racine |
| le front affiche des erreurs réseau vers l'API | le Backend ou Caddy est malsain, ou l'image du profil est périmée | lancer `npm run domains:check`, `npm run local:ps`, puis reconstruire avec `npm run local:up` |
| le cockpit demande d'exécuter `local:up` ou répond 502 | le jeton amont ou le Caddy development n'existe pas encore | lancer `npm run local:up`, puis relancer `npm run local:cockpit` dans un autre terminal |
| `grafana.surplasse.test` répond 502 | le profil `observability` n'est pas démarré ou Grafana est malsain | démarrer `prometheus grafana` avec le wrapper, puis lire `scripts/compose.sh development logs --tail 200 grafana prometheus` |
| `reports.surplasse.test` répond 404 | aucun rapport Playwright development n'a encore été généré | installer Chromium, ouvrir `/tests` dans le cockpit et lancer « Parcours Playwright » |
| le Dashboard revient à la connexion après le magic link | la page a été ouverte par le port HTTP ou le cookie `Secure` ne peut pas être posé | utiliser uniquement `https://dashboard.surplasse.test` et `https://api.surplasse.test`, puis vérifier le certificat mkcert |
| le paiement de test échoue immédiatement | clés Stripe absentes ou mélange de clés (test côté back, autre compte côté front) | vérifier `STRIPE_SECRET_KEY` et `VITE_STRIPE_PUBLISHABLE_KEY` : même compte, toutes deux en mode test |
| `npm run backend:verify` échoue à charger des classes de test alors qu'elles compilent | `quarkus:dev` tourne sur le même workspace : les deux écrivent dans `target/` | arrêter le mode dev avant `verify` (ou inversement), puis relancer |

Si un problème sort de ce tableau, commencer par `npm run local:ps` et les logs Compose. La Dev UI Quarkus et les logs Vite concernent uniquement les boucles natives.

## Pour aller plus loin

| Page | Contenu |
|---|---|
| [Domaines locaux](domaines-locaux.md) | cluster Compose, DNS wildcard, certificat mkcert, URL réservées et procédures par plateforme |
| [Workflow git](workflow-git.md) | branche unique, format des messages de commit, vérifications avant push |
| [Conventions React](conventions-react.md) | structure des frontends, TypeScript strict, TanStack Query, package `shared/` |
| [Conventions Quarkus](conventions-quarkus.md) | modules Maven, Panache, Flyway, conventions de code backend |
| [Conventions API et contrat](conventions-api.md) | le contrat OpenAPI, génération des clients TS et des interfaces Java |
| [Tests](tests.md) | pyramide de tests, outillage par pile, ce qui est testé et à quel niveau |
| [CI/CD](ci-cd.md) | pipelines GitHub Actions, build, publication des docs, déploiement VPS |
| [Vue d'ensemble de l'architecture](../architecture/index.md) | ce que ces commandes font tourner, et pourquoi c'est découpé ainsi |
