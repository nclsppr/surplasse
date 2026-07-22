---
label: Déploiement Compose
order: 15
icon: container
description: Construction, configuration, démarrage, mise à jour, retour arrière et sauvegarde de la pile Docker Compose sur Ubuntu LTS.
---

# Déploiement Docker Compose

La pile versionnée est maintenant exécutable. Elle sert au cluster local et constitue le socle du futur VPS. Son profil facultatif `observability` ajoute Prometheus et Grafana sans modifier les dépendances ni la readiness de la pile applicative. La production réelle n'est pas encore provisionnée : le fournisseur DNS, son module Caddy, le SMTP transactionnel, les CSP de Commande et du Dashboard, les sauvegardes hors site, la sonde externe avec son canal d'alerte et les images GHCR doivent être configurés avant le premier trafic réel.

L'[ADR-0026](../decisions/adr-0026-compose-commun.md) fixe le modèle. Les trois fichiers ont des rôles distincts :

| Fichier | Rôle |
|---|---|
| `compose.yaml` | Graphe commun : Caddy, PostgreSQL, Backend, Onboarding, Commande et Dashboard ; Prometheus et Grafana dans le profil `observability` |
| `compose.development.yaml` | Certificat mkcert, publication locale de 443, Mailpit, documentation et routes protégées vers le cockpit, son rapport et Grafana |
| `compose.production.yaml` | Publication de 80 et 443, TLS DNS-01, clés JWT, redémarrage automatique ; Grafana sur la boucle locale seulement |

`scripts/compose.sh` applique toujours le socle puis une seule surcharge. Appeler directement `docker compose` sans ces deux fichiers et sans profil n'est pas supporté.

## Où se trouve Caddy

Il existe un seul Caddy de bord par pile. Il termine TLS, redirige HTTP vers HTTPS en production, applique la frontière CORS et route les noms d'hôte. Il est le seul conteneur publié sur les interfaces réseau accessibles. Grafana peut publier un port supplémentaire uniquement sur `127.0.0.1` du VPS lorsque l'observabilité est activée.

Les trois fronts utilisent chacun un NGINX non privilégié en production pour servir leurs fichiers statiques. Le profil development de l'Onboarding substitue son petit serveur Node afin de fournir la session Stripe test locale. Ces serveurs internes ne terminent pas TLS et ne sont pas des reverse proxies publics. PostgreSQL, Backend et les trois fronts ne publient aucun port hôte dans le socle commun.

## Versions et images

`config/deployment/images.env` centralise les images de base. Chaque référence porte un tag lisible et un digest multi-plateforme. Au 2026-07-22, le catalogue contient Caddy 2.11.4, PostgreSQL 17.10, Node 24.18.0, NGINX non privilégié 1.29.4, Eclipse Temurin 25.0.3, Mailpit 1.30.4, Prometheus 3.13.1 `busybox` et Grafana 13.1.1.

Les images applicatives sont :

| Image | Construction | Exécution |
|---|---|---|
| `backend` | Maven et JDK Temurin 25, sélection du profil de domaine | JRE Temurin 25, utilisateur `10001` |
| `onboarding` | Configuration JavaScript générée pour le profil choisi | Node 24 en développement, NGINX non privilégié et utilisateur `101` en production |
| `commande` | TypeScript et Vite avec le profil choisi | NGINX non privilégié, utilisateur `101` |
| `dashboard` | TypeScript et Vite avec le profil choisi | NGINX non privilégié, utilisateur `101` |
| `edge` | Caddy officiel en local, `xcaddy` avec le module DNS en production | Caddy 2.11.4 |

Les outils de build ne sont pas présents dans les images statiques finales. Le Backend et l'image development de l'Onboarding conservent seulement le fichier de domaine sélectionné. Le profil Maven de l'artefact Backend de production exclut physiquement `db/seed/`, et le Dockerfile arrête la construction si cette ressource apparaît encore dans le JAR du catalogue. L'image production de l'Onboarding ne conserve que les fichiers statiques déjà configurés, sans Node ni profil development. Le contenu de `backend/.env`, les certificats, les dossiers `target`, `dist`, `node_modules` et les secrets sont exclus du contexte par `.dockerignore`.

## Préparer Ubuntu LTS

