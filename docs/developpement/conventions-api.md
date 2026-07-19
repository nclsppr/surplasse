---
label: Conventions du contrat
order: 50
icon: plug
description: Rituel de modification, règles de rédaction, lint et génération autour du contrat OpenAPI, source de vérité de l'API.
---

# Conventions du contrat

Le contrat vit dans `api/openapi.yaml`. Il est la source de vérité de l'API : le backend l'implémente, les frontends consomment des clients TypeScript générés depuis lui. L'architecture générale de l'API est décrite dans [la page API](../architecture/api.md) ; cette page fixe les règles de travail quotidiennes autour du fichier lui-même.

Le principe qui gouverne tout le reste tient en une phrase : **le commit du contrat précède l'implémentation**. Aucune route n'apparaît dans le backend, aucun appel n'apparaît dans un frontend, sans avoir d'abord existé dans le contrat.

## Le rituel de modification

Un changement d'API commence toujours par une discussion dans le fichier. Pas de document parallèle, pas de spécification dans un ticket : la proposition s'écrit directement dans `api/openapi.yaml`, marquée `x-draft`, et c'est ce texte que l'on commente, amende et fait mûrir.

Le cycle de vie d'un changement suit quatre étapes :

| Étape | Action | État du contrat |
|---|---|---|
| 1. Proposition | L'endpoint ou le schéma est rédigé dans le contrat avec `x-draft: true` | Brouillon, exclu de la génération |
| 2. Discussion | La proposition est ajustée par commits successifs sur le fichier | Brouillon |
| 3. Stabilisation | Le marqueur `x-draft` est retiré, le lint complet et le contrôle de compatibilité s'appliquent | Contractuel |
| 4. Implémentation | Le backend implémente, les frontends régénèrent leurs clients et consomment | Contractuel, implémenté |

Chaque étape correspond à au moins un commit préfixé `api:`, conformément au [workflow git](./workflow-git.md). Le passage de l'étape 3 à l'étape 4 peut être immédiat pour un changement trivial, mais l'ordre ne s'inverse jamais : on ne « met à jour le contrat après coup » sous aucun prétexte.

!!! info Pourquoi ce rituel
Le contrat est le seul artefact lu par les quatre applications et par les générateurs. Discuter dans le fichier garantit que la discussion porte sur le texte exact qui sera généré, et que l'historique git du contrat raconte l'histoire complète de l'API.
!!!

## Règles de rédaction

Le contrat est rédigé **en anglais** : chemins, identifiants, `summary`, `description` et exemples. Le français reste la langue de la documentation Retype ; le contrat, lui, est un artefact de code.

| Règle | Détail |
|---|---|
| `operationId` explicite et stable | En camelCase, verbe puis ressource (`listOrders`, `createOrder`, `getMenu`). Il nomme les méthodes générées côté TypeScript et Java : le renommer est un changement cassant, traité comme tel |
| `summary` et `description` partout | Chaque opération, chaque paramètre, chaque propriété de schéma. Le `summary` tient sur une ligne, la `description` explique le pourquoi et les cas limites |
| Exemples obligatoires | Chaque schéma nommé et chaque réponse déclarent au moins un `example`. Les exemples servent de base aux mocks frontend et aux fixtures de test |
| Composants réutilisés | Tout schéma utilisé plus d'une fois vit dans `components/schemas`. Aucun schéma dupliqué, aucun schéma anonyme dans une réponse |
| Erreurs en Problem Details | Toute réponse d'erreur (4xx, 5xx) est déclarée explicitement et référence le schéma `Problem` (RFC 9457). Une erreur non déclarée dans le contrat est un bug de contrat, pas un détail d'implémentation |

Quelques conventions complémentaires : les chemins sont en kebab-case et au pluriel pour les collections (`/establishments/{id}/orders`), chaque opération porte un `tag` déclaré au niveau racine (un tag par domaine métier), et les énumérations sont des `enum` fermés documentés valeur par valeur.

## Le lint Spectral

Le jeu de règles Spectral est committé dans `api/` (fichier `.spectral.yaml`, à côté du contrat). Il étend le jeu standard `spectral:oas` et le durcit. Le lint s'exécute en CI sur chaque push touchant `api/`, et en local avant tout commit du contrat.

Règles clés prévues :

| Règle | Exigence |
|---|---|
| `operation-operationId` | `operationId` présent, unique et en camelCase sur chaque opération |
| `operation-summary` | `summary` présent sur chaque opération |
| `operation-description` | `description` présente sur chaque opération |
| `schema-example` | Chaque schéma de `components/schemas` porte un exemple |
| `response-example` | Chaque réponse déclarée porte un exemple |
| `no-inline-schema` | Les corps de requête et de réponse référencent des composants, jamais de schéma anonyme |
| `error-problem-details` | Toute réponse 4xx ou 5xx référence le schéma `Problem` |
| `path-kebab-case` | Segments d'URL en kebab-case |
| `operation-tag-defined` | Chaque tag utilisé est déclaré au niveau racine avec une description |
| `no-unused-components` | Aucun composant orphelin |

Les blocs marqués `x-draft: true` bénéficient d'un régime allégé : les règles d'exemples et de description complète ne s'y appliquent pas encore, pour ne pas freiner la phase de discussion. Le régime complet s'applique dès que le marqueur tombe.

En local, le lint et le contrôle de compatibilité passent par deux scripts à la racine, avec les mêmes versions d'outils que la CI :

```bash
npm run api:lint   # Spectral sur api/openapi.yaml
npm run api:diff   # oasdiff contre la derniere version publiee
```

