---
label: Domaines locaux
order: 15
icon: globe
description: Installation et exploitation du cluster Docker Compose local sous les domaines HTTPS surplasse.test.
---

# Cluster local et domaines HTTPS

Le cluster d'intégration local exécute la topologie destinée au VPS avec le profil `development`. Il utilise `surplasse.test`, un certificat mkcert et des données de démonstration. Le même `compose.yaml`, les mêmes recettes applicatives et le même Caddyfile servent au profil `production` décrit dans [Déploiement Compose](../operations/deploiement-compose.md). Seule l'image Caddy de production ajoute le module DNS requis par Let's Encrypt. Le profil facultatif `observability` ajoute Prometheus et Grafana sans changer la readiness du Backend.

Le navigateur utilise toujours une URL HTTPS dérivée de `config/domains/development.env`. `localhost`, `127.0.0.1` et `::1` restent réservés aux listeners, sondes et transports internes.

## Topologie

| Service Compose | Rôle | Production |
|---|---|---|
| `edge` | Caddy de bord, TLS, CORS et routage par nom d'hôte | Même rôle avec Let's Encrypt DNS-01 |
| `postgresql` | PostgreSQL 17 et migrations Flyway | Même service, volume sauvegardé |
| `backend` | Backend Quarkus empaqueté pour le profil development | Même Dockerfile, image construite et démarrée avec le profil production |
| `onboarding` | Serveur Node allowlisté pour la préfiguration statique et la session courte Stripe test si configurée | Même Dockerfile, fichiers statiques servis par NGINX avec la seule configuration publique production, sans pilote ni secret Stripe |
| `commande` | Build Vite statique du profil de développement | Même Dockerfile, build du profil de production |
| `dashboard` | Build Vite statique du profil de développement | Même Dockerfile, build du profil de production |
| `mailpit` | SMTP et boîte jetable | Absent, remplacé par le SMTP transactionnel |
| `docs` | Build Retype statique | Absent du VPS, publié sur GitHub Pages |
| `prometheus` | Collecte interne des métriques Backend, profil `observability` | Même service facultatif, sans port public |
| `grafana` | Tableau de bord opérationnel sur l'URL centrale, profil `observability` | Même service facultatif, accessible seulement par port loopback et tunnel SSH |

Un seul Caddy est exposé. Les NGINX de Commande, Dashboard et de la documentation servent uniquement des fichiers sur le réseau Compose. L'Onboarding rejoint ce modèle NGINX en production. PostgreSQL, le Backend et Prometheus ne publient aucun port hôte. Grafana est joint par Caddy uniquement en développement.

## Démarrage rapide sur macOS

Prérequis : Homebrew, Docker Desktop ou OrbStack démarré, Node 24 et les dépendances npm du dépôt. Java local n'est pas requis pour lancer le cluster, car le build Backend utilise l'image Temurin 25. Il reste requis pour la boucle Quarkus native et les tests locaux hors conteneur.

```bash
npm ci

# Install wildcard DNS and the trusted local certificate once
npm run local:setup

# Build, start in background and wait for every healthcheck
npm run local:up

# Show the resolved container states
npm run local:ps
```

`local:setup` installe `dnsmasq`, `nss` et `mkcert`. Caddy n'est pas installé sur l'hôte : son image épinglée tourne dans Compose. Le script crée la zone wildcard vers `127.0.0.1`, installe l'autorité mkcert et écrit la feuille sous `.certs/`. Le wrapper monte aussi la racine publique mkcert dans le conteneur Caddy afin que son healthcheck HTTPS valide la chaîne. `LOCAL_TLS_CA_FILE` permet à la CI Ubuntu de fournir l'autorité éphémère du runner. Cette variable technique reste un chemin absolu vers un certificat public, jamais une URL ni un secret.

Le premier `local:up` télécharge les images de base, compile le Backend, construit les fronts et crée le volume PostgreSQL. Les appels suivants réutilisent le cache. Pour garder les logs attachés au terminal :

```bash
npm run local:start
```

## URL permanentes

| URL | Destination | Résultat attendu |
|---|---|---|
| `https://surplasse.test` | Onboarding | 200 |
| `https://www.surplasse.test` | Redirection vers l'apex | 308 |
| `https://dashboard.surplasse.test` | Dashboard | 200 |
| `https://api.surplasse.test/q/health/ready` | Backend | `UP` |
| `https://docs.surplasse.test` | Documentation | 200 |
| `https://mail.surplasse.test` | Mailpit | 200 |
| `https://local.surplasse.test` | Cockpit lancé sur l'hôte | 200 ou 502 s'il est arrêté |
| `https://reports.surplasse.test` | Dernier rapport Allure 3 development servi par le cockpit | 200 après une exécution, 404 avant, 502 si le cockpit est arrêté |
| `https://grafana.surplasse.test` | Grafana du profil `observability` | 200 après démarrage du service, 502 lorsqu'il est arrêté |
| `https://app.surplasse.test` | Domaine réservé | 503 |
| `https://admin.surplasse.test` | Domaine réservé | 503 |
| `https://{slug}.surplasse.test` | Commande | 200 |

