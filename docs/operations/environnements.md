---
label: Environnements
order: 20
icon: stack
description: Deux environnements seulement, leurs domaines, bord Cloudflare, origine Atlas, profils et secrets.
---

# Environnements

Surplasse connaît deux environnements : le développement local et la production. Il n'existe pas de staging au lancement. Le cluster local exerce les mêmes recettes applicatives et le même contrat de domaines que la cible. La production cible partage son bord entre Cloudflare et son coeur entre Atlas. `vps-infra` possède les états désirés des deux plateformes.

!!! warning État réel au 2026-08-25
La version vérifiée du Worker est uploadée et sert seulement l'Onboarding sur les Routes `surplasse.com/*` et `www.surplasse.com/*`. L'apex répond 200 en IPv4 et IPv6, et HTTP ainsi que `www` redirigent en 308. Aucun Tunnel ou secret Cloudflare n'est installé dans le dépôt. `api`, `dashboard`, `docs` ainsi qu'un slug ne résolvent pas. La publication OCI historique ne prouve pas davantage un Backend dynamique actif. L'ouverture testeurs et l'ouverture publique restent fermées tant que leurs portes respectives ne sont pas prouvées.
!!!

## Comparaison

| | Développement | Production |
|---|---|---|
| Profil | `development` | `production` |
| Domaine racine | `surplasse.test` | `surplasse.com` |
| Hôte | macOS, Linux ou Ubuntu sous WSL2 | Cloudflare pour le bord, Atlas sous Ubuntu LTS pour le coeur |
| Orchestration | `compose.yaml`, `compose.development.yaml` et Wrangler local | candidat Worker et `application-release@sha256`, admis et activés par `vps-infra` |
| Données | Seed réinitialisable, aucune donnée réelle | Données de test persistées sur Atlas en mode testeurs ; données réelles seulement après ouverture publique |
| PostgreSQL | Volume Compose local | Plateforme partagée, base et rôles Surplasse à provisionner |
| Stripe | Mode test exclusivement | Mode test pour la production testeurs, mode live pour l'ouverture publique |
| Email | Mailpit | Relais SMTP transactionnel géré, à sélectionner et activer |
| Certificat | mkcert monté en lecture seule | Universal SSL Cloudflare au bord, TLS d'origine ou Tunnel vers Atlas |
| Services annexes | Mailpit, documentation Nimbus, rapport Allure local sur fichier ; Prometheus 3.13.1 et Grafana 13.1.1 facultatifs | Static Assets au bord ; Prometheus et Grafana privés sur Atlas |
| Artefacts | Tags locaux `development` et bundle Wrangler local | manifeste Worker lié au commit et références digest de l'`application-release` |

Aucune clé live, donnée réelle ou sauvegarde de production ne doit se trouver sur un poste local. Le serveur Onboarding peut créer une courte session Stripe Connect seulement en `development`. Le wrapper exige que cette capacité soit désactivée en `production`.

## Domaines

| Production | Développement | Application |
|---|---|---|
| `surplasse.com` | `surplasse.test` | Onboarding |
| `www.surplasse.com` | `www.surplasse.test` | Redirection 308 vers l'apex |
| `{slug}.surplasse.com` | `{slug}.surplasse.test` | Commande |
| `dashboard.surplasse.com` | `dashboard.surplasse.test` | Dashboard |
| `api.surplasse.com` | `api.surplasse.test` | Backend |
| `docs.surplasse.com` sur Static Assets à la cible | `docs.surplasse.test` dans Compose | Documentation Nimbus canonique |
| réservé, fermé | `local.surplasse.test`, réservé et fermé | Aucun service |
| SMTP externe | `mail.surplasse.test` | Mailpit |
| réservé, fermé | `reports.surplasse.test`, réservé et fermé | Aucun service, rapport Allure ouvert depuis le fichier local |
| aucun domaine public | `grafana.surplasse.test` | Grafana, seulement lorsque le profil `observability` est démarré |

