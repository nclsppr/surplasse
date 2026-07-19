---
label: "Décisions (ADR)"
order: 50
icon: law
description: Pourquoi Surplasse consigne ses décisions structurantes dans des ADR, le format commun, le cycle de vie et le registre des décisions acceptées.
---

# Le processus ADR

Un ADR (Architecture Decision Record, enregistrement de décision d'architecture) est un document court qui capture une décision structurante : le problème, les options envisagées, le choix retenu et ses conséquences. Chaque ADR vit dans ce dossier, sous la forme d'un fichier `adr-NNNN-titre.md` numéroté séquentiellement.

Cette page décrit le processus lui-même : pourquoi il existe, comment un ADR est rédigé, comment il évolue, et quelle autorité il a sur le reste de la documentation. Le registre complet des ADR acceptés figure [en fin de page](#registre-des-adr).

## Pourquoi des ADR

Surplasse est un projet mené par un développeur seul. C'est précisément ce contexte qui rend les ADR indispensables, pour trois raisons.

**La mémoire des décisions.** Sur un projet d'équipe, une décision survit dans les têtes de plusieurs personnes, dans les discussions de PR, dans les canaux de discussion. Sur un projet solo, elle ne survit nulle part : six mois plus tard, seul reste le résultat, sans les raisons. Un ADR fige le raisonnement au moment où il est frais, avec les contraintes réelles de l'époque, pas celles qu'on reconstruit de mémoire.

**Éviter de rejouer les débats.** Le risque principal du développeur solo n'est pas de prendre de mauvaises décisions, c'est de reprendre indéfiniment les mêmes. Chaque fois qu'une friction apparaît (un générateur capricieux, une extension manquante), la tentation de tout remettre en cause revient. L'ADR coupe court : la question a été instruite, les options pesées, la décision prise. On ne rouvre pas le débat sur un coup de fatigue, on rouvre le débat en rédigeant un nouvel ADR qui remplace l'ancien, avec de nouveaux arguments.

**Un exercice de rigueur.** Rédiger la section « Options considérées » oblige à instruire sérieusement les alternatives avant de trancher. Plusieurs décisions du projet ont changé pendant leur rédaction : l'exercice n'est pas une formalité d'archivage, c'est un outil de décision.

!!! info Décision structurante, définition pratique
Une décision mérite un ADR si la remettre en cause dans un an coûterait plus d'une semaine de travail, ou si elle contraint la forme de plusieurs composants à la fois. Le choix d'une bibliothèque de dates n'est pas un ADR. Le choix du framework backend en est un.
!!!

## Le format d'un ADR

Chaque ADR suit exactement la même structure, dans cet ordre :

| Section | Contenu attendu |
|---|---|
| **Statut** | L'état courant et sa date : « Accepté, AAAA-MM-JJ » ou « Remplacé par ADR-XXXX, AAAA-MM-JJ » |
| **Contexte** | Le problème à résoudre et les contraintes du moment, en 2 à 4 paragraphes de prose |
| **Options considérées** | Un tableau : option, avantages, inconvénients. Toutes les options sérieusement envisagées, y compris celles rejetées vite |
| **Décision** | L'option retenue et pourquoi. Ferme, argumentée, à la voix active : « Nous retenons X parce que » |
| **Conséquences** | Deux listes : les conséquences positives, puis les conséquences négatives et dettes assumées |

Quelques règles de rédaction complémentaires :

- Le front matter porte un `label` de la forme « ADR-NNNN : titre court » et l'icône `law`.
- Le contexte décrit les contraintes telles qu'elles étaient au moment de la décision. On ne le réécrit jamais a posteriori pour le rendre plus flatteur.
- La section « Décision » ne recopie pas le tableau des options : elle nomme le choix et déroule l'argument qui l'emporte.
- Les conséquences négatives ne sont pas une figure de style. Chaque décision a un coût ; un ADR qui n'en liste aucun est suspect et doit être retravaillé.
- Le style suit les conventions générales de la documentation (français, dates au format AAAA-MM-JJ, ton sobre).

## Le cycle de vie

Un ADR passe par trois états au maximum :

```
+----------+       acceptation      +----------+     nouvel ADR      +---------------------+
| Proposé  | ---------------------> | Accepté  | ------------------> | Remplacé par        |
|          |                        |          |                     | ADR-XXXX            |
+----------+                        +----------+                     +---------------------+
     |                                   ^
     | abandon : le fichier est          | un ADR accepté ne se
     | supprimé, le numéro n'est         | modifie plus jamais
     | pas réutilisé                     | sur le fond
     +-----------------------------------+
```

**Proposé.** L'ADR est rédigé, les options sont instruites, mais la décision n'est pas encore actée. Sur un projet solo, cet état est souvent bref : il sert surtout quand la rédaction fait émerger un doute qui demande une expérimentation avant de trancher.

**Accepté.** La décision est prise et fait autorité. À partir de ce moment, l'ADR est immuable sur le fond : on peut corriger une coquille ou un lien cassé, jamais changer le contexte, les options, la décision ou les conséquences. C'est cette immuabilité qui fait la valeur du document : il photographie un raisonnement daté.

**Remplacé par ADR-XXXX.** Si la décision doit changer, on rédige un nouvel ADR qui expose le nouveau contexte, référence l'ancien et le déclare remplacé. L'ancien ADR reste dans le dossier, son statut passe à « Remplacé par ADR-XXXX » (c'est la seule modification de statut autorisée après acceptation). L'historique des revirements est ainsi aussi lisible que les décisions elles-mêmes.

Les numéros sont séquentiels, sur quatre chiffres, et ne sont jamais réutilisés, même après l'abandon d'une proposition.

## La règle de préséance

La hiérarchie des sources de vérité documentaires est la suivante, de la plus forte à la plus faible :

1. `docs/AGENTS.md` pour la terminologie, la stack de référence et les conventions de rédaction ;
2. les ADR acceptés de ce dossier pour les décisions d'architecture ;
3. toutes les autres pages de la documentation.

Concrètement : **un ADR accepté gagne sur toute autre page de doc**. Si une page d'architecture, un parcours produit ou une convention de développement contredit un ADR, c'est la page qui est en tort et qui doit être corrigée. Les pages descriptives (comme [le backend](../architecture/backend.md) ou [l'API](../architecture/api.md)) développent et illustrent les décisions ; elles ne les prennent pas.

!!! warning En cas de contradiction
Ne jamais « corriger » un ADR pour l'aligner sur une page plus récente. Soit la page est fausse et on la corrige, soit la décision a réellement changé et on rédige un nouvel ADR de remplacement. Il n'y a pas de troisième voie.
!!!

## Registre des ADR

Quinze ADR sont acceptés à ce jour. Ils couvrent les choix structurants du projet, de l'organisation du dépôt jusqu'au modèle de commission.

| Numéro | Titre | Statut | Lien |
|---|---|---|---|
| 0001 | Un monorepo unique | Accepté | [ADR-0001](adr-0001-monorepo.md) |
| 0002 | Contract-first : le contrat OpenAPI comme source de vérité | Accepté | [ADR-0002](adr-0002-contract-first.md) |
| 0003 | Quarkus pour le Backend | Accepté | [ADR-0003](adr-0003-quarkus.md) |
| 0004 | Trois frontends React distincts | Accepté | [ADR-0004](adr-0004-trois-frontends-react.md) |
| 0005 | PostgreSQL comme unique base de données | Accepté | [ADR-0005](adr-0005-postgresql.md) |
| 0006 | SSE pour le temps réel | Accepté | [ADR-0006](adr-0006-sse.md) |
| 0007 | Stripe pour les paiements | Accepté | [ADR-0007](adr-0007-stripe.md) |
| 0008 | Magic link pour l'authentification des restaurateurs | Accepté | [ADR-0008](adr-0008-magic-link.md) |
| 0009 | Retype pour la documentation | Accepté | [ADR-0009](adr-0009-retype.md) |
| 0010 | Fournisseur IA (OpenAI derrière interface) | Accepté | [ADR-0010](adr-0010-fournisseur-ia.md) |
| 0011 | Visuels de plats générés | Accepté | [ADR-0011](adr-0011-visuels-plats.md) |
| 0012 | Tailwind et shadcn/ui | Accepté | [ADR-0012](adr-0012-tailwind-shadcn.md) |
| 0013 | Générateurs OpenAPI (jaxrs-spec et typescript-fetch) | Accepté | [ADR-0013](adr-0013-generateurs-openapi.md) |
| 0014 | Liaison de frontends/shared (file:, source TypeScript) | Accepté | [ADR-0014](adr-0014-liaison-shared.md) |
| 0015 | Modèle de commission (0 % pendant 3 mois, puis 1 %) | Accepté | [ADR-0015](adr-0015-modele-commission.md) |

Les décisions encore ouvertes (par exemple le choix de la solution d'impression thermique ESC/POS mentionné dans la stack de référence) donneront lieu à de futurs ADR au fil de la [roadmap](../roadmap.md).
