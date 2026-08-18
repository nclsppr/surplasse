---
label: Environnements
order: 20
icon: stack
description: Deux environnements seulement, leurs domaines, certificats, profils de configuration et secrets.
---

# Environnements

Surplasse connaît deux environnements : le développement local et la production. Il n'existe pas de staging au lancement. Le cluster local exerce les mêmes recettes applicatives et le même contrat de domaines que la cible de production. Sur Atlas, le bundle applicatif rejoint une plateforme Caddy, PostgreSQL et observabilité possédée par `vps-infra`. Le Compose historique du monorepo n'est pas la commande d'exploitation d'Atlas.

!!! warning État réel au 2026-08-18
Atlas et sa plateforme partagée existent. Le candidat Surplasse est publié par digest, mais son entrée de production reste `enabled: false` dans `vps-infra`. Aucun service, base, rôle, secret, certificat wildcard, route ou DNS Surplasse n'y est encore prouvé actif. L'ADR-0041 autorise une production réservée aux testeurs avec Stripe test et sauvegardes locales. L'ouverture publique reste bloquée par Stripe live, le SMTP transactionnel, la sauvegarde hors site, les CSP de Commande et du Dashboard, les rattachements réseau et les sondes publiques strictes.
!!!

## Comparaison

| | Développement | Production |
|---|---|---|
| Profil | `development` | `production` |
| Domaine racine | `surplasse.test` | `surplasse.com` |
| Hôte | macOS, Linux ou Ubuntu sous WSL2 | Atlas, VPS Ubuntu LTS provisionné, application désactivée |
| Orchestration | `compose.yaml` et `compose.development.yaml` | `application-release@sha256` admise et activée uniquement par `vps-infra` |
| Données | Seed réinitialisable, aucune donnée réelle | Données de test persistées sur Atlas en mode testeurs ; données réelles seulement après ouverture publique |
| PostgreSQL | Volume Compose local | Plateforme partagée, base et rôles Surplasse à provisionner |
| Stripe | Mode test exclusivement | Mode test pour la production testeurs, mode live pour l'ouverture publique |
| Email | Mailpit | Relais SMTP transactionnel géré, à sélectionner et activer |
| Certificat | mkcert monté en lecture seule | Cible Let's Encrypt wildcard par DNS-01 OVH, non activée pour Surplasse |
| Services annexes | Mailpit, documentation Nimbus, cockpit et rapport Allure development sur l'hôte ; Prometheus 3.13.1 et Grafana 13.1.1 facultatifs | Image de documentation, cible et règles Prometheus et tableau de bord Grafana publiés ; runtimes Atlas Prometheus 3.13.2 et Grafana 13.1.3 possédés par `vps-infra` ; intégration Surplasse inactive |
| Images applicatives | Tags locaux `development` | Références digest liées par `application-release` |

Aucune clé live, donnée réelle ou sauvegarde de production ne doit se trouver sur un poste local. Le serveur Onboarding peut créer une courte session Stripe Connect seulement en `development`. Le wrapper exige que cette capacité soit désactivée en `production`.

## Domaines

| Production | Développement | Application |
|---|---|---|
| `surplasse.com` | `surplasse.test` | Onboarding |
| `www.surplasse.com` | `www.surplasse.test` | Redirection 308 vers l'apex |
| `{slug}.surplasse.com` | `{slug}.surplasse.test` | Commande |
| `dashboard.surplasse.com` | `dashboard.surplasse.test` | Dashboard |
| `api.surplasse.com` | `api.surplasse.test` | Backend |
| `docs.surplasse.com` dans Compose | `docs.surplasse.test` dans Compose | Documentation Nimbus canonique |
| absent | `local.surplasse.test` | Cockpit de développement |
| SMTP externe | `mail.surplasse.test` | Mailpit |
| absent | `reports.surplasse.test` | Dernier rapport Allure development servi par le cockpit |
| aucun domaine public | `grafana.surplasse.test` | Grafana, seulement lorsque le profil `observability` est démarré |

Les noms `www`, `api`, `dashboard`, `docs`, `app`, `admin`, `local`, `mail`, `autoconfig`, `autodiscover`, `mta-sts`, `smtp`, `imap`, `pop`, `pop3`, `webmail`, `status`, `reports` et `grafana` sont réservés et exclus des slugs d'établissement. `app` et `admin` ne correspondent à aucune application actuelle. Les noms techniques sans service public restent fermés en 503 sur Caddy. `status`, `reports` et `grafana` restent réservés en production même si aucun service ne les y publie.

