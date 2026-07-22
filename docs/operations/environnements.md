---
label: Environnements
order: 20
icon: stack
description: Deux environnements seulement, leurs domaines, certificats, profils de configuration et secrets.
---

# Environnements

Surplasse connaît deux environnements : le développement local et la production. Il n'existe pas de staging au lancement. Le cluster local et la production utilisent le même `compose.yaml`, les mêmes recettes applicatives et le même routage Caddy. Une surcharge explicite porte les différences de TLS, d'exposition et de services annexes. L'image Caddy de production ajoute seulement le module du fournisseur DNS retenu.

!!! warning État réel au 2026-07-22
Le cluster Compose local est implémenté et validé sous `surplasse.test`. La surcharge production, les images et le runbook Ubuntu sont versionnés, mais aucun VPS public n'est provisionné. Le premier trafic public reste bloqué par le choix du fournisseur DNS et de son module Caddy, le SMTP transactionnel, la publication des images GHCR, les CSP de Commande et du Dashboard et la mise en place des sauvegardes hors site.
!!!

## Comparaison

| | Développement | Production |
|---|---|---|
| Profil | `development` | `production` |
| Domaine racine | `surplasse.test` | `surplasse.com` |
| Hôte | macOS, Linux ou Ubuntu sous WSL2 | VPS Ubuntu LTS |
| Orchestration | `compose.yaml` et `compose.development.yaml` | `compose.yaml` et `compose.production.yaml` |
| Données | Seed réinitialisable, aucune donnée réelle | Données réelles, sauvegarde quotidienne |
| PostgreSQL | Volume Compose local | Volume Compose persistant |
| Stripe | Mode test exclusivement | Mode live exclusivement |
| Email | Mailpit | Fournisseur SMTP transactionnel |
| Certificat | mkcert monté en lecture seule | Let's Encrypt wildcard par DNS-01 |
| Services annexes | Mailpit, documentation, cockpit et rapport Allure development sur l'hôte ; Prometheus et Grafana facultatifs | Prometheus et Grafana facultatifs ; Grafana sur loopback seulement |
| Images applicatives | Tags locaux `development` | Tags immuables par SHA git |

Aucune clé live, donnée réelle ou sauvegarde de production ne doit se trouver sur un poste local. Le serveur Onboarding peut créer une courte session Stripe Connect seulement en `development`. Le wrapper exige que cette capacité soit désactivée en `production`.

## Domaines

| Production | Développement | Application |
|---|---|---|
| `surplasse.com` | `surplasse.test` | Onboarding |
| `www.surplasse.com` | `www.surplasse.test` | Redirection 308 vers l'apex |
| `{slug}.surplasse.com` | `{slug}.surplasse.test` | Commande |
| `dashboard.surplasse.com` | `dashboard.surplasse.test` | Dashboard |
| `api.surplasse.com` | `api.surplasse.test` | Backend |
| `docs.surplasse.com` sur GitHub Pages | `docs.surplasse.test` dans Compose | Documentation |
| absent | `local.surplasse.test` | Cockpit de développement |
| SMTP externe | `mail.surplasse.test` | Mailpit |
| absent | `reports.surplasse.test` | Dernier rapport Allure development servi par le cockpit |
| aucun domaine public | `grafana.surplasse.test` | Grafana, seulement lorsque le profil `observability` est démarré |

Les noms `www`, `api`, `dashboard`, `docs`, `app`, `admin`, `local`, `mail`, `reports` et `grafana` sont réservés et exclus des slugs d'établissement. `app` et `admin` ne correspondent à aucune application actuelle. `reports` et `grafana` restent réservés en production même si aucun service ne les y publie.

Le wildcard permet de créer un mini-site sans nouvelle opération DNS. Il couvre un sous-domaine direct, pas un niveau imbriqué. Caddy route l'apex vers l'Onboarding, `api` vers le Backend, `dashboard` vers le Dashboard et tout autre sous-domaine non réservé vers Commande.

