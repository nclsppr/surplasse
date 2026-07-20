---
label: API et contrat
order: 40
icon: plug
description: Le contrat OpenAPI comme source de vérité, les règles de conception REST, le versioning, les périmètres d'authentification et l'outillage de génération.
---

# API et contrat

L'API REST de Surplasse est définie par le contrat, le fichier `api/openapi.yaml`. Cette page décrit le principe contract-first, le cycle de vie d'un changement d'API, les règles de conception REST du projet, le versioning, les périmètres d'authentification et l'outillage associé. Les conventions de détail (nommage des champs, structure des payloads) sont précisées dans [les conventions d'API](../developpement/conventions-api.md).

## Le principe contract-first

Le contrat est la source de vérité unique de l'API. Personne n'écrit d'appel HTTP à la main, ni côté backend, ni côté frontends :

- le backend implémente des **interfaces Java générées** depuis le contrat ; le compilateur refuse toute divergence entre l'implémentation et le contrat ;
- les trois frontends (Onboarding, Commande, Dashboard) consomment un **client TypeScript généré**, publié dans `frontends/shared/` ; les types de requêtes et de réponses sont ceux du contrat, sans transcription manuelle ;
- toute discussion sur l'API se fait sur le contrat, pas sur le code.

```
                 api/openapi.yaml (le contrat)
                          |
            +-------------+-------------+
            |                           |
        génération                  génération
            |                           |
            v                           v
   backend/                    frontends/shared/
   interfaces Java              client TypeScript
   (jaxrs-spec)                 (typescript-fetch)
            |                           |
            v                           v
   implémentation Quarkus      Onboarding, Commande,
                               Dashboard
```

Ce choix est motivé et arbitré dans l'[ADR-0002 : contract-first](../decisions/adr-0002-contract-first.md). En résumé : un seul artefact à relire pour comprendre l'API, des types garantis de bout en bout, et la possibilité de détecter les cassures de compatibilité mécaniquement.

!!! info Le contrat avant le code
Une fonctionnalité qui touche l'API commence toujours par une modification de `api/openapi.yaml`. Si le contrat ne décrit pas un endpoint, cet endpoint n'existe pas, même si quelqu'un serait tenté de l'implémenter « en attendant ».
!!!

## Cycle de vie d'un changement d'API

Tout changement d'API suit le même cycle, dans cet ordre :

| Étape | Action | Vérification |
|---|---|---|
| 1 | Modifier `api/openapi.yaml` | Lint Spectral, contrôle de compatibilité oasdiff |
| 2 | Committer le contrat | Le commit du contrat précède toujours l'implémentation |
| 3 | Régénérer les interfaces Java et le client TypeScript | La génération est reproductible et committée |
| 4 | Implémenter côté backend | Les interfaces générées guident l'implémentation |
| 5 | Tester | Tests de contrat, voir [la page tests](../developpement/tests.md) |
| 6 | Adapter les frontends si besoin | Le client généré expose les nouveaux types |

Le commit du contrat en premier n'est pas une coquetterie : il matérialise l'accord sur l'interface avant tout investissement dans l'implémentation, et il permet aux frontends et au backend d'avancer en parallèle sur la base du même artefact.

## Règles de conception REST

Les règles ci-dessous s'appliquent à tout endpoint du contrat. Le code et l'API sont en anglais ; seule l'interface utilisateur est en français.

### Ressources au pluriel, en anglais

Les chemins désignent des collections de ressources, nommées au pluriel en anglais.

```
GET  /v1/establishments/{id}
GET  /v1/orders?cursor=...
POST /v1/menus/{menuId}/products
```

Le vocabulaire de l'API traduit la terminologie canonique : établissement devient `establishment`, la carte devient `menu`, commande devient `order`, revendication devient `claim`, embarquement devient `onboarding`.

### Imbrication limitée à un niveau

Un chemin peut exprimer une relation de contenance, mais jamais plus d'un niveau d'imbrication. Au-delà, on repart de la ressource enfant avec un filtre.

