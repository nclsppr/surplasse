---
label: "ADR-0005 : PostgreSQL"
order: 50
icon: law
description: "Pourquoi Surplasse retient PostgreSQL 17 comme unique moteur de données, avec des migrations Flyway, plutôt que MySQL ou MongoDB."
---

# ADR-0005 : PostgreSQL comme unique moteur de données

## Statut

Accepté, 2026-07-18.

## Contexte

Le backend Quarkus persiste des données de natures très différentes (voir [le modèle de données](../architecture/donnees.md)) :

| Domaine | Nature des données | Exigence dominante |
|---|---|---|
| Commandes et paiements | Fortement relationnelles, de l'argent en jeu | Transactions strictes, aucune perte, aucun doublon |
| La carte | Catégories, produits, options, prix | Relationnel classique, intégrité référentielle |
| Établissements et espaces | Espaces pré-générés, revendications, comptes restaurateurs | Relationnel, unicité, traçabilité de la revendication |
| Lignes de commande | Options et prix figés au moment de l'achat | Instantané immuable, structure variable selon le produit |
| Embarquement | Résultats bruts d'extraction de carte par l'API Claude | Payloads semi-structurés, schéma évolutif |
| Travaux asynchrones | Génération d'espaces, extraction IA, envois d'emails | File de travaux fiable |

Deux formes cohabitent donc : un cœur relationnel et transactionnel (l'argent, les commandes, la carte) et des payloads flexibles dont le schéma bouge vite (les options figées d'une ligne de commande, les sorties du modèle de vision). S'y ajoutent des besoins annexes, files de travaux et cache, qui appellent classiquement un second moteur (Redis, broker de messages).

Le cas des lignes de commande illustre la tension. Quand un client valide sa commande, chaque ligne doit figer le produit, ses options choisies et son prix tels qu'ils étaient à cet instant : la carte peut changer une heure après, le ticket, lui, ne bouge plus. Cet instantané a une structure qui varie selon le produit (une cuisson, trois suppléments, une taille), ce qui se modélise mal en colonnes fixes mais très bien en document figé. À l'inverse, la commande elle-même (montant, statut, établissement, paiement) exige des colonnes typées, des contraintes et des jointures.

L'équipe est réduite et la cible d'exploitation est un VPS avec Docker Compose. Chaque moteur supplémentaire est un service de plus à installer, sauvegarder, superviser et mettre à jour ; chaque frontière entre moteurs est un endroit où la cohérence des données doit être recousue à la main. La question à trancher : quel moteur principal, et combien de moteurs au total ?

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **PostgreSQL 17** | Transactions ACID éprouvées, adaptées à l'argent et aux commandes ; JSONB indexable pour les payloads flexibles ; `SELECT ... FOR UPDATE SKIP LOCKED` et `LISTEN/NOTIFY` permettent des files de travaux correctes sans broker ; Dev Services et Testcontainers de première classe côté Quarkus ; écosystème Flyway et Hibernate mature | Exige une discipline de migrations stricte ; le réglage fin (index, vacuum) doit être appris par l'équipe |
| **MySQL 8** | Très répandu, hébergeurs et outillage abondants ; performant en lecture | Type JSON moins riche et moins bien indexable que JSONB ; DDL non transactionnel, une migration Flyway qui échoue laisse la base dans un état intermédiaire ; aucun avantage décisif sur PostgreSQL pour ce projet |
| **MongoDB** | Schéma flexible natif, adapté aux payloads d'extraction IA ; montée en charge horizontale | Transactions multi-documents plus récentes et plus coûteuses, inconfortable pour l'argent ; pas de jointures naturelles pour la carte et les commandes ; imposerait en pratique un second moteur relationnel à côté, soit deux systèmes à opérer |

Une quatrième option implicite a été écartée d'emblée : combiner un moteur relationnel et un moteur spécialisé (Redis pour les files et le cache, un store documentaire pour les payloads). Elle cumule les inconvénients d'exploitation de deux services pour des volumes qui, au MVP, ne le justifient pas. Le tableau des options la traite en creux : c'est précisément ce que la capacité JSONB et les files en tables de PostgreSQL permettent d'éviter.