## Source de vérité

Les fichiers de domaines ne contiennent aucun secret :

| Fichier | Contenu autorisé |
|---|---|
| `config/domains/development.env` | `APP_SCHEME`, `APP_BASE_DOMAIN`, `PROBLEM_TYPE_BASE`, `COOKIE_DOMAIN`, `RESERVED_SUBDOMAINS` |
| `config/domains/production.env` | Les mêmes clés pour la production |

`scripts/run-with-domain-profile.sh` dérive `APP_BASE_URL`, `ONBOARDING_URL`, `DASHBOARD_URL`, `API_URL`, `DOCS_URL` et `CORS_PUBLIC_ORIGINS`. `LOCAL_CONTROL_URL`, `MAILPIT_URL`, `REPORTS_URL` et `GRAFANA_URL` existent seulement en développement. Aucun profil ne répète une URL complète.

`COOKIE_DOMAIN` reste vide. Les cookies `surplasse_session` et `surplasse_refresh` sont hôte uniquement sur l'API, `Secure`, `HttpOnly`, `SameSite=Lax` et `Path=/`. Définir un domaine parent les exposerait aux mini-sites.

`scripts/compose.sh` applique le profil avant de lire la configuration de déploiement. Son parseur dotenv n'exécute pas de commande shell. Il refuse dans les fichiers de déploiement et de secrets toute variable appartenant au profil de domaines, ainsi que les variables de contrôle du shell, de git, de Docker ou de Compose. Le passage en production sélectionne `production`, jamais une série de remplacements de `.test` par `.com`.

## Configuration de déploiement

| Fichier | Secret | Versionné |
|---|---|---|
| `config/deployment/images.env` | Non | Oui |
| `config/deployment/development.env` | Non, identifiants PostgreSQL jetables seulement | Oui |
| `backend/.env` et `frontends/commande/.env` | Clés Stripe test | Non |
| `/etc/surplasse/production.env` | Secrets et paramètres du VPS | Non |
| `config/deployment/production.env.example` | Non, modèle sans valeur réelle | Oui |

Le catalogue d'images épingle chaque base par version et digest. Les paramètres réseau, ports et noms d'image restent variables. Les adresses de services telles que `postgresql:5432` sont des noms internes au graphe Compose, pas des références à un environnement public.

## Backend

Le Backend reçoit au démarrage les valeurs dérivées du profil, puis les paramètres suivants :

| Variable | Rôle |
|---|---|
| `QUARKUS_DATASOURCE_JDBC_URL` | URL JDBC interne, construite par Compose |
| `QUARKUS_DATASOURCE_USERNAME` | Utilisateur PostgreSQL |
| `QUARKUS_DATASOURCE_PASSWORD` | Mot de passe PostgreSQL |
| `TRUSTED_PROXIES` | Adresse interne exacte du Caddy de la pile |
| `STRIPE_SECRET_KEY` | Clé Stripe test ou live selon le profil |
| `STRIPE_PAYMENT_WEBHOOK_SECRET` | Secret de la destination des paiements |
| `STRIPE_ACCOUNT_WEBHOOK_SECRET` | Secret de la destination Accounts v2 |
| `STRIPE_LIVE_MODE` | `false` en développement, `true` obligatoire en production |
| `AUTH_JWT_PRIVATE_KEY_PATH` | Chemin interne de la clé privée montée en lecture seule |
| `AUTH_JWT_JWKS_PATH` | Chemin interne du JWKS monté en lecture seule |
| `AUTH_JWT_KEY_ID` | `kid` de la clé de signature courante |
| `AUTH_JWT_AUDIENCE` | Audience du Dashboard |
| `SMTP_HOST`, `SMTP_PORT` | Destination SMTP |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | Identifiants SMTP de production |
| `SMTP_FROM` | Adresse expéditrice |
| `SMTP_TLS`, `SMTP_START_TLS` | Politique de chiffrement SMTP |