```
Correct :   GET /v1/establishments/{id}/menus
Correct :   GET /v1/menus/{id}/products
Incorrect : GET /v1/establishments/{id}/menus/{menuId}/products
```

### Verbes HTTP et codes de statut canoniques

| Verbe | Usage | Codes de succès attendus |
|---|---|---|
| `GET` | Lecture, sans effet de bord | 200 |
| `POST` | Création, ou action non idempotente nommée | 201 (création), 200 ou 202 (action) |
| `PUT` | Remplacement complet d'une ressource | 200 |
| `PATCH` | Modification partielle | 200 |
| `DELETE` | Suppression | 204 |

Côté erreurs : 400 pour une requête invalide, 401 pour une authentification absente ou expirée, 403 pour une action interdite sur une ressource de son propre établissement (état non revendiqué ou suspendu), 404 pour une ressource inconnue ou hors du périmètre du demandeur (jamais 403 dans ce cas, pour ne pas confirmer son existence), 409 pour un conflit d'état, 422 pour une règle métier violée, 429 pour un dépassement de quota, 503 pour une dépendance externe indisponible après retentatives (Stripe, API OpenAI).

### Pagination par curseur

Les listes potentiellement longues, au premier rang desquelles les listes de commandes du Dashboard, sont paginées par curseur opaque, jamais par offset. Le curseur encode la position ; le client ne l'interprète pas.

```
GET /v1/orders?establishmentId=2c9e7a41-5b8d-4f3a-9e6b-7d1c2a3b4c5d&limit=50&cursor=eyJvIjoi...

200 OK
{
  "items": [ ... ],
  "nextCursor": "eyJvIjoi...",
  "hasMore": true
}
```

Quand `hasMore` vaut `false`, `nextCursor` est absent. La pagination par curseur reste stable quand de nouvelles commandes arrivent en tête de liste, ce qu'un offset ne garantit pas.

La première liste paginée effectivement livrée est `GET /v1/orders`. Elle exige le cookie de session restaurateur et `establishmentId`, puis retourne uniquement les commandes `paid`, `accepted`, `preparing` et `ready`. Le curseur est lié à l'établissement. Une ressource inconnue ou hors du périmètre du restaurateur répond 404. Les lignes de commande sont des instantanés et la capacité de suivi du client n'est jamais exposée dans ce modèle Dashboard.

`PATCH /v1/orders/{orderId}/status` est également livré. Il accepte uniquement l'étape opérationnelle suivante : `accepted`, `preparing`, `ready`, puis `served` ou `picked_up` selon le type de commande. Répéter le statut déjà atteint est idempotent. Un saut répond 409, une fin incompatible avec le type répond 422, et une commande inconnue ou hors périmètre répond 404. `refunded` reste exclu : un remboursement doit déclencher une opération du domaine paiement, pas une simple écriture de statut.

### Prise de commandes par établissement

Le contrôle opérationnel livré est une sous-ressource authentifiée de l'établissement :

```
GET /v1/establishments/{establishmentId}/order-intake
PUT /v1/establishments/{establishmentId}/order-intake
{
  "status": "paused"
}
```

Le `GET` retourne le statut configuré `open` ou `paused`, la disponibilité effective `acceptingOrders`, l'horodatage du dernier changement du statut configuré et, lorsque l'admission est fermée, un `blockedReason`. Les causes prévues sont `paused`, `establishment_not_active`, `configuration_unavailable` et `payments_unavailable`. La cause `configuration_unavailable` couvre l'absence de carte publiée ou de table active. Le `PUT` remplace l'état demandé de manière idempotente. Répéter la même valeur conserve `updatedAt`. Une auto-pause Stripe modifie cet horodatage, tandis qu'un prérequis qui change seulement la disponibilité effective ne le modifie pas. Une ouverture répond 422 tant que le cycle de vie, la carte publiée, les tables actives ou Stripe Connect ne sont pas prêts. Les types stables `order-intake-establishment-not-active`, `order-intake-configuration-unavailable` et `order-intake-payments-unavailable` permettent au Dashboard d'expliquer le prérequis à corriger sans interpréter le texte de l'erreur. Leur URI repose sur `PROBLEM_TYPE_BASE`, fixé à `https://surplasse.com/problems/` dans les profils de développement et de production : le domaine local ne crée donc jamais un second identifiant pour la même erreur. Une pause reste toujours autorisée pour un restaurateur membre de l'établissement.