La référence de production est la dernière Ubuntu LTS. Installer Docker Engine depuis le dépôt officiel Docker, avec les plugins Buildx et Compose. Ne pas installer Java, Node, PostgreSQL, NGINX ou Caddy sur l'hôte.

```bash
# Verify the host runtime after the official Docker installation
docker version
docker compose version

# Create protected configuration and key directories
sudo install -d -m 0750 -o "$USER" -g "$USER" /etc/surplasse
sudo install -d -m 0700 -o "$USER" -g "$USER" /etc/surplasse/secrets
```

Le compte de déploiement peut piloter Docker. Cet accès équivaut à des droits élevés sur la machine et doit rester limité. Le pare-feu public autorise SSH, 80 et 443 seulement. PostgreSQL ne reçoit aucune règle publique.

## Configurer la production

Copier l'exemple hors du dépôt :

```bash
install -m 0600 \
  config/deployment/production.env.example \
  /etc/surplasse/production.env
```

Remplacer chaque valeur `change-me`. Le fichier contient les paramètres de déploiement et les secrets. Il ne contient jamais `APP_BASE_DOMAIN`, `APP_BASE_URL`, `API_URL`, `DASHBOARD_URL` ou `COOKIE_DOMAIN`. Ces valeurs viennent exclusivement de `config/domains/production.env`. Le parseur refuse toute tentative de les redéfinir. Le wrapper exige aussi un mode qui interdit tout accès au groupe et aux autres utilisateurs.

Les prérequis bloquants sont :

- un `IMAGE_TAG` égal au SHA git complet de 40 caractères publié dans GHCR ;
- les secrets Stripe live et `STRIPE_LIVE_MODE=true` ;
- la clé privée JWT, le JWKS, le `kid` et leurs chemins hôte ;
- un SMTP transactionnel avec STARTTLS ou TLS selon son port ;
- un fournisseur DNS supporté par Caddy, son module Go épinglé par version, son identifiant Caddy et un jeton limité à la zone ;
- une CSP explicite et testée pour Commande et le Dashboard, avec les seules origines API et Stripe nécessaires ;
- `ONBOARDING_STRIPE_PILOT_ENABLED=false`.

Le profil d'observabilité possède ses propres prérequis, sans les ajouter à cette liste applicative : rétention Prometheus, liaison Grafana sur `127.0.0.1`, port loopback et trois secrets Grafana. Le wrapper les valide seulement lorsqu'une commande démarre ou met à jour `prometheus` ou `grafana`. Leur absence ne doit pas empêcher un `up` ciblé sur le Backend ou la pile applicative.

Au démarrage, le wrapper exige des chemins JWT absolus, des fichiers lisibles et non vides, ainsi que des permissions privées sur la clé. Les valeurs factices, un SHA abrégé et un identifiant de module DNS mal formé arrêtent le déploiement avant Compose.

Le choix du fournisseur DNS n'est pas pris dans le dépôt. Quand il sera arrêté, `CADDY_DNS_MODULE` recevra le module officiel ou maintenu correspondant avec une version ou un commit explicite, et `CADDY_DNS_PROVIDER` son nom de directive. Le wrapper refuse un module non épinglé. L'image `edge` est alors construite avec `xcaddy`. Le jeton DNS reste une variable d'exécution et n'entre pas dans l'image.

## Construire et valider

Le cluster local construit les mêmes recettes. Pour une construction manuelle de production sur une machine autorisée :

```bash
export SURPLASSE_SECRETS_FILE=/etc/surplasse/production.env

# Resolve both Compose files and fail on a missing variable
scripts/compose.sh production config --quiet

# Build all application images with the production domain profile
scripts/compose.sh production build
```

`config` développe les secrets dans sa sortie complète. Utiliser `--quiet` dans les journaux partagés. En CI, les images applicatives seront construites puis poussées vers GHCR avec le SHA git. Une image existante ne doit jamais être reconstruite sous le même SHA.

## Démarrer et contrôler

Sur Ubuntu LTS :

```bash
export SURPLASSE_SECRETS_FILE=/etc/surplasse/production.env

scripts/compose.sh production pull
scripts/compose.sh production up --detach --wait
scripts/compose.sh production ps

curl --fail https://api.surplasse.com/q/health/ready
curl --fail https://surplasse.com/
curl --fail https://dashboard.surplasse.com/
curl --fail https://le-cormoran.surplasse.com/
```