Le seed contient l'établissement `le-cormoran`. Une vérification fonctionnelle utilise donc :

```bash
curl --fail https://surplasse.test/
curl --fail https://api.surplasse.test/q/health/ready
curl --fail https://dashboard.surplasse.test/auth/login
curl --fail 'https://le-cormoran.surplasse.test/?table=tbl_2f8e6a4c0b9d7e1f'
curl --fail https://docs.surplasse.test/
curl --fail https://mail.surplasse.test/readyz
```

Un certificat wildcard couvre l'apex et un niveau direct. Il couvre `le-cormoran.surplasse.test`, pas `table.le-cormoran.surplasse.test`.

## Commandes de cycle de vie

| Commande | Effet |
|---|---|
| `npm run local:config` | Valide le modèle Compose et les variables sans l'afficher |
| `npm run local:build` | Reconstruit les images applicatives |
| `npm run local:up` | Construit, démarre en arrière-plan et attend les healthchecks |
| `scripts/compose.sh development up --detach --wait prometheus grafana` | Démarre explicitement le profil facultatif d'observabilité |
| `npm run local:start` | Démarre au premier plan avec les logs |
| `npm run local:ps` | Affiche les conteneurs et leur santé |
| `npm run local:logs` | Suit les logs de la pile |
| `npm run local:stop` | Arrête les conteneurs et conserve les volumes |
| `scripts/compose.sh development stop prometheus grafana` | Arrête uniquement Prometheus et Grafana, volumes conservés |
| `npm run local:down` | Retire les conteneurs et le réseau, conserve les volumes |
| `npm run local:proxy` | Compatibilité : construit et démarre Caddy avec ses dépendances |
| `npm run local:proxy:stop` | Arrête seulement le Caddy de bord |

Pour un diagnostic ciblé :

```bash
scripts/compose.sh development logs --tail 200 edge backend postgresql
scripts/compose.sh development exec backend \
  curl --fail http://127.0.0.1:8080/q/health/ready
scripts/compose.sh development exec postgresql \
  pg_isready --username surplasse --dbname surplasse
```

Lorsque l'observabilité est démarrée :

```bash
curl --fail https://grafana.surplasse.test/api/health
scripts/compose.sh development exec prometheus \
  wget --quiet --output-document=- http://127.0.0.1:9090/-/ready
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  https://api.surplasse.test/q/metrics
```

Le dernier contrôle doit afficher `404`. L'endpoint de métriques reste interne même en développement.

Les adresses loopback de ces commandes restent des sondes internes. Elles ne servent pas à la navigation.

## Configuration et secrets

Trois niveaux ne se mélangent pas :

| Source | Contenu |
|---|---|
| `config/domains/development.env` | Domaine, base des Problem Details, cookies hôte uniquement et sous-domaines réservés |
| `config/deployment/development.env` | Réseau Compose, ports publiés, identifiants PostgreSQL jetables et SMTP Mailpit |
| `backend/.env`, `frontends/commande/.env` | Clés Stripe test et compte pilote, ignorés par git |

`scripts/compose.sh` lit les fichiers secrets comme du dotenv, sans les exécuter comme du shell. Il refuse qu'ils définissent un domaine, une URL publique, `COOKIE_DOMAIN`, `CORS_PUBLIC_ORIGINS` ou le profil sélectionné. Les images excluent tous les fichiers `.env` et `.certs` de leur contexte. Le chargeur dérive `LOCAL_CONTROL_URL`, `MAILPIT_URL`, `REPORTS_URL` et `GRAFANA_URL` uniquement pour development. Les sous-domaines `reports` et `grafana` restent réservés dans les deux profils et ne sont jamais interprétés comme un établissement.

Commande et Dashboard intègrent le profil public pendant leur build Vite. Modifier `config/domains/development.env` exige donc une reconstruction :

```bash
npm run domains:generate
python3 scripts/generate_brand_assets.py
npm run local:up
```

Le Backend vérifie au démarrage le profil avec lequel son image a été construite. L'Onboarding reçoit une configuration JavaScript générée pour ce seul profil. Aucun service ne remplace silencieusement `.test` par `.com` et un hostname inconnu n'entraîne jamais un repli vers la production.

## Caddy, CORS et proxy de confiance

`infra/caddy/Caddyfile` contient toutes les routes communes et refuse `/q/metrics` sur l'API publique. `infra/caddy/tls/development.caddy` monte la feuille mkcert. `infra/caddy/routes/development.caddy` ajoute seulement la documentation, Mailpit, le cockpit, le dernier rapport Allure development et Grafana. Les deux hôtes du cockpit passent par un jeton amont créé par le wrapper Compose. Un accès direct au listener 4174 ou un proxy qui ne possède pas ce jeton est refusé. Prometheus n'a jamais de route Caddy. La surcharge production n'ajoute aucune route Grafana.