Le wildcard permet de créer un mini-site sans nouvelle opération DNS. Il couvre un sous-domaine direct, pas un niveau imbriqué. Caddy route l'apex vers l'Onboarding, `api` vers le Backend, `dashboard` vers le Dashboard, `docs` vers Nimbus et tout autre sous-domaine non réservé vers Commande. Le wildcard DNS peut faire résoudre un nom réservé, mais la route applicative le ferme avant le handler de Commande.

## Source de vérité

Les fichiers de domaines ne contiennent aucun secret :

| Fichier | Contenu autorisé |
|---|---|
| `config/domains/development.env` | `APP_SCHEME`, `APP_BASE_DOMAIN`, `PROBLEM_TYPE_BASE`, `COOKIE_DOMAIN`, `RESERVED_SUBDOMAINS` |
| `config/domains/production.env` | Les mêmes clés pour la production |

`scripts/run-with-domain-profile.sh` dérive `APP_BASE_URL`, `ONBOARDING_URL`, `DASHBOARD_URL`, `API_URL`, `DOCS_URL` et `CORS_PUBLIC_ORIGINS`. `DOCS_URL` utilise toujours le sous-domaine direct `docs` de `APP_BASE_DOMAIN`. `LOCAL_CONTROL_URL`, `MAILPIT_URL`, `REPORTS_URL` et `GRAFANA_URL` existent seulement en développement. Aucun profil ne répète une URL complète.

`COOKIE_DOMAIN` reste vide. Les cookies `surplasse_session` et `surplasse_refresh` sont hôte uniquement sur l'API, `Secure`, `HttpOnly`, `SameSite=Lax` et `Path=/`. Définir un domaine parent les exposerait aux mini-sites.

`scripts/compose.sh` applique le profil avant de lire la configuration de déploiement. Son parseur dotenv n'exécute pas de commande shell. Il refuse dans les fichiers de déploiement et de secrets toute variable appartenant au profil de domaines, ainsi que les variables de contrôle du shell, de git, de Docker ou de Compose. Le passage en production sélectionne `production`, jamais une série de remplacements de `.test` par `.com`.

Avant d'appeler Compose, le wrapper écrit atomiquement chaque valeur sensible sous un répertoire hôte de mode `0700`. Les copies de montage utilisent le mode `0444` pour rester lisibles par les UID non privilégiés distincts des conteneurs ; le répertoire en interdit l'accès aux autres utilisateurs de l'hôte. Le wrapper ne remplace pas un fichier dont le contenu est inchangé, ce qui préserve les montages actifs lors des commandes de consultation. Le répertoire local `.surplasse/compose-secrets/development/` est exclu de git et du contexte de build. Le répertoire de production `/etc/surplasse/secrets/compose/` reste sur le VPS. Compose utilise ces seuls fichiers comme sources et les monte en lecture seule sous `/run/secrets`. Le fichier d'environnement, la clé TLS locale et la clé JWT privée de production d'origine restent en mode `0600`. Le processus `docker compose` ne reçoit plus les valeurs directes après cette matérialisation.

## Configuration de déploiement

| Fichier | Secret | Versionné |
|---|---|---|
| `config/deployment/images.env` | Non | Oui |
| `config/deployment/development.env` | Non, identifiants PostgreSQL jetables seulement | Oui |
| `backend/.env` et `frontends/commande/.env` | Clés Stripe test | Non |
| `/etc/surplasse/production.env` | Chemin du Compose historique, non utilisé pour Atlas | Non |
| `/etc/vps/secrets/surplasse/` | Cible Atlas des secrets par fichier, actuellement non matérialisée | Non |
| `config/deployment/production.env.example` | Non, modèle sans valeur réelle | Oui |

Le catalogue d'images épingle chaque base par version et digest. Les paramètres réseau, ports et noms d'image restent variables. Les adresses de services telles que `postgresql:5432` sont des noms internes au graphe Compose, pas des références à un environnement public.

## Backend

Le Backend reçoit au démarrage les valeurs dérivées du profil, puis les paramètres suivants. À la frontière Compose, les six valeurs sensibles du tableau utilisent un secret sous `/run/secrets` et une variable `*_FILE`. Le point d'entrée les charge seulement au démarrage du processus :