Un commit du contrat qui n'a pas fait tourner ces deux commandes en local se découvre en CI : autant les lancer avant.

## Le contrôle de compatibilité

La CI exécute **oasdiff** entre la dernière version publiée du contrat et la version du commit. Un changement cassant (suppression d'un champ, resserrement d'un type, retrait d'un endpoint, renommage d'un `operationId`) fait échouer le build.

La dérogation existe mais elle est explicite et exceptionnelle : le commit qui assume un changement cassant le déclare avec le préfixe `api!:` dans son message. La CI accepte alors la rupture, et le message de commit doit expliquer pourquoi elle est nécessaire et comment les consommateurs migrent.

!!! warning Reste à trancher
Le point de comparaison exact d'oasdiff (dernier tag de version du contrat, ou état du commit précédent sur `main`) et la politique de versionnement du contrat (SemVer dans `info.version` ou simple date) feront l'objet d'un ADR sous `docs/decisions/`. En attendant, tout changement cassant est traité comme interdit par défaut.
!!!

## La convention x-draft

Un endpoint ou un schéma en cours de conception porte l'extension `x-draft: true` :

```yaml
paths:
  /establishments/{id}/claims:
    post:
      x-draft: true
      operationId: submitClaim
      summary: Submit a claim for a pre-generated establishment
```

Les effets du marqueur :

| Aspect | Comportement |
|---|---|
| Génération | Le bloc est exclu : aucune méthode TypeScript, aucune interface Java n'est produite |
| Lint Spectral | Régime allégé (voir section précédente) |
| oasdiff | Le bloc est ignoré : modifier ou supprimer un brouillon n'est jamais cassant |
| Documentation d'API | Le bloc apparaît, marqué comme brouillon, pour nourrir la discussion |

Un bloc `x-draft` n'existe pas pour les consommateurs : personne ne l'implémente, personne ne l'appelle. Retirer le marqueur est l'acte qui rend l'endpoint contractuel, et ce retrait constitue un commit à part entière.

## La convention x-sse

Les endpoints de temps réel (Server-Sent Events) portent l'extension `x-sse: true`. Contrairement à `x-draft`, un bloc `x-sse` est **pleinement contractuel** : lint complet, contrôle de compatibilité, documentation. Il est en revanche **exclu de la génération**, des deux côtés, pour une raison technique assumée : côté backend, un flux SSE Quarkus retourne un `Multi` Mutiny qu'aucune interface générée ne sait exprimer ; côté frontend, le flux est consommé par l'API navigateur `EventSource`, pas par le client généré (c'est d'ailleurs la seule exception à la règle « aucun appel réseau hors du client généré », et elle reste confinée aux hooks SSE). Les resources SSE sont donc écrites à la main, en conformité avec le contrat, et leurs tests d'intégration vérifient cette conformité.

La même logique vaut pour l'extension **`x-raw-body`**, portée par le webhook Stripe : la vérification de signature exige le corps brut de la requête, qu'une interface générée désérialisante ne peut pas fournir. Le bloc reste pleinement contractuel, sa resource est écrite à la main et testée contre le contrat.

## La génération

La génération des clients et des interfaces passe par un script unique à la racine du monorepo :

```bash
npm run api:generate
```

Le script enchaîne quatre étapes : filtrage des blocs `x-draft`, génération des interfaces Java, génération du client TypeScript, puis suppression de son origine de repli. Le contrat déclare un serveur relatif `/`. Chaque frontend doit donc injecter `API_URL` depuis le profil de domaines actif lors de la création du client. Aucun client généré ne peut choisir silencieusement `localhost`, `.test` ou `.com`.

```
              api/openapi.yaml  (le contrat)
                      |
                      v
         npm run api:generate (versions figées)
              |                    |
              v                    v
     client TypeScript      interfaces Java + DTO
     frontends/shared/      module Maven dedie
       |      |      |             |
       v      v      v             v
  Onboarding  |  Dashboard      Backend
           Commande
```

| Sortie | Destination | Consommateur |
|---|---|---|
| Client TypeScript typé | `frontends/shared/` | Onboarding, Commande, Dashboard, via TanStack Query |
| Interfaces Java (JAX-RS) et DTO | Module dédié du backend Maven | Le Backend les implémente |

Deux règles non négociables :

- **Versions figées.** Les versions des générateurs sont épinglées dans la configuration du script. Une montée de version de générateur est un commit dédié, avec régénération complète et vérification que le diff généré est compris.
- **Le code généré ne s'édite jamais à la main.** Toute divergence souhaitée passe par le contrat ou par la configuration du générateur. La CI contrôle sa fraîcheur et l'absence d'une origine de repli. Les tests fonctionnels portent sur les fabriques de clients, pas sur les détails internes du générateur. Voir [la stratégie de tests](./tests.md).

Les outils de génération sont figés par l'[ADR-0013](../decisions/adr-0013-generateurs-openapi.md) : OpenAPI Generator seul (`jaxrs-spec` vers `backend/contract/`, `typescript-fetch` vers `frontends/shared/src/api/generated/`), version épinglée dans `openapitools.json`. Le contrat, lui, reste écrit pour être générateur-agnostique.

## Pages liées

- [Architecture de l'API](../architecture/api.md) : découpage des ressources, authentification, temps réel.
- [Tests](./tests.md) : comment le contrat est vérifié des deux côtés, backend et frontends.
- [Workflow git](./workflow-git.md) : préfixes de commit et rythme de push.
