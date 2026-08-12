---
label: "ADR-0039 : Migrations de production séparées"
order: 390
icon: law
description: "Pourquoi la production exécute Flyway dans une commande dédiée avant le Backend, avec un rôle PostgreSQL distinct."
---

# ADR-0039 : migrations de production séparées du Backend

## Statut

Accepté, 2026-08-12.

## Contexte

Le profil local démarre le Backend et laisse Flyway appliquer les migrations avant la readiness. Ce comportement reste utile en développement et dans les tests, car la base est jetable et appartient à la même pile Compose.

La production Atlas partage PostgreSQL avec plusieurs projets. Le Backend Surplasse doit y utiliser un rôle limité aux opérations applicatives. Lui donner les droits de créer ou modifier le schéma augmenterait inutilement l'impact d'une compromission du processus HTTP. Un échec de migration doit aussi bloquer le déploiement avant le remplacement du Backend, sans laisser plusieurs instances tenter la même opération au démarrage.

Les migrations V1 à V14 sont déjà embarquées dans l'image Backend. Construire une seconde image à partir des mêmes sources dupliquerait la publication, le scan, la provenance et la promotion sans retirer de code au processus de migration.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Conserver `migrate-at-start` en production | Aucun nouveau point d'entrée | Le rôle runtime doit modifier le schéma ; chaque démarrage peut tenter une migration ; l'échec arrive pendant l'activation |
| Publier une image Flyway séparée avec une copie des scripts SQL | Séparation visible des responsabilités | Deux artefacts à garder strictement alignés ; risque de divergence des migrations ; chaîne de publication supplémentaire |
| **Exécuter une commande one-shot dans l'image Backend exacte** | Une seule source de migrations et un seul digest ; rôle et cycle de vie distincts | Le contrôleur doit ordonner PostgreSQL, migration, puis Backend ; l'image conserve une seconde commande à tester |

## Décision

La production Atlas exécute `/opt/surplasse/scripts/backend-migrate.sh` dans l'image Backend exacte avant de démarrer le service HTTP. Cette commande charge uniquement le mot de passe PostgreSQL depuis un fichier, exige un profil `production`, refuse un autre moteur que PostgreSQL, applique `classpath:db/migration`, puis se termine. Elle ne démarre aucun port HTTP, scheduler, mailer ou adaptateur Stripe.

Le job utilise le rôle `surplasse_migrator`. Le Backend long utilise le rôle `surplasse_runtime` et reçoit explicitement `QUARKUS_FLYWAY_MIGRATE_AT_START=false`. Un rôle propriétaire sans connexion détient les objets. Le contrôleur de production provisionne ces rôles hors de l'image et refuse le démarrage si la migration dédiée n'est pas verte.

Le développement et les tests conservent `migrate-at-start`. Cette décision ne transforme pas le job en service permanent et n'ajoute pas une sixième image applicative. Le job et le Backend consomment le même digest attesté.

## Conséquences

### Positives

- Le processus HTTP ne reçoit plus les droits de modifier le schéma en production Atlas.
- Une migration échoue avant l'activation du Backend.
- Les scripts SQL, le code applicatif et le runner restent liés au même digest.
- Un seul job peut être exécuté et observé par le contrôleur.

### Négatives et dettes assumées

- Le contrôleur Atlas doit provisionner trois rôles, distribuer deux mots de passe et vérifier leurs privilèges.
- La livraison exige une étape supplémentaire avant le démarrage des cinq services longs.
- Un retour arrière applicatif ne retire jamais une migration. Les migrations restent additives et compatibles avec le dernier digest sain.
- Le job doit être qualifié sur PostgreSQL 17 et inclus dans les contrôles de restauration avant le premier trafic réel.