En développement, Quarkus génère une paire JWT éphémère et envoie à `mailpit:1025`. En production, les deux fichiers JWT vivent sous `/etc/surplasse/secrets/` sur l'hôte et sont montés sous `/run/secrets/` dans le conteneur. Les chemins hôte ne sont jamais intégrés à l'image.

Le Backend n'accorde jamais les credentials CORS. Caddy les ajoute seulement quand `Origin` correspond exactement à l'Onboarding ou au Dashboard du profil. Les mini-sites utilisent les routes publiques sans credentials.

## Frontends

Commande et Dashboard ne reçoivent aucun secret à l'exécution. Le profil de domaine et la clé Stripe publiable de Commande sont injectés pendant le build Vite. Le Dockerfile accepte seulement `development` ou `production`. Toute variable Vite qui tente de redéfinir un domaine ou une URL dérivée fait échouer le build.

L'Onboarding charge un `runtime-config.js` généré pour un seul profil pendant la construction de son image. En développement, son serveur Node reçoit aussi `DEPLOYMENT_PROFILE`, valide le `Host` canonique et peut fournir la courte session Stripe test. En production, le même Dockerfile sélectionne une étape NGINX statique : aucun processus Node, secret Stripe ou endpoint de session n'entre dans l'image finale. Le fichier multi-profil versionné sert au développement natif, refuse les hostnames inconnus et n'est jamais copié tel quel dans l'image de production. GitHub Pages génère explicitement une variante production pendant son build.

Changer une valeur publique impose de reconstruire Commande et Dashboard. Cela ne justifie aucun littéral dans leur code : le chargeur central fournit toutes les valeurs.

## Cibles de test et future UAT

Les environnements applicatifs et les cibles E2E ne se confondent pas. `development` et `production` sélectionnent les profils versionnés ci-dessus. Le lanceur Playwright accepte en plus `custom`, avec un nom de cible et un domaine racine explicites, pour rejouer les mêmes contrôles sur un serveur distinct. L'identifiant d'historique interne combine ce nom avec une empreinte du domaine afin d'isoler deux serveurs même si leur nom est réutilisé.

Cette souplesse ne crée pas un troisième environnement. Une future UAT exigera une décision opérationnelle, un profil de domaines applicatif, une surcharge ou une configuration Compose cohérente, des images reconstruites pour son domaine et Stripe en mode test. Une fois cette pile disponible, `SURPLASSE_E2E_TARGET_ID` et `SURPLASSE_E2E_BASE_DOMAIN` suffiront à lui affecter un rapport et un historique Allure propres, sans modifier les tests.

Les smokes de production et d'une UAT ne partagent jamais `history.jsonl`. Le domaine `custom` garde une validation TLS stricte et ne peut redéfinir les profils connus. Le détail des commandes est dans [Tests](../developpement/tests.md).

Le cockpit local ne change pas cette séparation. Il lance exclusivement la cible `development` et sert seulement son dernier rapport sur `REPORTS_URL`. Une production ou une UAT est testée par la CLI ou GitHub Actions. Son rapport reste un artefact à télécharger et rejouer, jamais un contenu synchronisé vers `reports.surplasse.test`.

## Observabilité {#observabilite}

Prometheus et Grafana appartiennent au profil Compose facultatif `observability`. Leurs adresses internes sont des noms de services, pas des URL de profil : Prometheus collecte `http://backend:8080/q/metrics` et Grafana interroge `http://prometheus:9090` sur le réseau interne `observability`. Le Backend ne reçoit aucune adresse Prometheus ou Grafana.