MySQL n'est pas écarté pour une faiblesse rédhibitoire mais par absence d'avantage : à choix équivalent, JSONB, le DDL transactionnel (une migration échoue proprement ou s'applique entièrement) et la qualité de l'intégration Quarkus font pencher la balance. MongoDB, lui, échoue sur le critère décisif : le cœur du système est de l'argent et des commandes, un domaine où les garanties transactionnelles relationnelles restent la référence, et où il aurait de toute façon fallu un moteur relationnel en plus.

## Décision

Surplasse retient **PostgreSQL 17 comme unique moteur de données**, avec **Flyway** pour les migrations et **Hibernate ORM avec Panache** (repository pattern) comme couche d'accès.

Les principes d'application :

- **Une seule base**, avec des schémas par domaine si le besoin de cloisonnement apparaît. Pas de base par application : les frontends ne parlent jamais à la base, seulement au backend via [le contrat](../architecture/api.md).
- **Migrations Flyway versionnées, jamais de DDL manuel.** Toute évolution de schéma est un fichier de migration relu et committé ; la base de production n'est jamais modifiée à la main. La CI rejoue l'ensemble des migrations sur une base vierge à chaque changement.
- **Le relationnel par défaut, JSONB par exception.** Tout ce qui se requête, se joint ou se contraint reste en colonnes typées. Les colonnes JSONB sont réservées aux payloads dont le schéma est réellement variable.
- **Pas de Redis au MVP.** Les files de travaux s'appuient sur des tables dédiées consommées avec `SKIP LOCKED`, le cache applicatif sur des tables ou sur la mémoire du backend. Ce choix tient tant que la charge le permet ; il sera réévalué, mesures à l'appui, si les volumes l'exigent.
- **Dev Services et Testcontainers.** En développement, Quarkus provisionne PostgreSQL automatiquement ; les tests d'intégration s'exécutent contre un vrai PostgreSQL 17 éphémère, jamais contre une base en mémoire d'un autre moteur.

Les usages prévus de JSONB, limitativement :

| Usage | Contenu | Pourquoi JSONB |
|---|---|---|
| Lignes de commande figées | Produit, options choisies, prix au moment de l'achat | Instantané immuable, structure variable selon le produit |
| Extraction IA de l'embarquement | Sortie brute du modèle de vision avant validation par le restaurateur | Schéma imposé par le modèle, évolutif, conservé pour audit et rejeu |
| Événements webhooks entrants | Payloads Stripe reçus, avant traitement | Archive fidèle de ce qui a été reçu, indépendante du modèle interne |

Toute nouvelle colonne JSONB hors de cette liste doit être justifiée en revue, sinon elle est refusée au profit de colonnes typées.

```
                    backend Quarkus
                          |
              Hibernate ORM avec Panache
                          |
                  +---------------+
                  | PostgreSQL 17 |
                  +---------------+
                  | relationnel   |  commandes, paiements, carte,
                  |               |  etablissements, espaces
                  | JSONB         |  lignes figees, extractions IA
                  | files (tables |  travaux asynchrones
                  |  SKIP LOCKED) |
                  +---------------+
                          |
                   migrations Flyway
                (versionnees, en CI, jamais
                     de DDL manuel)
```

!!! warning Un seul moteur, une seule panne possible
Concentrer toutes les données dans un moteur unique fait de PostgreSQL le point de défaillance central du système. Les sauvegardes automatisées, testées par des restaurations régulières, sont une exigence de mise en production, pas une option. La stratégie est détaillée côté [opérations](../operations/index.md).
!!!

## Conséquences

### Positives

- Un seul service de données à installer, sauvegarder, superviser et mettre à jour sur le VPS. La pile d'exploitation reste à la portée d'une petite équipe.
- Les transactions couvrent l'ensemble du domaine : créer une commande, figer ses lignes et enregistrer le paiement associé tient dans une transaction unique, sans cohérence à recoudre entre moteurs.
- JSONB absorbe les payloads flexibles sans second store documentaire : les sorties d'extraction IA de l'embarquement évoluent sans migration de schéma.
- Les tests d'intégration sont fidèles à la production : même moteur, même version, via Testcontainers.
- Le développement local démarre sans configuration grâce aux Dev Services de Quarkus.

### Négatives et dettes assumées

- Tout repose sur une seule base : les sauvegardes sont critiques et leur restauration doit être testée régulièrement. C'est la contrepartie assumée de la simplicité d'exploitation.
- La discipline de migrations est non négociable : une équipe qui s'autorise un DDL manuel « juste cette fois » perd la traçabilité du schéma. La CI doit exécuter les migrations sur base vierge à chaque changement.
- Les files de travaux en PostgreSQL sont une dette technique explicite : correctes à faible volume, elles devront être réévaluées (Redis, broker) si la charge des travaux asynchrones croît. Le code des files doit rester isolé derrière une interface pour permettre ce remplacement.
- L'usage de JSONB doit être surveillé : la facilité de tout mettre en JSONB éroderait le modèle relationnel. La revue de code applique la règle « relationnel par défaut ».

Les signaux qui déclencheront une réévaluation du « tout PostgreSQL » :

| Signal | Réponse envisagée |
|---|---|
| Files de travaux saturées, latence de traitement qui dégrade l'embarquement ou les commandes | Introduire Redis ou un broker de messages, derrière l'interface de file existante |
| Cache applicatif trop volumineux pour la mémoire du backend | Introduire Redis en cache dédié |
| Volumétrie analytique qui pèse sur la base transactionnelle | Répliques en lecture, puis entrepôt séparé si nécessaire |

Chacune de ces évolutions fera l'objet d'un ADR dédié, chiffres de charge à l'appui.

Décisions liées : [ADR-0004 : trois applications React séparées](adr-0004-trois-frontends-react.md), [ADR-0006 : SSE pour le temps réel](adr-0006-sse.md).
