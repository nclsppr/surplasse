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

Une classe de logique métier qui exige un conteneur pour être testée est un signe de couplage à corriger, pas une raison de monter d'un étage.

### Frontends : Vitest

Côté React, Vitest teste les hooks et les fonctions pures : logique de panier de l'application Commande, formatage des prix et des dates, sélecteurs et transformations de données du Dashboard, coordination de session dans un onglet et entre onglets, validation des formulaires de l'Onboarding. Les interactions DOM ciblées qui portent un invariant d'accessibilité utilisent Testing Library avec `jsdom`, par exemple la restauration du focus après une confirmation devenue obsolète. Le rendu complet des écrans n'est pas un objectif unitaire : il est couvert plus haut, par les tests de contrat avec MSW et par les E2E.

### Domaines et cockpit : Node natif

La configuration publique et le cockpit utilisent le runner `node:test` de Node.js 24, sans dépendance supplémentaire :

```bash
npm run domains:test
npm run domains:check
npm run local:cockpit:test
```

Les tests de domaines valident les profils `.test` et `.com`, la dérivation de toutes les URL depuis le seul domaine racine, le refus des previews loopback et des overrides URL dispersés, les sous-domaines réservés et l'obligation d'un `COOKIE_DOMAIN` vide. Les tests du cockpit couvrent le registre fixe, les liens HTTPS canoniques, le refus d'un accès navigateur direct par loopback, les sondes, les transitions d'état, la propriété des processus, le conteneur Mailpit, la protection des mutations HTTP et le lanceur de vérifications. Ils ne démarrent ni Java, ni Docker, ni Caddy.

Le cockpit rassemble aussi les derniers résultats locaux sur `https://local.surplasse.test/tests`. Cette vue ne constitue pas un nouvel étage de la pyramide. Elle orchestre les commandes existantes dans trois suites fixes et persistantes : Backend intégré, frontends et contrat, plateforme locale. La relance est asynchrone, séquentielle et limitée à une exécution à la fois. Le navigateur ne peut fournir ni commande, ni chemin, ni argument.

Les scripts système sont vérifiés séparément avec `bash -n`. Leur smoke test macOS réel reste manuel car il demande le trousseau, `/etc/resolver` et le port 443.

## Tests d'intégration backend

Chaque module Maven du backend teste ses propres endpoints avec `@QuarkusTest`, contre une vraie base PostgreSQL démarrée par Testcontainers. Pas de base en mémoire, pas de H2 : la version de PostgreSQL testée est celle de la production (17), et les migrations Flyway s'appliquent au démarrage du conteneur, ce qui teste les migrations elles-mêmes au passage.

Le périmètre d'un test d'intégration : une requête HTTP entre dans le module, une réponse en sort, la base a changé comme attendu. Les intégrations externes (Stripe, API OpenAI, envoi d'emails) sont remplacées par des doublures à la frontière du module ; elles ont leurs propres tests de contrat ou sont couvertes en E2E.

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

Les E2E couvrent les parcours critiques uniquement, avec Playwright, contre une pile complète (backend, base, frontends) et Stripe en mode test. La liste est courte et le reste :

| Parcours | Application | Contenu |
|---|---|---|
| Commander et payer | Commande | Scan simulé du QR code, consultation de la carte, panier avec options, paiement Stripe en mode test, confirmation |
| Embarquement minimal | Onboarding | Création d'un établissement, génération de la carte depuis une photo, activation du mini-site |
| Réception d'une commande | Dashboard | La commande passée côté client apparaît en temps réel côté restaurateur |

Deux règles d'exécution :

- Les parcours de l'application Commande tournent **sur mobile émulé** (viewport et tactile Playwright) : c'est le contexte réel du client attablé. Le Dashboard tourne en viewport desktop.
- L'extraction de carte par l'API OpenAI est remplacée par une réponse enregistrée : le parcours d'embarquement doit être déterministe et ne pas dépendre d'un appel IA en CI.

Tout ce qui n'est pas dans ce tableau se teste plus bas dans la pyramide. Un bug attrapé uniquement par un E2E est l'indice d'un test manquant à un étage inférieur.

## Données de test

Les trois étages supérieurs partagent le même socle de données :

- **Un établissement de démonstration canonique** : un restaurant fictif complet (carte avec catégories, produits et options, images, horaires), défini une fois et utilisé partout, du développement local aux E2E. Son contenu exact est figé dans les fixtures.
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
| E2E | Cible non implémentée : aucun package ni workflow Playwright n'existe encore. Leur ajout activera les seuls parcours critiques décrits plus haut. |

Un push touchant `api/` déclenche les deux côtés : c'est le prix du double verrou de contrat, et il est voulu. Le détail des workflows GitHub Actions appartient à la page CI/CD de cette section.

## Pages liées

- [Conventions du contrat](./conventions-api.md) : exemples obligatoires, lint Spectral, génération des clients.
- [Architecture de l'API](../architecture/api.md) : ressources, authentification, temps réel.
- [Workflow git](./workflow-git.md) : une unité de travail vérifiée (tests compris) est un commit poussé.
