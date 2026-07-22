---
label: "ADR-0030 : Java 25 et Quarkus courant"
order: 300
icon: law
description: "Pourquoi le Backend utilise Java 25 et la version stable courante de Quarkus, avec une cadence de mise à jour assumée."
---

# ADR-0030 : Java 25 et Quarkus courant

## Statut

Accepté, 2026-07-22.

## Contexte

L'[ADR-0003](adr-0003-quarkus.md) a choisi Quarkus sur Java 21. L'[ADR-0019](adr-0019-maintien-java-temporal-differe.md) a ensuite conservé ce runtime pour protéger le Backend transactionnel déjà livré et a différé Temporal. Ces décisions précédaient le support complet de Java 25 par Quarkus 3.31.

Au 2026-07-22, Quarkus 3.37.3 est la dernière version stable active. Quarkus 3.33 est la dernière LTS recommandée pour la production. La version 3.25.4 utilisée par Surplasse n'est plus maintenue. Choisir la version stable courante plutôt que la LTS donne accès aux correctifs et améliorations les plus récents, mais impose de suivre chaque train mineur avant sa fin de maintenance.

La migration a été éprouvée sur le monorepo avant la décision. Le rapport de mise à jour Quarkus confirme que toutes les extensions utilisées restent alignées sur le BOM 3.37.3. La compilation Java 25, les migrations Flyway sur PostgreSQL 17, les tests unitaires et les tests d'intégration Quarkus passent. Les adaptations requises par Quarkus 3.31 sont appliquées : artefact de test `quarkus-junit`, transmission de l'`argLine` Surefire et Testcontainers 2 fourni par le BOM. PostgreSQL 17 dépasse le minimum PostgreSQL 14 de Hibernate ORM 7.4 livré par Quarkus 3.37.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Java 25 et dernière version stable de Quarkus** | Runtime LTS actuel ; support complet depuis Quarkus 3.31 ; correctifs et fonctions les plus récents ; génération de bytecode Quarkus optimisée sur Java 25 | Quarkus 3.37 n'est pas une LTS ; chaque nouveau train mineur doit être qualifié rapidement |
| Java 25 et dernière LTS de Quarkus | Support Quarkus pendant douze mois ; cadence de migration plus faible ; recommandation officielle pour la production | Décalage volontaire par rapport à la version stable courante ; améliorations récentes reçues plus tard |
| Conserver Java 21 et Quarkus 3.25.4 | Aucun changement immédiat de l'outillage | Train Quarkus arrivé en fin de maintenance ; runtime antérieur sans bénéfice démontré pour le projet |

## Décision

Nous conservons le monolithe modulaire Quarkus et fixons **Java 25** comme version unique de compilation, de test et d'exécution du Backend. Le compilateur Maven cible la release 25. La CI, la génération OpenAPI et les images de build et d'exécution utilisent Temurin 25. Le fichier `.sdkmanrc` fixe la version locale de référence.

Nous suivons la **dernière version stable de Quarkus**, actuellement 3.37.3, sans attendre une LTS. La version reste épinglée dans le BOM et le plugin Maven pour rendre chaque build reproductible. Une nouvelle version n'entre dans le dépôt qu'après lecture de ses guides de migration, contrôle d'alignement des extensions, suite Backend complète, construction de l'image et vérification de son démarrage. La mise à jour doit intervenir avant la fin de maintenance du train courant.

Le wrapper passe à Maven 3.9.16, Surefire 3.5.4 et Spotless 3.8.0. Ces versions sont compatibles avec Quarkus 3.37.3, JUnit 6 et le compilateur Java 25. Ces outils restent fournis par le dépôt, sans installation Maven globale.

La décision sur l'orchestration ne change pas. PostgreSQL reste la source de vérité métier. Temporal n'entre ni dans le MVP ni dans la phase 2. Il sera réévalué seulement lorsqu'un parcours réel cumulera plusieurs besoins de longue durée, d'attente externe, de reprise, de compensation et de visibilité opérationnelle.

## Conséquences

### Positives

- Le Backend utilise un runtime LTS actuel pris en charge par Quarkus.
- La version Quarkus utilisée est maintenue et toutes les extensions restent gérées par un BOM unique.
- La même version majeure de Java couvre le poste, la CI, la génération, les tests et les conteneurs de production.
- La migration conserve le code transactionnel, le modèle PostgreSQL et les frontières du monolithe modulaire.

### Négatives et dettes assumées

- Le train Quarkus 3.37 est non LTS et sera remplacé dès la sortie de 3.38 ; Surplasse assume cette cadence de qualification.
- Chaque montée mineure peut inclure des changements Hibernate ORM, JUnit, Testcontainers ou de configuration qui exigent une lecture des guides et une validation complète.
- Les images Temurin sont épinglées par digest et doivent être actualisées à chaque correctif Java 25 pertinent.
- Java 21 reste visible dans les ADR remplacés et dans certaines preuves historiques ; ces mentions décrivent l'état passé, pas un runtime encore accepté.

## Références

- [Quarkus 3.37.3](https://quarkus.io/blog/quarkus-3-37-3-released/)
- [Versions et maintenance de Quarkus](https://quarkus.io/releases/)
- [Guide de migration Quarkus 3.31](https://github.com/quarkusio/quarkus/wiki/Migration-Guide-3.31)
- [Guide de migration Quarkus 3.37](https://github.com/quarkusio/quarkus/wiki/Migration-Guide-3.37)
- [Optimisations de build et support Java 25](https://quarkus.io/blog/building-large-applications/)
- [Notes de version Maven 3.9.16](https://maven.apache.org/docs/3.9.16/release-notes.html)
- [Spotless Maven 3.8.0](https://github.com/diffplug/spotless/releases/tag/maven/3.8.0)