Les noms `www`, `api`, `dashboard`, `docs`, `app`, `admin`, `local`, `mail`, `autoconfig`, `autodiscover`, `mta-sts`, `smtp`, `imap`, `pop`, `pop3`, `webmail`, `status`, `reports` et `grafana` sont réservés et exclus des slugs d'établissement. `app` et `admin` ne correspondent à aucune application actuelle. Les noms techniques sans service public restent fermés en 503 par le Worker cible et par Caddy pendant le retour arrière. `status`, `reports` et `grafana` restent réservés en production même si aucun service ne les y publie.

Le wildcard permet de créer un mini-site sans nouvelle opération DNS. Il couvre un sous-domaine direct, pas un niveau imbriqué. Le Worker cible route l'apex vers Onboarding, `api` vers l'origine Backend, `dashboard` vers Dashboard, `docs` vers Nimbus et tout autre sous-domaine non réservé vers Commande. Caddy conserve le même contrat pendant la migration. Le wildcard DNS peut faire résoudre un nom réservé, mais le routeur le ferme avant Commande.

## Source de vérité

Les fichiers de domaines ne contiennent aucun secret :

| Fichier | Contenu autorisé |
|---|---|
| `config/domains/development.env` | `APP_SCHEME`, `APP_BASE_DOMAIN`, `PROBLEM_TYPE_BASE`, `RESERVED_SUBDOMAINS` |
| `config/domains/production.env` | Les mêmes clés pour la production |

`scripts/run-with-domain-profile.sh` dérive `APP_BASE_URL`, `ONBOARDING_URL`, `DASHBOARD_URL`, `API_URL`, `DOCS_URL` et `CORS_PUBLIC_ORIGINS`. `DOCS_URL` utilise toujours le sous-domaine direct `docs` de `APP_BASE_DOMAIN`. `MAILPIT_URL` et `GRAFANA_URL` existent seulement en développement. Aucun profil ne répète une URL complète.

Les cookies `surplasse_session` et `surplasse_refresh` sont hôte uniquement sur l'API par absence d'attribut `Domain`. Ils restent `Secure`, `HttpOnly`, `SameSite=Lax` et `Path=/`. Définir un domaine parent les exposerait aux mini-sites.

`scripts/compose.sh` applique le profil development avant de lire la configuration locale. Son parseur dotenv n'exécute pas de commande shell. Il refuse dans les fichiers de déploiement et de secrets toute variable appartenant au profil de domaines, ainsi que les variables de contrôle du shell, de git, de Docker ou de Compose. Les builds de release sélectionnent `config/domains/production.env`, jamais une série de remplacements de `.test` par `.com`.

Avant d'appeler le Compose local, le wrapper écrit atomiquement chaque valeur sensible sous un répertoire hôte de mode `0700`. Les copies de montage utilisent le mode `0444` pour rester lisibles par les UID non privilégiés distincts des conteneurs ; le répertoire en interdit l'accès aux autres utilisateurs de l'hôte. Le wrapper ne remplace pas un fichier dont le contenu est inchangé, ce qui préserve les montages actifs lors des commandes de consultation. Le répertoire `.surplasse/compose-secrets/development/` est exclu de git et du contexte de build. Sur Atlas, `vps-infra` matérialise séparément les fichiers protégés sous `/etc/vps/secrets/surplasse/` et les monte sous `/run/secrets/` conformément au fragment de release.

## Configuration de déploiement

| Fichier | Secret | Versionné |
|---|---|---|
| `config/deployment/images.env` | Non | Oui |
| `config/deployment/development.env` | Non, identifiants PostgreSQL jetables seulement | Oui |
| `backend/.env` et `frontends/commande/.env` | Clés Stripe test | Non |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Identité de compte et token borné pour une future activation | Non, absents de la préparation |
| `/etc/vps/secrets/surplasse/` | Cible Atlas des secrets par fichier, actuellement non matérialisée | Non |

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

Le Backend n'accorde jamais les credentials CORS. Caddy à l'origine les ajoute seulement quand `Origin` correspond exactement à l'Onboarding ou au Dashboard du profil. Le Worker transmet ces réponses sans les reconstruire. Les mini-sites utilisent les routes publiques sans credentials.

## Frontends