`--wait` exige un état sain pour PostgreSQL, le Backend, les trois fronts et Caddy. Flyway applique les migrations avant que le Backend devienne prêt. Caddy doit charger sa configuration et servir son identité de bord en HTTPS. Une impossibilité de servir HTTPS, une erreur de migration ou un secret invalide maintient le déploiement en échec. La validité publique complète du certificat reste contrôlée par le smoke externe, qui garde une validation TLS stricte en production.

Depuis un poste d'exploitation ou GitHub Actions, jamais en installant Node sur le VPS, rejouer ensuite le smoke navigateur avec le même profil public :

```bash
# Run from a checked-out repository outside the production VPS
npm ci --prefix e2e
npm run e2e:install
SURPLASSE_E2E_ESTABLISHMENT_SLUG=<monitoring-slug> \
  npm run e2e:test -- production
```

Le slug est facultatif. Sans lui, le contrôle de Commande apparaît comme ignoré, tandis que Caddy, le Backend, l'Onboarding et le Dashboard restent obligatoires. Le rapport et son historique propre à la production sont écrits sous `.surplasse/e2e/production/`. La suite ne crée aucune donnée et ne reçoit aucun secret applicatif.

Les commandes de diagnostic restent bornées :

```bash
scripts/compose.sh production ps
scripts/compose.sh production logs --tail 200 edge backend postgresql
scripts/compose.sh production exec backend \
  curl --fail http://127.0.0.1:8080/q/health/ready
```

Le loopback de la dernière commande est une sonde technique interne au conteneur. Il ne devient jamais une URL publique.

Avant le premier trafic, effectuer une exécution manuelle verte de `.github/workflows/e2e.yml`, définir le slug témoin public dans la variable de dépôt `E2E_PRODUCTION_ESTABLISHMENT_SLUG`, puis seulement activer `E2E_MONITORING_ENABLED=true`. Le workflow s'exécute ensuite chaque heure à la minute 17, conserve un rapport Allure 3 rejouable et isole l'historique `production`. Son échec complète la future sonde externe ; il ne la remplace pas.

## Observabilité facultative {#observabilite-facultative}

Prometheus et Grafana portent le profil Compose `observability`. Le démarrage normal de la pile ne les inclut pas. Le Backend rejoint le réseau interne de collecte, mais il ne possède aucun `depends_on`, healthcheck ou adresse vers ces services. Prometheus et Grafana disposent respectivement de limites de 0,5 CPU et 512 Mo, puis 0,5 CPU et 384 Mo.

### Développement local

Sur macOS, Linux ou Windows avec WSL2, Docker et le plugin Compose suffisent. Démarrer d'abord le cluster, puis cibler explicitement les deux services du profil :

```bash
npm run local:up
scripts/compose.sh development up --detach --wait prometheus grafana
scripts/compose.sh development ps prometheus grafana

curl --fail https://grafana.surplasse.test/api/health
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  https://api.surplasse.test/q/metrics
```

Le dernier contrôle doit afficher `404`. Prometheus collecte directement l'endpoint interne. Grafana autorise la lecture locale anonyme avec le rôle `Viewer`, tandis que les identifiants administrateur jetables restent dans `config/deployment/development.env`. Le cockpit peut démarrer ou arrêter chaque service et ouvre `GRAFANA_URL`.

Contrôler les deux services sans leur créer de port hôte :

```bash
scripts/compose.sh development exec prometheus \
  wget --quiet --output-document=- http://127.0.0.1:9090/-/ready
scripts/compose.sh development exec grafana \
  wget --quiet --output-document=- http://127.0.0.1:3000/api/health
```

Le profil local conserve 7 jours de séries. L'arrêt indépendant garde les volumes :

```bash
scripts/compose.sh development stop prometheus grafana
curl --fail https://api.surplasse.test/q/health/ready
```

La seconde commande doit rester verte. Relancer les deux services ne redémarre pas le Backend.

### Production sous Ubuntu LTS

Le fichier `/etc/surplasse/production.env` fixe une rétention Prometheus initiale de 15 jours, une adresse Grafana obligatoirement égale à `127.0.0.1`, un port entre 1024 et 65535, puis trois valeurs secrètes : `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD` et `GRAFANA_SECRET_KEY`. L'accès anonyme est désactivé.

