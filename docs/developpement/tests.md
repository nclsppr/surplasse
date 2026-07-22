---
label: Tests
order: 60
icon: beaker
description: "La stratégie de test de Surplasse : pyramide assumée, tests de contrat des deux côtés, E2E limités aux parcours critiques."
---

# Tests

La stratégie de test découle directement de l'approche contract-first : le contrat `api/openapi.yaml` est vérifié des deux côtés, et chaque étage de la pyramide a un rôle précis. Cette page fixe qui teste quoi, avec quels outils, et surtout ce que l'on ne teste pas. Les [conventions du contrat](./conventions-api.md) et [l'architecture de l'API](../architecture/api.md) donnent le contexte.

## La pyramide assumée

Surplasse assume une pyramide classique : une base unitaire large et rapide, un étage d'intégration contre une vraie base de données, un étage de contrat qui verrouille l'API, et un sommet E2E volontairement étroit.

```
                  +-------------+
                  |     E2E     |    Playwright : parcours critiques uniquement
               +--------------------+
               |      Contrat       |    openapi.yaml vérifié côté backend et frontends
            +--------------------------+
            |       Intégration        |    @QuarkusTest + Testcontainers PostgreSQL
         +--------------------------------+
         |            Unitaire            |    JUnit 5 et Vitest : la base large et rapide
         +--------------------------------+
```

| Étage | Outillage | Portée | Vitesse |
|---|---|---|---|
| Unitaire | JUnit 5 (backend), Vitest (frontends) | Logique métier, machines à états, hooks, fonctions pures | Millisecondes |
| Intégration | `@QuarkusTest`, Testcontainers PostgreSQL | Endpoints d'un module contre une vraie base | Secondes |
| Contrat | Validation contre `openapi.yaml`, MSW | Conformité des réponses réelles et des mocks au contrat | Secondes |
| E2E | Playwright | Parcours critiques de bout en bout, Stripe en mode test | Minutes |

Plus on monte, plus le test coûte cher à écrire, à exécuter et à maintenir : chaque étage ne teste que ce que l'étage du dessous ne peut pas attraper.

## Tests unitaires

### Backend : JUnit 5

Les tests unitaires backend couvrent la logique métier pure, sans conteneur Quarkus, sans base de données, sans réseau. Cibles privilégiées :

- Les machines à états : cycle de vie d'une commande (`pending_payment` en attente de paiement, `paid` payée, `accepted` acceptée, `preparing` en préparation, `ready` prête, `served` servie ou `picked_up` retirée, `cancelled` annulée, `refunded` remboursée), états d'un espace (`pregenerated` pré-généré, `claiming` en cours de revendication, `claimed` revendiqué), progression de l'embarquement.
- Les calculs : total d'une commande avec options, arrondis monétaires, répartition des montants Stripe.
- Les règles métier : qu'est-ce qu'une carte publiable, quand une revendication est-elle recevable.

Une classe de logique métier qui exige un conteneur pour être testée est un signe de couplage à corriger, pas une raison de monter d'un étage. `OperationalMetricsTest` utilise ainsi `SimpleMeterRegistry` pour vérifier les compteurs, les deux valeurs de chaque label fermé et la jauge SSE sans Prometheus, Grafana ou réseau.

### Frontends : Vitest

Côté React, Vitest teste les hooks et les fonctions pures : logique de panier de l'application Commande, formatage des prix et des dates, sélecteurs et transformations de données du Dashboard, coordination de session dans un onglet et entre onglets, validation des formulaires de l'Onboarding. Les interactions DOM ciblées qui portent un invariant d'accessibilité utilisent Testing Library avec `jsdom`, par exemple la restauration du focus après une confirmation devenue obsolète. Le rendu complet des écrans n'est pas un objectif unitaire : il est couvert plus haut, par les tests de contrat avec MSW et par les E2E.

### Domaines et cockpit : Node natif

La configuration publique et le cockpit utilisent le runner `node:test` de Node.js 24, sans dépendance supplémentaire :