| Variable | Développement | Production | Rôle |
|---|---|---|---|
| `PROMETHEUS_RETENTION_TIME` | `7d` | `15d` dans l'exemple | Fenêtre de rétention des séries, bornée par environnement |
| `GRAFANA_ADMIN_USER` | Identifiant jetable versionné | Secret exigé seulement à l'activation du profil | Compte administrateur initial |
| `GRAFANA_ADMIN_PASSWORD` | Mot de passe jetable versionné | Secret fort exigé seulement à l'activation du profil | Mot de passe administrateur initial |
| `GRAFANA_SECRET_KEY` | Valeur jetable versionnée | Secret aléatoire et stable exigé seulement à l'activation du profil | Clé interne de chiffrement et de signature Grafana |
| `GRAFANA_BIND_ADDRESS` | Absente, aucun port hôte | `127.0.0.1`, validée à l'activation | Adresse privée d'écoute du port Grafana sur le VPS |
| `GRAFANA_PORT` | Absent, accès par Caddy | `3000` dans l'exemple, validé à l'activation | Extrémité distante du tunnel SSH |

En développement, `GRAFANA_URL` est dérivée du domaine central. Caddy termine HTTPS et Grafana autorise la lecture anonyme avec le rôle `Viewer`. Le compte administrateur local reste disponible pour contrôler le provisionnement, mais ses valeurs jetables ne doivent jamais être reprises ailleurs.

En production, `GRAFANA_URL` est vide et aucune route Caddy n'existe. L'accès anonyme est désactivé. Le port est lié à la boucle locale du VPS et atteint par tunnel SSH. Lorsqu'une commande démarre Prometheus ou Grafana, le wrapper refuse une autre adresse de liaison, un port hors plage ou un secret Grafana absent ou laissé à `change-me`. Ces valeurs ne sont pas requises pour démarrer ou mettre à jour la pile applicative sans le profil. Prometheus ne publie aucun port hôte dans les deux environnements.

Les volumes `prometheus_data` et `grafana_data` sont persistants mais reconstructibles. Leur perte efface respectivement les séries temporelles et les préférences ou sessions de l'interface. Les règles, la source et le tableau de bord sont reprovisionnés depuis git. PostgreSQL reste la seule sauvegarde métier critique.

## PostgreSQL

| Variable | Rôle |
|---|---|
| `POSTGRES_DB` | Nom de la base |
| `POSTGRES_USER` | Utilisateur du conteneur et des sauvegardes |
| `POSTGRES_PASSWORD` | Mot de passe, jetable en local et secret en production |

Le volume `postgresql_data` persiste dans les deux environnements. Il peut être supprimé volontairement en local. Il est sauvegardé et restauré selon [Déploiement Compose](deploiement-compose.md) en production.

## Caddy et DNS

La production crée deux enregistrements publics :

```text
surplasse.com.        A      <IP du VPS>
*.surplasse.com.      A      <IP du VPS>
```

Le certificat wildcard exige le défi DNS-01. `CADDY_DNS_MODULE` sélectionne le module ajouté par `xcaddy` avec une version ou un commit explicite, `CADDY_DNS_PROVIDER` sélectionne sa directive et `DNS_API_TOKEN` autorise seulement la modification de la zone nécessaire. Ces trois variables sont obligatoires. Le dépôt ne fournit aucune valeur implicite tant que le fournisseur n'est pas choisi.

Caddy persiste son état ACME dans `caddy_data`. Une sonde externe doit surveiller l'expiration du certificat. La procédure locale dnsmasq et mkcert vit dans [Domaines locaux](../developpement/domaines-locaux.md).

## Rotation des clés JWT

La rotation conserve une double vérification temporaire, jamais deux clés de signature actives :

1. Générer une nouvelle paire hors du conteneur avec un nouveau `kid`.
2. Ajouter la nouvelle clé publique au JWKS en conservant la précédente.
3. Remplacer les fichiers montés et `AUTH_JWT_KEY_ID`, puis recréer le Backend.
4. Vérifier `https://api.surplasse.com/q/health/ready`.
5. Attendre plus de 15 minutes, retirer l'ancienne clé du JWKS et recréer le Backend.

Une suspicion de fuite déclenche immédiatement la même procédure. La clé privée précédente est retirée du VPS après validation.