Le profil public `GET /v1/establishments/{slug}/public` expose seulement `acceptingOrders`. La carte reste lisible quand cette valeur vaut `false`. Une nouvelle session de table reçoit le même 404 indistinguable que pour un QR inconnu ou inactif. Avec une session de table déjà ouverte, une nouvelle commande ou session de paiement reçoit le problème 409 `order-intake-paused`. Les lectures de suivi, les flux SSE et les opérations sur les commandes existantes ne changent pas.

### Erreurs au format Problem Details (RFC 9457)

Toute réponse d'erreur est un document `application/problem+json` conforme à la RFC 9457, avec un champ `type` stable qui identifie l'erreur applicative.

```
409 Conflict
Content-Type: application/problem+json

{
  "type": "https://surplasse.com/problems/product-unavailable",
  "title": "Product unavailable",
  "status": 409,
  "detail": "Product 6f4b9c2d-8a1e-4d7b-b3f5-0e9a8c7d6b5a is marked unavailable on this menu.",
  "instance": "/v1/orders"
}
```

Types d'erreurs applicatives prévus (liste de départ, complétée au fil du contrat) :

| Type (suffixe de l'URI) | Statut | Signification |
|---|---|---|
| `validation-error` | 400 | Payload syntaxiquement invalide ou champ manquant |
| `table-session-expired` | 401 | Jeton de session de table expiré ou inconnu |
| `magic-link-expired` | 401 | Magic link consommé ou périmé |
| `session-expired` | 401 | Session restaurateur absente, expirée, révoquée ou rejouée |
| `establishment-not-claimed` | 403 | Espace non revendiqué, action réservée au restaurateur |
| `establishment-not-active` | 403 | Établissement suspendu ou embarquement non terminé |
| `resource-not-found` | 404 | Ressource inconnue ou hors du périmètre du demandeur |
| `order-intake-paused` | 409 | Nouvelle commande ou session de paiement refusée car la prise de commandes est en pause |
| `order-intake-establishment-not-active` | 422 | Réouverture refusée car le cycle de vie de l'établissement n'est pas `active` |
| `order-intake-configuration-unavailable` | 422 | Réouverture refusée faute de carte publiée ou de table active |
| `order-intake-payments-unavailable` | 422 | Réouverture refusée car Stripe Connect ne peut pas encaisser |
| `product-unavailable` | 409 | Produit indisponible au moment de la commande |
| `order-not-modifiable` | 409 | Commande déjà validée ou payée |
| `idempotency-key-conflict` | 409 | Clé d'idempotence réutilisée avec un payload différent |
| `payment-failed` | 422 | Paiement refusé par Stripe |
| `rate-limited` | 429 | Trop de requêtes, réessayer après le délai `Retry-After` |

### Idempotence sur la création de commande et de paiement

La création d'une commande et la création d'un paiement exigent un en-tête `Idempotency-Key`, un UUID généré par le client au moment de l'intention. Rejouer la même requête avec la même clé renvoie la réponse d'origine sans créer de doublon ; la même clé avec un payload différent renvoie `idempotency-key-conflict`.

```
POST /v1/orders
Idempotency-Key: 7f3a9c1e-4b2d-4e8a-9c5f-1d2e3f4a5b6c
```

Cette règle protège le parcours client sur mobile : une connexion instable en salle ne doit jamais produire deux commandes ni deux paiements.

Pour le paiement, le Backend conserve chaque intention dans `payment_request` et la rattache à la session de paiement rendue. Plusieurs clés peuvent désigner la même session encore en attente, par exemple après un rechargement du navigateur. Chaque clé reste néanmoins rejouable et une réutilisation pour une autre commande ou une autre session de table répond 409. Avant l'appel externe, la première création réserve aussi une clé Stripe stable. Toute requête concurrente ou reprise termine cette même réservation avec cette même clé, sans créer un second Payment Intent.

### Horodatages et montants

- **Horodatages** : ISO 8601 en UTC, suffixe `Z`, précision seconde ou milliseconde. Exemple : `"createdAt": "2026-07-18T12:34:56Z"`. Jamais de fuseau local dans l'API ; l'affichage en heure locale est la responsabilité des frontends.
- **Montants** : entiers en centimes, jamais de flottants. Les champs monétaires portent le suffixe `Cents`. Exemple : `"totalCents": 1850` pour 18,50 EUR. La devise est portée par un champ `currency` (code ISO 4217, `EUR` pour le MVP).

## Versioning

Tous les chemins sont préfixés par `/v1`. La politique de compatibilité est la suivante :

- **Ajouts non cassants libres dans `/v1`** : nouvel endpoint, nouveau champ optionnel dans une requête, nouveau champ dans une réponse, nouvelle valeur d'énumération documentée comme extensible. Les clients générés tolèrent les champs inconnus.
- **Toute cassure exige une nouvelle version majeure** (`/v2`) : suppression ou renommage d'un champ, changement de type, resserrement d'une validation, changement de sémantique d'un code de statut.
- **Aucune `/v2` n'est prévue avant longtemps.** Le contrôle oasdiff en CI est là précisément pour que les évolutions restent dans la catégorie non cassante.

## Périmètres d'authentification

Le contrat déclare quatre périmètres d'authentification (security schemes), qui partitionnent l'ensemble des endpoints :

| Périmètre | Mécanisme | Qui l'utilise |
|---|---|---|
| Restaurateur | JWT court dans un cookie hôte uniquement pour l'API (`HttpOnly`, `Secure` en production, `SameSite=Lax`), renouvelé par un refresh token opaque dans un second cookie | Dashboard, fin de l'embarquement |
| Client anonyme | Jeton de session de table opaque, délivré au scan du QR code | Commande (panier, commande, paiement) |
| Public | Aucune authentification | Lecture de la carte et du mini-site |
| Webhook Stripe | Signature `Stripe-Signature` vérifiée côté backend | Stripe uniquement |

Le périmètre restaurateur repose sur des cookies hôte uniquement pour `api.surplasse.com` et non sur un en-tête `Authorization`. Le Dashboard consomme le flux SSE via l'API navigateur `EventSource`, qui n'accepte aucun en-tête personnalisé : `credentials: "include"` pour REST et `withCredentials: true` pour SSE envoient les cookies à leur hôte. Aucun attribut `Domain=.surplasse.com` n'est nécessaire. Voir [la sécurité](securite.md).

Le client final n'a jamais de compte : le jeton de session de table est opaque, limité à une table et à une durée de service, et ne porte aucune donnée personnelle.

Groupes d'endpoints prévus par domaine :

| Domaine | Exemples d'endpoints | Périmètre |
|---|---|---|
| Espaces et revendication | `GET /v1/spaces/{slug}`, `POST /v1/claims` | Public (lecture), puis magic link |
| Embarquement | `POST /v1/onboarding/menu-extractions`, `POST /v1/establishments` | Restaurateur |
| Gestion de la carte | `PUT /v1/menus/{id}`, `PATCH /v1/products/{id}` | Restaurateur |
| Prise de commandes | `GET`, `PUT /v1/establishments/{id}/order-intake` | Restaurateur |
| Carte publique | `GET /v1/menus/{id}`, `GET /v1/establishments/{slug}/public` | Public |
| Sessions de table | `POST /v1/table-sessions` | Public (délivre le jeton) |
| Commandes côté client | `POST /v1/orders`, `GET /v1/orders/{id}` | Client anonyme |
| Commandes côté restaurateur | `GET /v1/orders`, `PATCH /v1/orders/{id}/status` | Restaurateur |
| Paiements | `POST /v1/payments`, `GET /v1/payments/{id}` | Client anonyme |
| Temps réel | `GET /v1/establishments/{id}/order-events` (SSE), implémenté | Restaurateur |
| Temps réel | `GET /v1/orders/{id}/events` (SSE) | Client anonyme (jeton propre à la commande) |
| Webhooks | `POST /v1/webhooks/stripe` | Signature Stripe |

Le tableau mêle les routes implémentées et des routes encore prévues. Le contrat fixe la forme exacte de chaque opération sortie du statut `x-draft`. La description détaillée des mécanismes d'authentification se trouve dans [la page sécurité](securite.md).

## Outillage

| Outil | Rôle | Statut |
|---|---|---|
| openapi-generator | Génération des interfaces Java (`jaxrs-spec`) et du client TypeScript (`typescript-fetch`) | Figé par l'[ADR-0013](../decisions/adr-0013-generateurs-openapi.md) |
| Spectral | Lint du contrat avec un jeu de règles committé dans `api/` | Jeu de règles committé (`api/.spectral.yaml`) |
| oasdiff | Contrôle de compatibilité entre la version committée et la version proposée, en CI | Branché dans GitHub Actions |

Trois garde-fous automatiques encadrent donc le contrat : le lint garantit la cohérence de style (nommage, descriptions obligatoires, codes d'erreur déclarés), le contrôle de compatibilité bloque les cassures involontaires, et la génération garantit que le code ne peut pas s'écarter du contrat.

!!! info Générateurs figés
Le choix des générateurs (`jaxrs-spec` côté Java, `typescript-fetch` côté front, via OpenAPI Generator seul, versions épinglées) est acté par l'[ADR-0013](../decisions/adr-0013-generateurs-openapi.md). Le détail opérationnel vit dans [les conventions d'API](../developpement/conventions-api.md).
!!!

## Webhooks

### Entrants : Stripe

Stripe notifie le backend des événements de paiement (paiement confirmé, échoué, remboursé) sur `POST /v1/webhooks/stripe`. Conventions :

- la signature `Stripe-Signature` est vérifiée avant tout traitement ; une signature invalide renvoie 400 sans autre effet ;
- le traitement est idempotent : l'identifiant d'événement Stripe est journalisé, un événement déjà traité est acquitté (200) sans être rejoué ;
- le backend acquitte vite et traite de façon asynchrone ce qui peut l'être, pour rester sous les délais de retry de Stripe ;
- l'endpoint figure dans le contrat comme les autres, avec son périmètre d'authentification propre.

### Sortants : impression (éventuel)

Si l'impression des tickets cuisine passe par un pont réseau local (à trancher par ADR, voir la stack de référence), le backend pourrait émettre des webhooks sortants vers ce pont. Les conventions retenues par avance :

- payload JSON signé (HMAC avec secret partagé par établissement) ;
- livraison au moins une fois, avec retries à backoff exponentiel et journalisation des échecs ;
- le pont acquitte par le code de statut, sans corps attendu.

Rien de tout cela n'est acté tant que l'ADR sur l'impression n'est pas rendu ; ce paragraphe fixe seulement le cadre dans lequel la décision se prendra.

## Pages liées

- [ADR-0002 : contract-first](../decisions/adr-0002-contract-first.md) : la décision et ses alternatives.
- [Conventions d'API](../developpement/conventions-api.md) : nommage des champs, structure des payloads, règles Spectral.
- [Tests](../developpement/tests.md) : tests de contrat entre le backend et le contrat.
- [Sécurité](securite.md) : détail des mécanismes d'authentification et de la gestion des jetons.
