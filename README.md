# Surplasse

**Le circuit court de la commande.** Vos commandes. Vos clients. Votre restaurant.

Surplasse est un canal de commande directe pour les restaurants indépendants : QR code à table, carte numérique, commande, paiement et suivi côté restaurateur.

## État du monorepo

| Répertoire | Contenu | État |
|---|---|---|
| `docs/`, `docs-nimbus/` | Source Markdown canonique, rendu Retype et aperçu Nimbus dérivé | Retype disponible, Nimbus expérimental |
| `api/` | Contrat OpenAPI, source de vérité de l'API | Disponible |
| `backend/` | Backend Quarkus et modules métier | Image Compose disponible |
| `frontends/commande/` | Mini-site client React | Image Compose disponible |
| `frontends/dashboard/` | Dashboard React avec suivi temps réel et avancement des commandes | Image Compose disponible |
| `frontends/onboarding/` | Préfiguration HTML de la vitrine | Disponible |
| `frontends/shared/` | Design system et client API TypeScript | Disponible |
| `frontends/design-system2/`, `frontends/*2/` | Design system Untitled UI et variantes des trois interfaces | Expérience facultative en développement et démos visuelles Pages, absente des routes produit et du VPS |
| `compose.yaml`, `infra/` | Pile commune, images et routage Caddy pour le local et la production | Cluster local disponible, VPS non provisionné |
| `scripts/dev-cockpit/` | Pilotage du profil Compose development, vérifications locales et dernier rapport Allure | Disponible, absent de la production |
| `e2e/` | Smokes Playwright et rapports Allure 3 avec historique par cible | Disponible, exécution locale et GitHub Actions |

La documentation complète vit dans [`docs/`](docs/). La procédure détaillée des domaines et du cockpit est dans [`docs/developpement/domaines-locaux.md`](docs/developpement/domaines-locaux.md).

## Prérequis

Le chemin automatisé cible macOS avec Homebrew. Il demande Node.js 24, Java 25 et Docker. Python 3 est requis seulement pour régénérer les QR de marque. Windows est supporté via Ubuntu sous WSL2, avec une configuration DNS et certificat supplémentaire côté Windows si le navigateur tourne sur l'hôte. Linux suit la procédure manuelle documentée.

Installer les dépendances du dépôt une fois :

```bash
nvm use
npm ci
npm ci --prefix docs-nimbus
(cd frontends/shared && npm ci)
(cd frontends/commande && npm ci)
(cd frontends/dashboard && npm ci)
(cd e2e && npm ci && npx playwright install chromium)
```

Pour travailler sur l'expérience UI2, installer aussi ses quatre packages avec `npm run frontend2:install`.

## Installer les domaines locaux

```bash
npm run local:setup
```

Le script installe les formules Homebrew manquantes `dnsmasq`, `nss` et `mkcert`, exécute `mkcert -install`, configure la zone wildcard `surplasse.test` et génère :

```text
.certs/surplasse.test.pem
.certs/surplasse.test-key.pem
```

Il détecte le préfixe Homebrew au lieu de supposer `/opt/homebrew` ou `/usr/local`. Il peut être relancé sans casser une installation existante. `.certs/` est ignoré par Git.

## Démarrer

Construire et démarrer tout le cluster, puis attendre les healthchecks :

```bash
npm run local:up
npm run local:ps
```

