# Surplasse

**Le circuit court de la commande.** Vos commandes. Vos clients. Votre restaurant.

Surplasse est un canal de commande directe pour les restaurants indépendants : QR code à table, carte numérique, commande, paiement et suivi côté restaurateur.

## État du monorepo

| Répertoire | Contenu | État |
|---|---|---|
| `docs/` | Documentation Retype et roadmap | Disponible |
| `api/` | Contrat OpenAPI, source de vérité de l'API | Disponible |
| `backend/` | Backend Quarkus, PostgreSQL Dev Services et modules métier | Disponible localement |
| `frontends/commande/` | Mini-site client React | Disponible localement |
| `frontends/dashboard/` | Dashboard React avec suivi et avancement des commandes | Disponible localement |
| `frontends/onboarding/` | Préfiguration HTML de la vitrine | Disponible |
| `frontends/shared/` | Design system et client API TypeScript | Disponible |
| `infra/local/` | DNS wildcard, HTTPS mkcert et routage Caddy | Disponible sur le poste de développement |
| `scripts/dev-cockpit/` | Supervision et contrôle des modules locaux | Disponible, absent de la production |

La documentation complète vit dans [`docs/`](docs/). La procédure détaillée des domaines et du cockpit est dans [`docs/developpement/domaines-locaux.md`](docs/developpement/domaines-locaux.md).

## Prérequis

Le chemin automatisé cible macOS avec Homebrew. Il demande Node.js 24, Java 21 et Docker. Python 3 est requis seulement pour régénérer les QR de marque. Windows est supporté via Ubuntu sous WSL2, avec une configuration DNS et certificat supplémentaire côté Windows si le navigateur tourne sur l'hôte. Linux suit la procédure manuelle documentée.

Installer les dépendances du dépôt une fois :

```bash
nvm use
npm ci
(cd frontends/shared && npm ci)
(cd frontends/commande && npm ci)
(cd frontends/dashboard && npm ci)
```

## Installer les domaines locaux

```bash
npm run local:setup
```

Le script installe les formules Homebrew manquantes `dnsmasq`, `nss`, `mkcert` et `caddy`, exécute `mkcert -install`, configure la zone wildcard `surplasse.test` et génère :

```text
.certs/surplasse.test.pem
.certs/surplasse.test-key.pem
```

Il détecte le préfixe Homebrew au lieu de supposer `/opt/homebrew` ou `/usr/local`. Il peut être relancé sans casser une installation existante. `.certs/` est ignoré par Git.

## Démarrer

Dans un premier terminal :

```bash
npm run local:proxy
npm run local:cockpit
```

Ouvrir [https://local.surplasse.test](https://local.surplasse.test), puis démarrer le parcours principal ou chaque module avec son bouton. Le cockpit montre en permanence les URL, les ports, les sondes et les états. Il n'arrête que les processus qu'il a lui-même lancés.

La commande combinée existe aussi :

```bash
npm run local:start
```

## URL et sous-domaines réservés

| URL | Usage |
|---|---|
| `https://surplasse.test` | Onboarding |
| `https://www.surplasse.test` | redirection vers l'Onboarding |
| `https://dashboard.surplasse.test` | Dashboard |
| `https://api.surplasse.test` | Backend |
| `https://docs.surplasse.test` | documentation locale |
| `https://local.surplasse.test` | cockpit local |
| `https://mail.surplasse.test` | Mailpit |
| `https://app.surplasse.test` | réservé, non implémenté |
| `https://admin.surplasse.test` | réservé, non implémenté |
| `https://{slug}.surplasse.test` | Commande pour un établissement |

Les noms réservés sont `www`, `api`, `dashboard`, `docs`, `app`, `admin`, `local` et `mail`. Tout autre sous-domaine direct valide est un candidat `slug` d'établissement.

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

Une réponse 502 indique que DNS, certificat et Caddy fonctionnent, mais que le module est arrêté. `app` et `admin` répondent volontairement 503 tant qu'aucune application ne leur est affectée.

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
npm run local:proxy
```

Le certificat couvre déjà l'apex et `*.surplasse.test`. La création d'un restaurant ne nécessite donc aucune régénération.

## Arrêter et désinstaller

`Ctrl+C` ferme le cockpit et arrête les processus qu'il possède. Caddy se gère séparément :

```bash
npm run local:proxy:stop
npm run local:remove
```

La suppression retire uniquement le DNS et les certificats feuille gérés par Surplasse. Elle conserve les paquets Homebrew et l'autorité mkcert, potentiellement partagés avec d'autres projets.

## Configuration des domaines

Les sources publiques et sans secret sont :

- `config/domains/development.env` pour `.test` ;
- `config/domains/production.env` pour `.com`.

Les frontends, le Backend, Caddy, l'Onboarding statique et le cockpit partent de ces valeurs. `COOKIE_DOMAIN` reste volontairement vide : les cookies restaurateur sont hôte uniquement sur l'API et ne sont jamais partagés avec les mini-sites.

Le Backend se lance avec `npm run backend:dev` ou se vérifie avec `npm run backend:verify`. Ces commandes sourcent le profil avant Maven et dérivent le CORS et l'expéditeur Mailpit. Quarkus construit ensuite le magic link depuis `DASHBOARD_URL`, l'émetteur JWT depuis `API_URL` et garde les cookies `Secure`. Le code Java et `application.properties` ne contiennent aucune URL Surplasse de repli.

## Documentation et vérifications

```bash
npm run domains:test
npm run domains:check
npm run brand:check
npm run local:cockpit:test
npm run docs:watch
npm run docs:build
```

Les règles de contribution et la terminologie canonique sont dans [`docs/AGENTS.md`](docs/AGENTS.md). Tout nouveau module ou logiciel documente, dans le même commit, son installation, son lancement, son arrêt, sa vérification, les plateformes supportées et sa présence ou son absence en production.