```bash
npm run domains:test
npm run domains:check
npm run local:cockpit:test
```

Les tests de domaines valident les profils `.test` et `.com`, la dérivation de toutes les URL depuis le seul domaine racine, le refus des previews loopback et des overrides URL dispersés, les sous-domaines réservés, `REPORTS_URL` et `GRAFANA_URL` limitées à development et l'obligation d'un `COOKIE_DOMAIN` vide. Les tests du cockpit couvrent le registre fixe, les liens HTTPS canoniques, le refus d'un accès navigateur direct, les sondes, la lecture des états Compose, l'allowlist de services, les transitions de cycle de vie, Caddy en lecture seule, Prometheus et Grafana pilotables, la protection des mutations HTTP, le lanceur de vérifications et la publication bornée du rapport Allure. Ils utilisent un exécuteur Compose simulé et ne démarrent ni Java, ni Docker, ni Caddy.

Le cockpit rassemble aussi les derniers résultats locaux sur `https://local.surplasse.test/tests`. Cette vue ne constitue pas un nouvel étage de la pyramide. Elle orchestre les commandes existantes dans quatre suites fixes : Backend intégré, frontends et contrat, plateforme locale, puis parcours Playwright development. Le dernier résultat de chaque suite est conservé. La relance est asynchrone, séquentielle et limitée à une exécution à la fois. Le smoke E2E exige Caddy, le Backend, Commande, le Dashboard et l'Onboarding sains dans Compose. Le navigateur ne peut fournir ni commande, ni chemin, ni argument, ni cible.

Les scripts système sont vérifiés séparément avec `bash -n`. `npm run compose:config:test` résout aussi le profil `observability` dans les deux environnements, vérifie son isolement, ses limites, ses ports, ses secrets conditionnels, valide la configuration et les règles avec le `promtool` de l'image épinglée et parse le tableau de bord JSON. Leur smoke test macOS réel reste manuel car il demande le trousseau, `/etc/resolver` et le port 443.

## Tests d'intégration backend

Chaque module Maven du backend teste ses propres endpoints avec `@QuarkusTest`, contre une vraie base PostgreSQL démarrée par Testcontainers. Pas de base en mémoire, pas de H2 : la version de PostgreSQL testée est celle de la production (17), et les migrations Flyway s'appliquent au démarrage du conteneur, ce qui teste les migrations elles-mêmes au passage.