Ouvrir [https://surplasse.test](https://surplasse.test). Compose exécute Caddy, PostgreSQL, le Backend, les trois fronts, Mailpit et la documentation. Seul Caddy publie un port sur l'hôte.

Pour garder les logs au premier plan :

```bash
npm run local:start
```

Pour ajouter les trois variantes UI2 au cluster canonique :

```bash
npm run local:experiment:up
```

Elles sont alors disponibles sous `/_experiments/untitled/` sur les mêmes hôtes que les interfaces originales. `npm run local:experiment:stop` arrête seulement ces trois variantes. La procédure complète et la démo Pages vivent dans [`docs/developpement/frontends-alternatifs.md`](docs/developpement/frontends-alternatifs.md).

## Piloter le cluster avec le cockpit

Le cockpit exige un cluster déjà créé. Dans un autre terminal :

```bash
npm run local:up
npm run local:cockpit
```

Ouvrir [https://local.surplasse.test](https://local.surplasse.test). Les boutons lisent et pilotent les services autorisés du projet Compose development. Caddy reste visible en lecture seule, car son arrêt couperait l'accès au cockpit. Les opérations `down`, la suppression des volumes et les boucles natives restent des commandes terminal.

La page [https://local.surplasse.test/tests](https://local.surplasse.test/tests) lance les suites fixes, dont le smoke Playwright development. Son dernier rapport Allure 3 est publié sur [https://reports.surplasse.test](https://reports.surplasse.test). Cette URL répond 404 avant le premier rapport et dépend du cockpit pour être servie. Arrêter le cockpit ne stoppe pas les conteneurs.

GitHub Actions lance aussi un cluster Compose development jetable à chaque push et chaque heure. Son dernier rapport Allure 3 est public sur [https://nclsppr.github.io/surplasse/local-tests/](https://nclsppr.github.io/surplasse/local-tests/). Il est distinct du rapport créé sur le poste local.

## URL et sous-domaines réservés

| URL | Usage |
|---|---|
| `https://surplasse.test` | Onboarding |
| `https://www.surplasse.test` | redirection vers l'Onboarding |
| `https://dashboard.surplasse.test` | Dashboard |
| `https://api.surplasse.test` | Backend |
| `https://docs.surplasse.test` | documentation Retype locale |
| `https://docs.surplasse.test/_experiments/nimbus-docs/` | aperçu Nimbus local, généré depuis `docs/` |
| `https://local.surplasse.test` | cockpit local |
| `https://mail.surplasse.test` | Mailpit |
| `https://reports.surplasse.test` | dernier rapport Allure development |
| `https://app.surplasse.test` | réservé, non implémenté |
| `https://admin.surplasse.test` | réservé, non implémenté |
| `https://{slug}.surplasse.test` | Commande pour un établissement |

Les noms réservés sont `www`, `api`, `dashboard`, `docs`, `app`, `admin`, `local`, `mail` et `reports`. Tout autre sous-domaine direct valide est un candidat `slug` d'établissement.

## Vérifier le DNS et HTTPS

```bash
dig +short @127.0.0.1 -p 53535 restaurant-invente.surplasse.test A
dscacheutil -q host -a name restaurant-invente.surplasse.test

curl -I https://surplasse.test
curl -I https://api.surplasse.test
curl -I https://dashboard.surplasse.test
curl -I https://demo.surplasse.test
curl -I https://restaurant-invente.surplasse.test
curl -I https://app.surplasse.test
curl -I https://admin.surplasse.test
```

Les applications actives répondent 200 et l'API est prête. `app` et `admin` répondent volontairement 503 tant qu'aucune application ne leur est affectée. Utiliser `npm run local:ps` et `npm run local:logs` si un service reste malsain.

## Tester un nouveau restaurant

Il suffit d'ouvrir un nouveau sous-domaine :

```bash
open 'https://le-cormoran.surplasse.test/?table=tbl_2f8e6a4c0b9d7e1f'
open 'https://restaurant-invente.surplasse.test'
```

Le premier existe dans les données de démonstration. Le second vérifie le wildcard DNS, le certificat, Caddy et Commande, mais l'API ne lui fournira pas de carte tant que l'établissement n'existe pas en base. Aucune entrée `/etc/hosts`, aucun SAN et aucune route Caddy ne sont ajoutés.

## Régénérer les certificats

```bash
npm run local:certificates:regenerate
npm run local:up
```

Le certificat couvre déjà l'apex et `*.surplasse.test`. La création d'un restaurant ne nécessite donc aucune régénération.

## Arrêter et désinstaller

`local:stop` conserve les conteneurs et volumes. `local:down` retire les conteneurs et le réseau en conservant les volumes :

```bash
npm run local:stop
npm run local:down
npm run local:remove
```

La suppression retire uniquement le DNS et les certificats feuille gérés par Surplasse. Elle conserve les paquets Homebrew et l'autorité mkcert, potentiellement partagés avec d'autres projets.

## Configuration des domaines

Les sources publiques et sans secret sont :

- `config/domains/development.env` pour `.test` ;
- `config/domains/production.env` pour `.com`.

Les frontends, le Backend, Caddy, l'Onboarding statique et le cockpit partent de ces valeurs. Le chargeur dérive `LOCAL_CONTROL_URL`, `MAILPIT_URL` et `REPORTS_URL` uniquement pour development. `COOKIE_DOMAIN` reste volontairement vide : les cookies restaurateur sont hôte uniquement sur l'API et ne sont jamais partagés avec les mini-sites.

`config/deployment/development.env` porte uniquement les paramètres Compose locaux. Le modèle de secrets de production est `config/deployment/production.env.example`, mais il ne peut redéfinir aucun domaine ni aucune URL. Le wrapper `scripts/compose.sh` sélectionne toujours explicitement `development` ou `production`.

Le Backend se lance avec `npm run backend:dev` ou se vérifie avec `npm run backend:verify`. Ces commandes sourcent le profil avant Maven et dérivent toutes les URL applicatives, le CORS et l'expéditeur Mailpit depuis `APP_BASE_DOMAIN`. Quarkus construit ensuite le magic link depuis `DASHBOARD_URL`, l'émetteur JWT depuis `API_URL` et garde les cookies `Secure`. Le code Java et `application.properties` ne contiennent aucune URL Surplasse de repli.

## Documentation et vérifications

```bash
npm run domains:test
npm run domains:check
npm run brand:check
npm run local:config
npm run compose:config:test
npm run local:cors:test
npm run local:cockpit:test
npm run docs:watch
npm run docs:build
npm run docs:nimbus:check
npm run docs:nimbus:build
npm run docs:build:all
npm run e2e:check
npm run e2e:test -- development
```

La suite E2E exige toujours une cible explicite. Le cockpit expose seulement la commande fixe `development` et son rapport sur `REPORTS_URL`. `production` et `custom` se lancent par la CLI ou par `.github/workflows/e2e.yml` ; une cible `custom` exige son identifiant et son domaine racine. Les résultats, rapports et historiques Allure restent séparés sous `.surplasse/e2e/{history-id}/`. Pour une cible personnalisée, cet identifiant interne ajoute automatiquement une empreinte du domaine afin que deux serveurs ne partagent jamais leur historique. Le test mobile de Commande s'active avec `SURPLASSE_E2E_ESTABLISHMENT_SLUG` et reste en lecture seule.

Les règles de contribution et la terminologie canonique sont dans [`docs/AGENTS.md`](docs/AGENTS.md). Tout nouveau module ou logiciel documente, dans le même commit, son installation, son lancement, son arrêt, sa vérification, les plateformes supportées et sa présence ou son absence en production.