Le réseau Compose attribue une adresse explicite au Caddy. Le Backend ne fait confiance aux en-têtes `X-Forwarded-*` que depuis cette adresse. Caddy retire `Access-Control-Allow-Credentials` par défaut et le remet à `true` seulement pour les origines exactes de l'Onboarding et du Dashboard. La vérification isolée est :

```bash
npm run local:cors:test
```

## Cockpit Compose, tests et rapports

Le cockpit est un outil local sur l'hôte. Il se connecte uniquement au projet Compose development par le wrapper versionné. Le cluster doit être démarré en premier, car `local:up` crée le jeton amont et démarre le Caddy qui publie les deux URL :

```bash
npm run local:up
npm run local:cockpit
```

Ouvrir `https://local.surplasse.test` pour l'inventaire et `https://local.surplasse.test/tests` pour les vérifications. Le cockpit lit l'état réel avec Compose. Les actions d'un module appellent une opération fixe sur son service autorisé : construction et `up --wait` au démarrage, `stop` à l'arrêt. Un service démarré dans un autre terminal reste donc pilotable. Le navigateur ne fournit ni commande, ni service, ni argument, ni profil.

Caddy apparaît dans l'inventaire avec sa santé, mais reste en lecture seule afin que le cockpit ne coupe pas son propre accès HTTPS. Prometheus et Grafana sont des modules facultatifs pilotables. dnsmasq et mkcert restent gérés sur l'hôte. `down`, la suppression des volumes et la réinitialisation de PostgreSQL restent des commandes terminal explicites. Arrêter le processus cockpit avec `Ctrl+C` interrompt les vérifications en cours, mais laisse les conteneurs Compose démarrés.

La suite « Parcours Playwright » lance uniquement `npm run e2e:test -- development`. Elle exige Caddy, le Backend, Commande, le Dashboard et l'Onboarding sains. Le dernier rapport terminé est ensuite consultable sur `REPORTS_URL`, soit `https://reports.surplasse.test` avec le profil actuel. Avant le premier rapport, cette URL répond 404. Les résultats et l'historique restent sous `.surplasse/e2e/development/` sur l'hôte.

Le cockpit ne permet jamais de cibler la production ou une UAT. Utiliser la CLI avec une cible explicite ou `.github/workflows/e2e.yml` pour `production` et `custom`. Le téléchargement et le rejeu d'un artefact de CI restent aussi des opérations CLI.

Les commandes `npm run backend:dev` et `npm run dev` des fronts restent disponibles pour une boucle technique courte hors cockpit. Elles utilisent leurs listeners internes et ne remplacent pas le routage du cluster. Après une telle boucle, reconstruire et valider systématiquement avec `npm run local:up`.

## Données locales

Le volume `surplasse_postgresql_data` conserve le seed et les données entre `stop`, `down` et `up`. Les volumes Caddy conservent son état interne, mais le certificat local reste le fichier mkcert monté en lecture seule.

Pour réinitialiser volontairement toutes les données du cluster local :

```bash
scripts/compose.sh development down --volumes
npm run local:up
```

Cette commande supprime PostgreSQL local. Elle n'a pas d'équivalent dans un déploiement de production normal.

## Linux et Windows avec WSL2

Docker Engine et le plugin Compose sont requis sur Linux. Sous WSL2, Docker Desktop avec intégration WSL2 ou Docker Engine dans la distribution Ubuntu convient. Le dépôt doit rester dans le système de fichiers Linux.

Le script automatique de DNS et certificat reste limité à macOS. Sur Ubuntu avec un navigateur Linux ou WSLg :

```bash
sudo apt update
sudo apt install dnsmasq dnsutils libnss3-tools mkcert

sudo tee /etc/dnsmasq.d/surplasse.conf >/dev/null <<'EOF'
port=53535
listen-address=127.0.0.1
bind-interfaces
no-resolv
no-hosts
local=/surplasse.test/
address=/surplasse.test/127.0.0.1
EOF

sudo systemctl restart dnsmasq
sudo resolvectl dns lo 127.0.0.1:53535
sudo resolvectl domain lo '~surplasse.test'

mkcert -install
mkdir -p .certs
mkcert \
  -cert-file .certs/surplasse.test.pem \
  -key-file .certs/surplasse.test-key.pem \
  surplasse.test '*.surplasse.test'
chmod 600 .certs/surplasse.test-key.pem

npm run local:up
```

Pour un navigateur Windows extérieur à WSL2, il faut en plus faire résoudre le wildcard vers l'adresse accessible de WSL2 et installer l'autorité mkcert WSL2 dans le magasin Windows. Cette étape dépend du mode réseau WSL choisi. La validation de référence utilise un navigateur Linux sous WSLg. Ubuntu LTS fait foi en cas de divergence.

## Désinstaller la configuration macOS

```bash
npm run local:down
npm run local:remove
```

La suppression retire uniquement le resolver, le LaunchAgent dnsmasq et les feuilles mkcert gérés par Surplasse. Elle conserve Docker, Homebrew, les formules partagées et l'autorité mkcert, qui peuvent servir à d'autres projets.