Depuis un checkout propre correspondant à `IMAGE_TAG` :

```bash
export SURPLASSE_SECRETS_FILE=/etc/surplasse/production.env

scripts/compose.sh production pull prometheus grafana
scripts/compose.sh production up --detach --wait prometheus grafana
scripts/compose.sh production ps prometheus grafana
scripts/compose.sh production exec prometheus \
  wget --quiet --output-document=- http://127.0.0.1:9090/-/ready
scripts/compose.sh production exec grafana \
  wget --quiet --output-document=- http://127.0.0.1:3000/api/health
```

Prometheus n'a aucun port hôte. Grafana n'a ni DNS public, ni route Caddy, ni règle de pare-feu. Depuis le poste d'exploitation, créer le tunnel :

```bash
ssh -N -L 3000:127.0.0.1:3000 <utilisateur>@<vps>
```

Le port de droite reprend `GRAFANA_PORT` si sa valeur diffère de l'exemple. Ouvrir ensuite l'extrémité locale du tunnel et s'authentifier dans Grafana. Ce listener loopback est un accès d'administration privé, jamais une URL de profil.

Une mise à jour de Prometheus ou Grafana modifie d'abord leur référence et digest dans `config/deployment/images.env`, passe les validations du dépôt, puis utilise le nouveau checkout :

```bash
scripts/compose.sh production pull prometheus grafana
scripts/compose.sh production up --detach --wait prometheus grafana
```

Une modification de règle, source ou tableau de bord suit le même SHA. Prometheus est redémarré pour relire sa configuration. Grafana surveille le provisionnement versionné toutes les 30 secondes ; une recréation vérifie aussi que l'état canonique ne dépend pas du volume.

### Perte et recréation

`prometheus_data` et `grafana_data` sont persistants mais non critiques. Leur perte est acceptable pour le pilote : les séries, sessions et préférences disparaissent, tandis que les fichiers de configuration et le tableau de bord sont reprovisionnés depuis git. PostgreSQL n'est jamais concerné par cette procédure.

Pour une recréation volontaire, arrêter et retirer uniquement les deux conteneurs, contrôler les noms des volumes du projet, puis supprimer explicitement ces deux volumes :

```bash
scripts/compose.sh production rm --stop --force prometheus grafana
docker volume inspect surplasse_prometheus_data surplasse_grafana_data
docker volume rm surplasse_prometheus_data surplasse_grafana_data
scripts/compose.sh production up --detach --wait prometheus grafana
```

Cette suppression est irréversible pour l'historique opérationnel. Elle ne doit être exécutée qu'après vérification du `COMPOSE_PROJECT_NAME` et des deux résultats de `docker volume inspect`. La restauration est réussie lorsque Prometheus retrouve `surplasse-backend` à `UP`, Grafana affiche `Surplasse / Vue opérationnelle` et la readiness du Backend est restée verte pendant toute l'opération.

## Mettre à jour et revenir en arrière

Une livraison remplace seulement `IMAGE_TAG` dans `/etc/surplasse/production.env` par le nouveau SHA, puis exécute :

```bash
git fetch origin <sha-complet>
git checkout --detach <sha-complet>
scripts/compose.sh production pull
scripts/compose.sh production up --detach --wait
```

Le SHA du checkout et `IMAGE_TAG` doivent être identiques. Le wrapper refuse toute construction, récupération ou activation de production depuis un autre commit ou depuis un worktree sale. Les recettes Compose, les routes et les images restent ainsi alignées pendant une livraison et un retour arrière. Compose recrée les services dont l'image a changé. Le premier déploiement assume une courte interruption du Backend. Le retour arrière sélectionne le SHA sain précédent dans git et dans le fichier d'environnement, puis rejoue les deux commandes Compose. Les migrations Flyway restent additives : un retour arrière applicatif ne restaure pas la base.

Une mise à jour d'image de base suit une autre voie. Renovate est l'outil recommandé pour proposer une modification unique de `config/deployment/images.env`, digest compris. Le dépôt n'a pas encore de bot Renovate configuré. La mise à jour reste donc manuelle jusqu'à son activation, puis passe par les builds et tests avant de produire un nouveau SHA applicatif.

## Données, sauvegarde et restauration

Cinq volumes existent :