Le périmètre d'un test d'intégration : une requête HTTP entre dans le module, une réponse en sort, la base a changé comme attendu. Les intégrations externes (Stripe, API OpenAI, envoi d'emails) sont remplacées par des doublures à la frontière du module ; elles ont leurs propres tests de contrat ou sont couvertes en E2E.

`MetricsEndpointTest` appelle `/q/metrics` dans Quarkus et vérifie les familles techniques ainsi que les séries métier à labels bornés. Il prouve l'export du registre, pas le fonctionnement de Prometheus. La collecte et le tableau de bord restent validés par leur configuration versionnée puis par le smoke du profil Compose.

!!! info Un conteneur par module, pas par test
Le conteneur PostgreSQL est réutilisé entre les tests d'un même module, avec un nettoyage des données entre chaque test. Le coût de démarrage est payé une fois, la suite reste rapide.
!!!

## Tests de contrat

Le contrat est vérifié des deux côtés, avec le même fichier `openapi.yaml` comme référence. C'est ce double verrou qui permet aux frontends et au backend d'avancer en parallèle sans se désynchroniser.

### Côté backend : la réponse réelle contre le contrat

Chaque test d'intégration valide la réponse HTTP réelle (code, en-têtes, corps) contre le schéma déclaré dans `openapi.yaml`, via un filtre de validation branché sur le client de test. Une réponse qui s'écarte du contrat fait échouer le test, même si l'assertion métier passe. Les erreurs n'échappent pas à la règle : une 4xx renvoyée par le backend doit être déclarée dans le contrat avec son Problem Details.

### Côté frontends : MSW dérivé du contrat

Les frontends testent leurs écrans et leurs hooks TanStack Query contre MSW (Mock Service Worker). Les handlers MSW sont **dérivés du contrat**, générés depuis `openapi.yaml` et ses exemples : ils ne sont jamais écrits à la main. Un mock manuel finit toujours par mentir ; un mock généré ment le jour où le contrat change, et la régénération le corrige.

Conséquence directe des [conventions du contrat](./conventions-api.md) : les exemples obligatoires sur chaque schéma et chaque réponse sont la matière première de ces mocks. Un exemple pauvre dans le contrat produit un mock pauvre dans les tests.

## Tests E2E : Playwright

L'[ADR-0027](../decisions/adr-0027-playwright-allure-3.md) retient Playwright 1.61 avec Chromium et Allure Report 3. L'[ADR-0028](../decisions/adr-0028-cockpit-compose-et-rapports-allure.md) borne le cockpit à la cible development et publie son dernier rapport sur `REPORTS_URL`. Le package `e2e/` est un outil de développement et de CI. Il ne tourne pas dans les conteneurs applicatifs et n'est pas installé sur le VPS. Les tests visent la pile par ses URL HTTPS publiques, toujours derrière Caddy.

### Smokes livrés

La première suite est volontairement courte et sans écriture métier :

| Contrôle | Surface | Preuve |
|---|---|---|
| Identité et en-têtes de bord | Caddy | identité attendue, HSTS et `nosniff` |
| Readiness | Backend | réponse 200, statut global et checks individuels à `UP` |
| Canonicalisation | Caddy et Onboarding | `www` redirige en 308 vers l'apex en conservant chemin et query string |
| Sous-domaine réservé | Caddy | `app` reste fermé en 503 |
| Landing | Onboarding, Chromium desktop | titre, contenu principal, logo chargé et lien Dashboard dérivé du profil |
| Connexion | Dashboard, Chromium desktop | route protégée redirigée vers le formulaire accessible, sans demande de magic link |
| Carte témoin facultative | Commande, Chromium mobile | carte lisible sans code de table et aucune requête mutante |

Le dernier test exige `SURPLASSE_E2E_ESTABLISHMENT_SLUG`. Sans cette variable, il apparaît comme ignoré dans Allure. Ce comportement est intentionnel : le seed local n'entre jamais en production, et la surveillance ne doit pas deviner le slug d'un établissement réel.

### Installer et exécuter

Le verrou `e2e/package-lock.json` fixe Playwright, `allure-playwright` et la CLI Allure 3. Après l'installation Node du dépôt :

```bash
# Install the isolated E2E package and the pinned Chromium build
npm ci --prefix e2e
npm run e2e:install

# Start the complete local stack, then select the target explicitly from the CLI
npm run local:up
npm run e2e:test -- development

# Enable the optional read-only Commande smoke with a configured fixture
SURPLASSE_E2E_ESTABLISHMENT_SLUG=<slug> \
  npm run e2e:test -- development

# Or start the local cockpit and use its fixed Playwright suite
npm run local:cockpit
```

Les commandes sont identiques sur macOS, Linux et Ubuntu sous WSL2. Dans le cockpit, ouvrir `https://local.surplasse.test/tests`, lancer « Parcours Playwright », puis consulter le rapport sur `https://reports.surplasse.test`. Cette interface ne connaît que development. Sur Ubuntu CI, l'installation utilise `playwright install --with-deps chromium` pour ajouter les bibliothèques système. Le développement Windows natif reste hors support.

Trois types de cible existent, sans cible implicite :

```bash
# Known profiles read their complete topology from config/domains/
npm run e2e:test -- development
npm run e2e:test -- production

# A custom target derives every HTTPS origin from one explicit base domain
SURPLASSE_E2E_TARGET_ID=uat-one \
SURPLASSE_E2E_BASE_DOMAIN=uat.example.org \
SURPLASSE_E2E_ESTABLISHMENT_SLUG=<slug> \
  npm run e2e:test -- custom
```

`custom` accepte un nom d'hôte racine, jamais une URL avec schéma, port ou chemin. Il refuse les IP, les identifiants de répertoire dangereux et toute collision avec les historiques `development` et `production`. Son identifiant de stockage ajoute automatiquement les douze premiers caractères de l'empreinte SHA-256 du domaine racine. Deux serveurs qui réutilisent le même nom de cible restent ainsi isolés. Cette cible rend le reporting réutilisable, mais ne configure pas le produit : une future UAT devra aussi recevoir un profil applicatif cohérent pour construire les frontends et la pile Compose sur son domaine.

Le certificat mkcert est toléré uniquement pour `development`. La production et une cible `custom` gardent une validation TLS stricte.

### Rapport et historique Allure 3

Chaque lancement construit une publication immuable, puis remplace atomiquement le pointeur vers la publication courante :

```text
.surplasse/e2e/{history-id}/
├── current.json       # UUID de la publication courante
├── releases/
│   └── {run-id}/
│       ├── allure-results/  # résultats et pièces jointes
│       ├── allure-report/   # rapport Awesome HTML autonome et résumé
│       ├── playwright/      # traces, captures et vidéos en cas d'échec
│       └── history.jsonl    # un lancement Allure 3 par ligne
├── runs/              # génération temporaire, jamais servie
└── run.lock           # exclusivité d'un lancement par cible
```

`history.jsonl` est limité à 2 160 lancements, soit environ 90 jours au rythme horaire. Il est strictement séparé par cible. La quality gate Allure autorise zéro échec et marque le rapport en conséquence. Le lanceur conserve séparément le code de sortie Playwright, génère le rapport même après un test rouge, puis transmet l'échec au workflow. Le rapport, son résumé et son historique deviennent visibles ensemble par un seul renommage de `current.json`. Une interruption brutale peut laisser une publication orpheline, mais jamais une publication hybride. Le nettoyage conserve la publication courante et la précédente.

Le verrou est volontairement fermé par défaut : il n'est jamais récupéré automatiquement à partir d'un PID supposé mort. Après un arrêt brutal, supprimer `run.lock` seulement après avoir vérifié qu'aucun processus Playwright ou Allure ne travaille encore sur la cible.

Pour development, après la première publication versionnée, le cockpit résout `.surplasse/e2e/development/current.json`, puis sert le `allure-report/index.html` de cette publication en lecture seule sur `REPORTS_URL`. Pendant la migration, si ce pointeur n'existe pas encore, il peut encore lire le dernier rapport plat produit par l'ancienne organisation. Le lancement suivant reprend son historique et crée la première publication versionnée. Caddy protège cet amont avec le même jeton local que le cockpit. Avant tout rapport, l'URL répond 404. Le rapport est un fichier HTML autonome : aucun serveur Allure permanent ni conteneur supplémentaire n'est lancé.

Dans GitHub Actions, le cache restaure `current.json` et l'historique de sa release. Une clé immuable propre au lancement sauvegarde ensuite la nouvelle version. Le pointeur et les releases, avec rapport, résultats, diagnostics et historique, sont également conservés 30 jours comme artefact. Après téléchargement et remise du dossier sous `.surplasse/e2e/{history-id}/`, la commande `npm run e2e:report -- {target}` ouvre directement le fichier HTML autonome dans le navigateur, sans démarrer de serveur. La commande `npm run e2e:report:export -- {target} {destination}` copie seulement le rapport HTML autonome courant vers une destination statique.

Le workflow Pages utilise cet export pour publier son smoke development de CI sur [nclsppr.github.io/surplasse/local-tests/](https://nclsppr.github.io/surplasse/local-tests/). Il restaure le même historique `development`, démarre un cluster Compose jetable avec les domaines du profil central, exécute les tests, puis ajoute `local-tests/index.html` au site. Le rapport rouge est déployé avant que l'échec soit propagé au workflow. Les traces et résultats bruts ne deviennent pas publics : ils restent dans l'artefact rejouable de 30 jours. Le rapport public ne vient jamais de `.surplasse/` sur le poste local.

Pour `custom`, les mêmes variables `SURPLASSE_E2E_TARGET_ID` et `SURPLASSE_E2E_BASE_DOMAIN` recalculent l'identifiant interne. Le cockpit ne télécharge, ne sert et ne fusionne aucun rapport production ou custom.

### Fréquence et séparation des responsabilités

Le workflow `.github/workflows/pages.yml` exécute le smoke `development` à chaque push sur `main`, sur demande et chaque heure à la minute 37. Il publie le résultat sur GitHub Pages. Le workflow `.github/workflows/e2e.yml` valide aussi au push la configuration et le chargement des spécifications, sans joindre une cible. Il déclenche les smokes `production` chaque heure à la minute 17 et les cibles `production` ou `custom` manuellement. L'horaire production reste désactivé tant que la variable de dépôt `E2E_MONITORING_ENABLED` ne vaut pas `true`. Le slug témoin de production, lorsqu'il existe, vient de `E2E_PRODUCTION_ESTABLISHMENT_SLUG`.

Les exécutions horaires restent en lecture seule. Elles complètent une sonde de disponibilité, sans la remplacer : GitHub peut retarder une exécution planifiée. Les traces de parcours authentifiés ou financiers ne doivent jamais être capturées en production, car elles pourraient contenir cookies, jetons ou charges HTTP sensibles.

### Scénarios E2E à ajouter

Les prochains tests de qualification tournent sur une pile éphémère ou une UAT avec Stripe en mode test, jamais dans le smoke horaire de production :

| Priorité | Scénario futur | Invariants à prouver |
|---|---|---|
| Critique | Commander et payer | QR simulé, table correcte, carte, options, total recalculé, Payment Element, confirmation et suivi |
| Critique | Réception en temps réel | commande payée visible dans le Dashboard, SSE, transitions jusqu'à `served`, aucun événement perdu après reconnexion |
| Critique | Paiement refusé puis retenté | même commande, aucun double débit, Payment Intent réutilisable et statut cohérent |
| Critique | Webhooks dupliqués ou désordonnés | idempotence, bon compte Connect, une seule transition et un seul événement métier |
| Critique | Pause pendant un paiement ouvert | aucun nouveau paiement, paiement déjà ouvert rapproché puis servi ou remboursé |
| Critique | Remboursement intégral | motif, idempotence, restitution de la commission éventuelle et sortie du service uniquement après succès Stripe |
| Haute | Authentification restaurateur | magic link à usage unique, expiration, cookies hôte uniquement, rotation coordonnée entre deux onglets et déconnexion |
| Haute | Reconnexion Dashboard | reprise SSE avec `Last-Event-ID`, resynchronisation REST, absence de doublon et indicateur de connexion exact |
| Haute | Embarquement minimal | création d'établissement, extraction IA enregistrée, relecture obligatoire, carte publiée et activation du mini-site |
| Haute | Commande indisponible | produit devenu indisponible, panier conservé, message actionnable et montant jamais obsolète |
| Haute | Réseau dégradé | latence, coupure temporaire, répétition sûre et absence d'état faussement confirmé |
| Moyenne | Compatibilité et accessibilité | parcours clavier, focus, annonces d'erreur, mobile réel, Firefox et WebKit sur les parcours critiques stabilisés |

L'extraction de carte utilisera une réponse OpenAI enregistrée pour rester déterministe. Les parcours Commande complets tourneront sur mobile émulé ; le Dashboard restera en viewport desktop. Tout bug détecté seulement en E2E doit aussi conduire au test unitaire, d'intégration ou de contrat manquant à l'étage inférieur.

## Données de test

Les trois étages supérieurs partagent le même socle de données :

- **Un établissement de démonstration canonique** : un restaurant fictif complet (carte avec catégories, produits et options, images, horaires), défini une fois et utilisé dans le développement local, les piles éphémères et les E2E de qualification. Son seed n'entre jamais en production.
- **Un établissement témoin de production** : un slug public choisi explicitement pour le smoke de lecture. La suite ne connaît ni table, ni compte, ni secret de cet établissement et ne lui écrit aucune donnée.
- **Fixtures partagées** : les jeux de données JSON et SQL vivent à un seul endroit et sont réutilisés par les tests d'intégration, les mocks MSW et les E2E. Les exemples du contrat s'alignent sur cet établissement de démonstration.
- **Builders** : pour les variations, les tests construisent leurs objets via des builders (Java) et des factories (TypeScript) avec des valeurs par défaut sensées. Un test ne renseigne que les champs qui comptent pour son scénario.

## Ce qu'on ne teste pas

| Non testé | Pourquoi |
|---|---|
| Le code généré (client TypeScript, interfaces Java) | Il est produit par des générateurs à versions figées depuis un contrat déjà vérifié ; le tester reviendrait à tester le générateur |
| Les bibliothèques et frameworks (Quarkus, React, TanStack Query, SDK Stripe) | Elles ont leurs propres suites de tests ; on teste notre usage, pas leur fonctionnement |
| Les accesseurs, le mapping trivial, la plomberie déclarative | Aucune logique, aucun risque : un test n'y apporterait que du bruit |

## Seuils pragmatiques

Pas de culte du pourcentage : aucun seuil global de couverture ne bloque le build, et personne n'écrit de test pour faire monter un chiffre. La couverture est mesurée (JaCoCo côté Java, couverture V8 côté Vitest) à titre d'information, pour repérer les angles morts.

L'exigence est ailleurs et elle est binaire : **les invariants métier et les parcours d'argent sont couverts, point.** Concrètement :

- Chaque transition de la machine à états d'une commande a son test, y compris les transitions interdites.
- Tout code qui calcule, encaisse ou rembourse de l'argent a des tests unitaires exhaustifs et un parcours E2E en mode test Stripe.
- Chaque règle de la revendication d'un espace (qui peut revendiquer, quand, avec quelle preuve) a son test.

Une revue qui laisse passer un invariant métier non testé est une revue ratée, quel que soit le pourcentage affiché.

## Nommage des tests

Les noms de tests sont en **anglais**, comme tout le code : une méthode de test suit la forme `methodName_condition_expectedResult` (la méthode testée, la condition, le résultat attendu), lisible comme une spécification. Côté Vitest, les blocs `describe` et `it` sont rédigés en anglais. On décrit le comportement attendu, pas seulement la méthode appelée.

| Côté | Forme | Exemple |
|---|---|---|
| Backend (JUnit 5) | Méthode `methodName_condition_expectedResult` en anglais | `pay_emptyOrder_isRejected()` |
| Frontends (Vitest) | Chaîne anglaise dans `it(...)` | `it("recalculates the total when an option is removed from the cart")` |

À l'inverse, `testCreateOrder()` ou `it("works")` sont refusés en revue : ils n'apprennent rien quand ils échouent.

## Quand les tests tournent

La règle locale est simple : une unité de travail vérifiée est un commit poussé, et « vérifiée » inclut les tests de l'étage concerné. En CI, chaque étage a son déclencheur :

| Étage | Déclencheur en CI |
|---|---|
| Unitaires et intégration backend | Chaque push touchant `backend/` ou `api/` |
| Unitaires et contrat frontends | Chaque push touchant `frontends/`, `config/domains/` ou `api/` |
| E2E smoke | À chaque push et chaque heure sur un cluster Compose development jetable, chaque heure sur la production après activation, manuellement sur `production` ou `custom`, et localement sur `development` |
| E2E de qualification | Cible documentée mais non livrée : pile éphémère ou future UAT avec Stripe en mode test, avant les portes à risque |

Un push touchant `api/` déclenche les deux côtés : c'est le prix du double verrou de contrat, et il est voulu. Le détail des workflows GitHub Actions appartient à la page CI/CD de cette section.

## Pages liées

- [Conventions du contrat](./conventions-api.md) : exemples obligatoires, lint Spectral, génération des clients.
- [Architecture de l'API](../architecture/api.md) : ressources, authentification, temps réel.
- [Workflow git](./workflow-git.md) : une unité de travail vérifiée (tests compris) est un commit poussé.
