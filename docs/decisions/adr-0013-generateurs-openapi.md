---
label: "ADR-0013 : Générateurs OpenAPI"
order: 130
icon: law
description: "Pourquoi Surplasse génère les interfaces Java et le client TypeScript avec OpenAPI Generator seul (jaxrs-spec et typescript-fetch), versions figées, sorties committées."
---

# ADR-0013 : Générateurs OpenAPI

## Statut

Accepté, 2026-07-18.

## Contexte

Le contract-first est acté ([ADR-0002](adr-0002-contract-first.md)) : le backend implémente des interfaces Java générées depuis `api/openapi.yaml`, les frontends consomment un client TypeScript généré. Restait à figer les générateurs eux-mêmes, laissés ouverts par [l'architecture de l'API](../architecture/api.md) et [les conventions du contrat](../developpement/conventions-api.md) au moment de leur rédaction.

Les contraintes du choix :

- Côté Java, les interfaces doivent viser Jakarta REST (Quarkus 3, Java 21) et porter les annotations Bean Validation issues du contrat, pour que la validation de forme soit déclarative.
- Côté TypeScript, le client doit fournir des types fidèles au contrat, consommables par TanStack Query, sans imposer de dépendance lourde au front Commande (budget de performance strict).
- Les conventions du contrat imposent des **versions de générateurs figées**, une **génération committée** (le code généré est dans le dépôt, jamais édité à la main) et un **script unique** `npm run api:generate` qui filtre d'abord les blocs `x-draft`.
- La phase 1 de la [roadmap](../roadmap.md) interdit d'écrire un outillage custom : des générateurs éprouvés, rien d'autre.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **OpenAPI Generator seul : `jaxrs-spec` (Java) et `typescript-fetch` (TypeScript)** | Un seul outil, une seule version à épingler (`openapitools.json`) ; générateurs parmi les plus éprouvés de l'écosystème ; `jaxrs-spec` produit exactement des interfaces Jakarta avec Bean Validation ; `typescript-fetch` n'a aucune dépendance à l'exécution (fetch natif) | Code généré verbeux et d'un style daté (jamais édité, donc supportable) ; l'outil exige une JVM pour tourner |
| openapi-typescript + openapi-fetch côté TS, OpenAPI Generator côté Java | Types TS plus fins, empreinte minimale côté front | Deux outils, deux épinglages, deux écosystèmes de configuration ; s'écarte de l'intention documentée sans gain décisif au MVP |
| Orval côté TS (hooks TanStack Query générés) | Intégration Query immédiate | Couple le code généré à la bibliothèque de data-fetching ; une couche de magie de plus à comprendre ; le client doit rester neutre |
| Extension `quarkus-openapi-generator` côté Java | Génération intégrée au build Maven | Génère au build (dans `target/`), ce qui contredit la règle de génération committée ; extension orientée clients plus que serveur |

## Décision

Nous retenons **OpenAPI Generator seul**, piloté par `@openapitools/openapi-generator-cli` (paquet npm qui épingle la version exacte du générateur dans `openapitools.json`), parce qu'un outil unique à version unique est ce qui se fige et s'audite le mieux, et que ses deux générateurs couvrent exactement les deux besoins :

- **`jaxrs-spec`** produit les interfaces Java et les DTO dans `backend/contract/` (packages `com.surplasse.contract.api` et `com.surplasse.contract.model`), avec `interfaceOnly`, `useJakartaEe`, `useTags` (une interface par tag, donc par domaine) et Bean Validation activée.
- **`typescript-fetch`** produit le client typé dans `frontends/shared/src/api/generated/`, sans dépendance à l'exécution.

Les deux sorties sont **committées** et régénérées exclusivement par `npm run api:generate`, qui filtre les blocs `x-draft` avant génération. La CI vérifie la fraîcheur : elle régénère et échoue si `git diff` n'est pas vide. Une montée de version du générateur est un commit dédié avec régénération complète.

## Conséquences

### Positives

- Une seule version d'outil à épingler et à monter, un seul format de configuration.
- Le code généré est visible en revue et dans les diffs : une évolution du contrat montre exactement ce qu'elle change chez les consommateurs.
- Le backend compile sans exécuter de générateur : le module `contract` est du source ordinaire.
- Aucune dépendance d'exécution ajoutée aux frontends.

### Négatives et dettes assumées

- La génération exige une JVM en local et en CI, y compris pour le seul client TypeScript. Acceptable : Java 21 est déjà un prérequis du projet.
- Le client `typescript-fetch` est plus verbeux que les solutions à types purs ; on n'en consomme que la surface utile.
- Les montées de version du générateur produisent des diffs massifs de code généré, à relire globalement plutôt que ligne à ligne.
- Le filtre `x-draft` reste un petit script maison (quelques dizaines de lignes), assumé comme la seule pièce non standard de la chaîne.