Commande et Dashboard ne reçoivent aucun secret à l'exécution. Le profil de domaine, le mode public versionné et la clé Stripe publiable de Commande sont injectés pendant le build Vite. En mode `testers`, la variable de dépôt GitHub `VITE_STRIPE_PUBLISHABLE_KEY` est obligatoire, doit commencer par `pk_test_` et ne doit contenir aucun espace. En mode `public`, elle doit commencer par `pk_live_`. Le workflow refuse le préfixe opposé, fige le SHA-256 de la clé pour toute l'exécution, puis suit le script chargé par `index.html` afin d'exiger la valeur exacte dans l'image Commande scannée et dans le digest publié. Ce contrôle de format et d'intégrité ne prouve ni l'existence de la clé chez Stripe, ni son compte. Ces deux points doivent être qualifiés avec la clé secrète Backend du même mode. Le Dashboard ne reçoit pas la clé. Onboarding, Commande et Dashboard reçoivent le mode afin d'afficher la bannière de production testeurs. Le Dockerfile accepte seulement `development` ou `production`. Toute variable Vite qui tente de redéfinir un domaine ou une URL dérivée fait échouer le build.

L'Onboarding charge un `runtime-config.js` généré pour un seul profil pendant la construction de son image ou du bundle Static Assets. En développement, son serveur Node reçoit aussi `DEPLOYMENT_PROFILE`, valide le `Host` canonique et peut fournir la courte session Stripe test. En production testeurs, aucun processus Node, secret Stripe ou endpoint de session n'entre dans le bundle. Le fichier multi-profil versionné sert au développement natif, refuse les hostnames inconnus et n'est jamais copié tel quel dans le candidat de production. GitHub Pages et Cloudflare génèrent explicitement une variante production pendant leur build.

Changer une valeur publique impose de reconstruire Commande et Dashboard. Cela ne justifie aucun littéral dans leur code : le chargeur central fournit toutes les valeurs.

## Cibles de test et future UAT

Les environnements applicatifs et les cibles E2E ne se confondent pas. `development` et `production` sélectionnent les profils versionnés ci-dessus. Le lanceur Playwright accepte en plus `custom`, avec un nom de cible et un domaine racine explicites, pour rejouer les mêmes contrôles sur un serveur distinct. L'identifiant d'historique interne combine ce nom avec une empreinte du domaine afin d'isoler deux serveurs même si leur nom est réutilisé.

Cette souplesse ne crée pas un troisième environnement. Une future UAT exigera une décision opérationnelle, un profil de domaines applicatif, une surcharge ou une configuration Compose cohérente, des images reconstruites pour son domaine et Stripe en mode test. Une fois cette pile disponible, `SURPLASSE_E2E_TARGET_ID` et `SURPLASSE_E2E_BASE_DOMAIN` suffiront à lui affecter un rapport et un historique Allure propres, sans modifier les tests.

Les smokes de production et d'une UAT ne partagent jamais `history.jsonl`. Le domaine `custom` garde une validation TLS stricte et ne peut redéfinir les profils connus. Le détail des commandes est dans [Tests](../developpement/tests.md).

Le développement, la production et une UAT sont testés par la CLI ou GitHub Actions avec une cible explicite. Chaque cible conserve directement `.surplasse/e2e/<id>/history.jsonl`, `.surplasse/e2e/<id>/allure-report/` et `.surplasse/e2e/<id>/test-results/`. Un rapport CI reste un artefact à télécharger et rejouer, jamais un contenu synchronisé vers `reports.surplasse.test`.

## Observabilité {#observabilite}

En développement, Prometheus et Grafana appartiennent au profil Compose facultatif `observability`. Leurs adresses internes sont des noms de services, pas des URL de profil : Prometheus collecte `http://backend:8080/q/metrics` et Grafana interroge `http://prometheus:9090` sur le réseau interne `observability`. Le Backend ne reçoit aucune adresse Prometheus ou Grafana. En production, `vps-infra` possède leurs services et leur configuration d'exécution.