| Volume | Contenu | Sauvegarde |
|---|---|---|
| `postgresql_data` | Données métier et historique Flyway | Obligatoire, quotidienne et chiffrée hors VPS |
| `caddy_data` | Certificats, clés ACME et état de renouvellement | Utile, mais reconstructible avec le DNS et le compte ACME |
| `caddy_config` | État interne Caddy | Reconstructible depuis git et `caddy_data` |
| `prometheus_data` | Séries temporelles dans la fenêtre de rétention | Reconstructible, non inclus dans la sauvegarde métier |
| `grafana_data` | État interne et préférences de l'interface | Reconstructible ; sources et tableaux de bord canoniques reprovisionnés depuis git |

La perte des deux volumes d'observabilité supprime l'historique opérationnel et les réglages non versionnés. Elle ne supprime aucune commande, aucun paiement ni aucune configuration canonique. Leur sauvegarde n'est pas exigée pour le pilote. Toute modification utile d'un tableau de bord ou d'une règle doit être reportée dans `infra/observability/` plutôt que conservée seulement dans le volume.

La sauvegarde PostgreSQL s'exécute sans publier le port :

```bash
install -d -m 0700 /var/backups/surplasse
scripts/compose.sh production exec --no-TTY postgresql \
  sh -c 'pg_dump --format=custom --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"' \
  > /var/backups/surplasse/surplasse.dump
```

Le job réel ajoute un horodatage, chiffre le dump et l'envoie hors du VPS. Les variables PostgreSQL de la commande précédente sont développées dans le conteneur, jamais attendues dans le shell de l'hôte.

Une restauration se teste au moins chaque trimestre sur un hôte isolé. Après déchiffrement du dump sur un disque chiffré, le contrôle minimal utilise exactement l'image PostgreSQL épinglée :

```bash
# Run only on an isolated restore host
source config/deployment/images.env
SURPLASSE_RESTORE_CONTAINER=surplasse-restore-postgresql
SURPLASSE_RESTORE_VOLUME=surplasse-restore-postgresql-data
SURPLASSE_RESTORE_PASSWORD="$(openssl rand -hex 24)"

docker volume create "$SURPLASSE_RESTORE_VOLUME"
docker run --detach \
  --name "$SURPLASSE_RESTORE_CONTAINER" \
  --env POSTGRES_DB=surplasse_restore \
  --env POSTGRES_USER=surplasse_restore \
  --env POSTGRES_PASSWORD="$SURPLASSE_RESTORE_PASSWORD" \
  --mount "source=${SURPLASSE_RESTORE_VOLUME},target=/var/lib/postgresql/data" \
  "$POSTGRES_IMAGE"

until docker exec "$SURPLASSE_RESTORE_CONTAINER" \
  pg_isready --username surplasse_restore --dbname surplasse_restore; do
  sleep 1
done

docker exec --interactive "$SURPLASSE_RESTORE_CONTAINER" \
  pg_restore --exit-on-error --no-owner --no-privileges \
  --username surplasse_restore --dbname surplasse_restore \
  < /secure/path/surplasse.dump

docker exec "$SURPLASSE_RESTORE_CONTAINER" \
  psql --username surplasse_restore --dbname surplasse_restore \
  --command "SELECT version FROM flyway_schema_history WHERE success AND version IS NOT NULL ORDER BY installed_rank DESC LIMIT 1;"
```

Le contrôle complet démarre ensuite une copie isolée du Backend sur cette base et vérifie la santé, les rattachements restaurateur-établissement, les états de prise de commandes et quelques paiements rapprochés. Une fois le compte rendu daté, supprimer seulement le conteneur et le volume créés pour cet exercice avec `docker rm --force "$SURPLASSE_RESTORE_CONTAINER"` puis `docker volume rm "$SURPLASSE_RESTORE_VOLUME"`. `scripts/compose.sh production down` conserve les volumes de production. `down --volumes` ne fait jamais partie d'une mise à jour ou d'un retour arrière.

## Arrêt

```bash
# Stop containers but retain them and all volumes
scripts/compose.sh production stop

# Remove containers and the network, retaining named volumes
scripts/compose.sh production down
```

Un arrêt de production est une opération manuelle exceptionnelle. Les services portent `restart: unless-stopped` dans la surcharge production et repartent après un redémarrage de Docker, sauf s'ils ont été explicitement arrêtés.