| Variable | Rôle |
|---|---|
| `QUARKUS_DATASOURCE_JDBC_URL` | URL JDBC interne, construite par Compose |
| `QUARKUS_DATASOURCE_USERNAME` | Utilisateur PostgreSQL |
| `QUARKUS_DATASOURCE_PASSWORD` | Mot de passe PostgreSQL |
| `TRUSTED_PROXIES` | Adresse interne exacte du Caddy de la pile |
| `STRIPE_SECRET_KEY` | Clé Stripe test ou live selon le profil |
| `STRIPE_PAYMENT_WEBHOOK_SECRET` | Secret de la destination des paiements |
| `STRIPE_ACCOUNT_WEBHOOK_SECRET` | Secret de la destination Accounts v2 |
| `STRIPE_LIVE_MODE` | `false` en développement et pour la production testeurs, `true` pour l'ouverture publique |
| `AUTH_JWT_PRIVATE_KEY_PATH` | Chemin interne de la clé privée montée en lecture seule |
| `AUTH_JWT_JWKS_PATH` | Chemin interne du JWKS monté en lecture seule |
| `AUTH_JWT_KEY_ID` | `kid` de la clé de signature courante |
| `AUTH_JWT_AUDIENCE` | Audience du Dashboard |
| `SMTP_HOST`, `SMTP_PORT` | Destination SMTP |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | Identifiants SMTP de production |
| `SMTP_FROM` | Adresse expéditrice |
| `SMTP_TLS`, `SMTP_START_TLS` | Politique de chiffrement SMTP |

En développement, Quarkus génère une paire JWT éphémère et envoie à `mailpit:1025`. Sur Atlas, les fichiers JWT, PostgreSQL, Stripe et SMTP doivent vivre sous `/etc/vps/secrets/surplasse/`, avec une allocation distincte entre migrateur, runtime et services statiques. Ils sont montés sous `/run/secrets/` dans les conteneurs. Aucun de ces fichiers n'est matérialisé tant que l'activation reste bloquée. Les chemins hôte et les valeurs ne sont jamais intégrés à l'image.

Le Backend n'accorde jamais les credentials CORS. Caddy les ajoute seulement quand `Origin` correspond exactement à l'Onboarding ou au Dashboard du profil. Les mini-sites utilisent les routes publiques sans credentials.

## Frontends

Commande et Dashboard ne reçoivent aucun secret à l'exécution. Le profil de domaine, le mode public versionné et la clé Stripe publiable de Commande sont injectés pendant le build Vite. En mode `testers`, la variable de dépôt GitHub `VITE_STRIPE_PUBLISHABLE_KEY` est obligatoire, doit commencer par `pk_test_` et ne doit contenir aucun espace. En mode `public`, elle doit commencer par `pk_live_`. Le workflow refuse le préfixe opposé, fige le SHA-256 de la clé pour toute l'exécution, puis suit le script chargé par `index.html` afin d'exiger la valeur exacte dans l'image Commande scannée et dans le digest publié. Ce contrôle de format et d'intégrité ne prouve ni l'existence de la clé chez Stripe, ni son compte. Ces deux points doivent être qualifiés avec la clé secrète Backend du même mode. Le Dashboard ne reçoit pas la clé. Onboarding, Commande et Dashboard reçoivent le mode afin d'afficher la bannière de production testeurs. Le Dockerfile accepte seulement `development` ou `production`. Toute variable Vite qui tente de redéfinir un domaine ou une URL dérivée fait échouer le build.

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
| `POSTGRES_PASSWORD` | Source du secret Compose monté dans `POSTGRES_PASSWORD_FILE`, jetable en local et secret en production |

Le volume `postgresql_data` persiste dans les deux environnements. Il peut être supprimé volontairement en local. Il est sauvegardé et restauré selon [Déploiement Compose](deploiement-compose.md) en production.

## Caddy et DNS

La production crée deux enregistrements publics :

```text
surplasse.com.        A      <IP du VPS>
*.surplasse.com.      A      <IP du VPS>
```

Le certificat wildcard de `surplasse.com` couvre `docs.surplasse.com` et exige le défi DNS-01. La plateforme Atlas a retenu OVH et construit Caddy avec le module `caddy-dns/ovh` épinglé. La décision de fournisseur n'est donc plus ouverte. En revanche, l'identité ACME bornée à la zone, ses secrets, la route wildcard et la bascule des enregistrements Surplasse ne sont pas activés. Ils restent des portes de production appartenant à `vps-infra`.

Caddy persiste son état ACME dans `caddy_data`. Une sonde externe doit surveiller l'expiration du certificat. La procédure locale dnsmasq et mkcert vit dans [Domaines locaux](../developpement/domaines-locaux.md).

## Rotation des clés JWT

La rotation conserve une double vérification temporaire, jamais deux clés de signature actives :

1. Générer une nouvelle paire hors du conteneur avec un nouveau `kid`.
2. Ajouter la nouvelle clé publique au JWKS en conservant la précédente.
3. Remplacer les fichiers montés et `AUTH_JWT_KEY_ID`, puis recréer le Backend.
4. Vérifier `https://api.surplasse.com/q/health/ready`.
5. Attendre plus de 15 minutes, retirer l'ancienne clé du JWKS et recréer le Backend.

Une suspicion de fuite déclenche immédiatement la même procédure. La clé privée précédente est retirée du VPS après validation.