| Variable | Développement | Production | Rôle |
|---|---|---|---|
| `PROMETHEUS_RETENTION_TIME` | `7d` | Valeur de plateforme `vps-infra` | Fenêtre de rétention des séries, bornée par environnement |
| `GRAFANA_ADMIN_USER` | Identifiant jetable versionné | Secret de plateforme | Compte administrateur initial |
| `GRAFANA_ADMIN_PASSWORD` | Mot de passe jetable versionné | Secret fort de plateforme | Mot de passe administrateur initial |
| `GRAFANA_SECRET_KEY` | Valeur jetable versionnée | Secret aléatoire et stable de plateforme | Clé interne de chiffrement et de signature Grafana |
| `GRAFANA_BIND_ADDRESS` | Absente, aucun port hôte | Valeur privée de plateforme | Adresse privée d'écoute du port Grafana sur le VPS |
| `GRAFANA_PORT` | Absent, accès par Caddy | Valeur du runbook `vps-infra` | Extrémité distante du tunnel SSH |

En développement, `GRAFANA_URL` est dérivée du domaine central. Caddy termine HTTPS et Grafana autorise la lecture anonyme avec le rôle `Viewer`. Le compte administrateur local reste disponible pour contrôler le provisionnement, mais ses valeurs jetables ne doivent jamais être reprises ailleurs.

En production, `GRAFANA_URL` n'existe pas et aucune route Caddy publique n'existe. L'accès anonyme est désactivé. Le port et les commandes d'accès viennent du runbook `vps-infra`. Prometheus ne publie aucun port hôte dans les deux environnements.

Les volumes `prometheus_data` et `grafana_data` sont persistants mais reconstructibles. Leur perte efface respectivement les séries temporelles et les préférences ou sessions de l'interface. Les règles, la source et le tableau de bord sont reprovisionnés depuis git. PostgreSQL reste la seule sauvegarde métier critique.

## PostgreSQL

| Variable | Rôle |
|---|---|
| `POSTGRES_DB` | Nom de la base |
| `POSTGRES_USER` | Utilisateur du conteneur et des sauvegardes |
| `POSTGRES_PASSWORD` | Source du secret Compose monté dans `POSTGRES_PASSWORD_FILE`, jetable en local et secret en production |

Le volume `postgresql_data` persiste en local et peut y être supprimé volontairement. Atlas possède le volume de production, sa sauvegarde et sa restauration selon [Déploiement Atlas](deploiement-compose.md).

## Cloudflare, Caddy et DNS

La zone utilise les serveurs de noms Cloudflare. La cible demande un apex proxifié, un wildcard proxifié et un enregistrement spécifique `api` vers l'origine ou Tunnel. Les deux Routes Worker couvrent `surplasse.com/*` et `*.surplasse.com/*`. Les enregistrements et Routes exacts appartiennent à `vps-infra` et doivent garder un snapshot de retour arrière.

Cloudflare termine TLS public. Caddy conserve TLS d'origine pendant la première bascule, puis devient privé derrière Cloudflare Tunnel après qualification. Le port entrant Atlas ne ferme qu'après preuve des webhooks Stripe, des cookies et du SSE à travers Tunnel. La procédure locale dnsmasq et mkcert reste décrite dans [Domaines locaux](../developpement/domaines-locaux.md). Le détail des portes vit dans [Migration Cloudflare](migration-cloudflare.md).

## Rotation des clés JWT

La rotation conserve une double vérification temporaire, jamais deux clés de signature actives :

1. Générer une nouvelle paire hors du conteneur avec un nouveau `kid`.
2. Ajouter la nouvelle clé publique au JWKS en conservant la précédente.
3. Remplacer les fichiers montés et `AUTH_JWT_KEY_ID`, puis recréer le Backend.
4. Utiliser la sonde interne bornée de `vps-infra` pour vérifier la readiness du Backend, puis confirmer que `https://api.surplasse.com/q/health/ready` répond publiquement `404`.
5. Attendre plus de 15 minutes, retirer l'ancienne clé du JWKS et recréer le Backend.

Une suspicion de fuite déclenche immédiatement la même procédure. La clé privée précédente est retirée du VPS après validation.
