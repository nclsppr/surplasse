---
label: Conventions Quarkus
order: 40
icon: gear
description: Nommage des packages, couches et règles d'import, DTO et mapping, transactions, gestion des erreurs, configuration et interdits du Backend Quarkus.
---

# Conventions Quarkus

Cette page fixe les conventions de code du Backend : comment nommer, découper et écrire le Java qui vit dans `backend/`. Elle prolonge [le backend](../architecture/backend.md), qui décrit la structure d'ensemble (modules Maven, couches, SSE, événements de domaine, jobs asynchrones) : ici, on descend au niveau du package, de la classe et de la méthode. La stratégie de test associée est décrite dans [les tests](tests.md).

!!! info Documentation de référence
Ces conventions s'appliquent au code du backend (modules `common`, `contract`, `catalog`, `order`, `payment`, `identity`, `application`). Les points encore ouverts sont signalés explicitement. Le formatage est imposé par Spotless (palantir-java-format) : `./mvnw spotless:apply` avant de committer, la CI vérifie.
!!!

## Nommage des packages

La racine de tous les packages est `com.surplasse`. Chaque module Maven de domaine (voir [l'arborescence Maven](../architecture/backend.md#arborescence-maven-cible)) porte le package de son domaine :

| Package racine | Module | Domaine |
|---|---|---|
| `com.surplasse.catalog` | `catalog/` | La carte : établissements, catégories, produits, options, disponibilités |
| `com.surplasse.order` | `order/` | Le cycle de vie d'une commande et sa diffusion SSE |
| `com.surplasse.payment` | `payment/` | L'intégration Stripe : PaymentIntents, webhooks, comptes Connect |
| `com.surplasse.identity` | `identity/` | Restaurateurs, magic links, sessions, droits sur les établissements |
| `com.surplasse.engagement` | `engagement/` | Espaces pré-générés, revendication, relances, métriques d'usage |
| `com.surplasse.generation` | `generation/` | Jobs d'extraction IA, génération des mini-sites et des QR codes |
| `com.surplasse.common` | `common/` | Types partagés : événements de domaine, hiérarchie d'exceptions, identifiants |

Les identifiants Java suivent une règle simple : ils sont **en anglais**, conformément au lexique canonique français vers anglais défini dans `AGENTS.md`. Les noms de classes, d'entités, de colonnes et de valeurs d'enum reprennent l'anglais du lexique (`Product`, `Establishment`, `Space`) ; le vocabulaire technique de framework reste tel quel (`Resource`, `Repository`, `Mapper`, `slug`). Les classes sont suffixées par leur couche : `MenuResource`, `OrderService`, `ProductRepository`, `OrderMapper`.

À l'intérieur d'un module de domaine, les sous-packages suivent les couches. Le module type :

```
order/                                       # module Maven du domaine
├── pom.xml
└── src/
    ├── main/java/com/surplasse/order/
    │   ├── resource/     # implémente les interfaces générées depuis le contrat
    │   │   └── OrderResource.java
    │   ├── service/      # logique métier, transactions, événements
    │   │   └── OrderService.java
    │   ├── repository/   # accès aux données via Panache
    │   │   └── OrderRepository.java
    │   ├── entity/       # entités JPA, internes au module
    │   │   ├── Order.java
    │   │   └── OrderLine.java
    │   ├── mapping/      # mappers entité vers DTO du contrat
    │   │   └── OrderMapper.java
    │   └── config/       # @ConfigMapping du domaine
    │       └── OrderConfig.java
    └── test/java/com/surplasse/order/       # miroir des packages testés
```

Tous les modules suivent exactement cette structure : ce qui s'apprend sur `order` vaut pour `catalog` ou `payment`. Un sous-package vide n'est pas créé par avance ; il apparaît avec sa première classe.

## Les couches et leurs règles

Quatre couches, chacune avec un rôle strict :

- **Resource** : implémente l'interface Java générée depuis [le contrat](../architecture/api.md) (module `contract`). Elle ne contient aucune logique : elle convertit les DTO entrants, appelle un service, mappe le résultat en DTO sortant et laisse le mapper d'exceptions produire les erreurs. Une resource qui contient un `if` métier est un défaut de revue.
- **Service** : porte la logique métier, ouvre les transactions, orchestre les repositories, émet et observe les événements de domaine. C'est la seule couche qui décide.
- **Repository** : encapsule l'accès aux données via Panache (`PanacheRepository`). Les requêtes sont des méthodes nommées par intention (`findBySlug`, `findActiveByEstablishment`), jamais des chaînes de requête éparpillées dans les services.
- **Entity** : modélise le persistant en JPA et porte ses invariants simples. Une entité ne franchit jamais la frontière du module : l'API n'expose que les DTO du contrat.

Ce que chaque couche a le droit d'importer :

| Couche | Importe | N'importe jamais |
|---|---|---|
| Resource | interfaces et DTO du `contract`, services et mappers du module, `jakarta.ws.rs` | repositories, entités, Panache, `jakarta.persistence` |
| Service | repositories, entités et mappers du module, événements et interfaces de `common`, config du module | `jakarta.ws.rs` (ni requête HTTP, ni code de statut), services d'un autre domaine |
| Repository | entités du module, Panache, identifiants de `common` | services, resources, DTO du `contract` |
| Entity | `jakarta.persistence`, types simples de `common` | toutes les autres couches |
| Mapper | entités du module, DTO du `contract` | repositories, services |

La direction des dépendances est descendante et sans saut de couche : une resource ne touche jamais un repository, un service ne connaît jamais HTTP. Les frontières entre domaines (événements, interfaces explicites dans `common`) sont décrites dans [le backend](../architecture/backend.md#règles-de-dépendances-entre-modules).

## DTO et mapping

Les DTO ne s'écrivent pas à la main : ils sont générés depuis `api/openapi.yaml` dans le module `contract`, en même temps que les interfaces Java des resources (workflow décrit dans [conventions API et contrat](conventions-api.md)). Le contrat étant la source de vérité, toute évolution d'un DTO commence par une évolution du contrat, jamais par une classe Java.

La conversion entre entités et DTO est **explicite et centralisée dans des mappers dédiés**, un par agrégat, dans le sous-package `mapping/` :

- Le mapping manuel (méthodes statiques ou bean sans état qui construisent le DTO champ par champ) est le mode par défaut : il est trivial à lire, à déboguer et à tester, et rend visibles les champs volontairement non exposés.
- MapStruct est accepté quand un mapping devient volumineux et purement mécanique, mais il reste optionnel : un mapper manuel clair vaut mieux qu'une génération magique que personne ne relit.
- Un mapper ne calcule rien : il transporte. Un champ dérivé (total d'une commande, disponibilité d'un produit) est calculé par le service ou l'entité, puis transporté par le mapper.

!!! info Jamais d'entité dans l'API
La tentation de sérialiser une entité JPA « parce que les champs sont les mêmes » est le raccourci le plus coûteux du projet : il couple le schéma de base au contrat public et transforme chaque migration en rupture d'API. Le détour par le DTO du contrat est obligatoire, même quand il paraît redondant.
!!!

## Injection CDI par constructeur

Toute dépendance s'injecte **par constructeur**, jamais par champ. Les champs sont `final`, la classe affiche ses dépendances dans sa signature, et elle s'instancie sans conteneur dans un test unitaire :

```java
@ApplicationScoped
public class OrderService {

    private final OrderRepository repository;
    private final Event<OrderAccepted> orderAccepted;

    OrderService(OrderRepository repository,
                 Event<OrderAccepted> orderAccepted) {
        this.repository = repository;
        this.orderAccepted = orderAccepted;
    }
}
```

Avec un constructeur unique, l'annotation `@Inject` est superflue : on ne l'écrit pas. `@Inject` sur un champ est interdit, y compris dans les tests (préférer l'instanciation directe ou `@QuarkusTest` avec injection par constructeur). Les beans sont `@ApplicationScoped` par défaut ; tout autre scope se justifie en revue.

## Transactions

La règle de placement est simple et sans exception :

- `@Transactional` s'applique **au niveau du service**, sur les méthodes qui écrivent. Jamais sur une resource (la couche HTTP ne décide pas des frontières transactionnelles), jamais sur un repository (une requête isolée n'est pas une unité métier).
- Une méthode de service transactionnelle est une unité métier complète : tout ce qu'elle écrit est commité ensemble ou annulé ensemble.
- Les lectures pures ne portent pas `@Transactional`.
- L'émission d'événements de domaine observés en phase post-commit (voir [le backend](../architecture/backend.md#les-événements-de-domaine)) garantit qu'aucun effet secondaire ne part pour une transaction finalement annulée.

Pour les traitements longs, une règle absolue : **jamais de transaction ouverte pendant un appel externe**. Un appel Stripe ou un appel à l'API OpenAI peut durer des secondes ; le faire dans une transaction retiendrait une connexion du pool et des verrous pendant toute la durée de l'appel. Le motif imposé est en trois temps :

```
transaction courte 1        appel externe               transaction courte 2
enregistrer l'intention ──► Stripe, API OpenAI, email ──► enregistrer le résultat
(job « en attente »)        (hors transaction)           (succès ou échec, retentative)
```

C'est le fonctionnement du worker de jobs décrit dans [le backend](../architecture/backend.md#les-traitements-asynchrones) : l'insertion du job est transactionnelle, son exécution ne l'est pas, l'enregistrement de son résultat l'est de nouveau. Le magic link constitue une limite MVP documentée : son jeton est persisté dans une transaction courte, puis l'email part de façon asynchrone sans job durable. Un échec de remise n'annule pas le jeton et le restaurateur peut demander un nouveau lien.

!!! warning Le webhook Stripe n'échappe pas à la règle
Le traitement d'un webhook vérifie la signature et enregistre le fait métier dans une transaction courte ; toute conséquence lente (diffusion, ticket cuisine, email) passe par les événements post-commit ou par un job. Un webhook qui dépasse le délai de réponse de Stripe est retenté par Stripe, d'où l'exigence d'idempotence côté service.
!!!

## Gestion des erreurs

Chaque domaine lève des **exceptions métier** explicites, qui étendent une petite hiérarchie commune définie dans `com.surplasse.common`. Les resources ne les attrapent pas : des `ExceptionMapper` enregistrés une fois pour toute l'application les convertissent en réponses **Problem Details** (RFC 9457, `application/problem+json`), le format d'erreur unique fixé par le contrat.

| Exception de base (`common`) | Cas typique | Statut HTTP |
|---|---|---|
| `NotFoundException` | établissement, produit ou commande inconnu | 404 |
| `UnauthenticatedException` | session absente ou expirée, magic link invalide | 401 |
| `AccessDeniedException` | restaurateur visant une ressource hors de son établissement | 404 (jamais 403 : ne pas confirmer l'existence de la ressource, voir [Sécurité](../architecture/securite.md)) |
| `ConflictException` | espace déjà revendiqué, modification concurrente | 409 |
| `BusinessRuleException` | panier contenant un produit en rupture, montant incohérent | 422 |
| `PaymentFailedException` | paiement refusé par Stripe | 422 |
| `RateLimitedException` | seuil de demande de magic link dépassé | 429 avec `Retry-After` |
| `DependencyUnavailableException` | Stripe ou l'API OpenAI injoignable après retentatives | 503 |
| toute exception non mappée | bug | 500, sans détail interne dans la réponse |

Trois règles d'usage :

- Une exception métier porte un code stable (repris dans le champ `type` du Problem Details) et un message destiné au développeur, pas à l'interface : les libellés affichés aux clients et aux restaurateurs vivent dans les frontends.
- Les sous-classes par domaine (`SpaceAlreadyClaimedException` étend `ConflictException`) précisent le cas sans multiplier les mappers : le mapper de la classe de base suffit.
- Le 500 est toujours un bug à corriger, jamais un statut « fourre-tout » : si un cas d'erreur est prévisible, il a son exception métier et son statut.

## Validation

La validation se joue à deux niveaux, volontairement redondants :

- **À l'entrée, sur la resource** : les DTO générés portent les annotations Bean Validation issues des contraintes du contrat (`@NotNull`, `@Size`, `@Positive`, formats). Les paramètres des resources sont annotés `@Valid` ; une violation produit un 400 en Problem Details avant toute ligne de code métier. Une contrainte absente du contrat est un défaut du contrat, pas un patch Java local.
- **En service, les invariants métier** : le service revalide ce qui engage le métier, sans faire confiance à la couche du dessus. Exemples canoniques : le total d'une commande est recalculé côté serveur à partir de la carte, jamais accepté du panier client ; la disponibilité d'un produit est vérifiée à la validation du panier ; les droits du restaurateur sur l'établissement sont contrôlés à chaque écriture.

La règle de partage : Bean Validation vérifie la **forme** (le DTO est-il bien construit ?), le service vérifie le **sens** (l'opération est-elle légitime dans l'état actuel du système ?). Un invariant métier exprimé uniquement en annotation, ou une vérification de forme réécrite à la main en service, sont deux défauts symétriques.

## Configuration

La configuration applicative passe exclusivement par des interfaces `@ConfigMapping`, une par domaine, sous le préfixe `surplasse.<domaine>` :

```java
@ConfigMapping(prefix = "surplasse.generation")
public interface GenerationConfig {

    /** OpenAI model used for menu extraction. */
    String model();

    /** Maximum attempts for an extraction job. */
    int maxAttempts();

    /** Timeout for a single OpenAI API call. */
    Duration callTimeout();
}
```

Les règles :

- **Aucun `@ConfigProperty` éparpillé** dans les services ou les resources : une clé de configuration consommée hors d'un `@ConfigMapping` est un défaut de revue. Le mapping est le catalogue exhaustif et typé de ce que le module attend de son environnement.
- Les préfixes sont réservés : `surplasse.*` pour la configuration applicative, les préfixes `quarkus.*` restant à l'infrastructure (datasource, HTTP, mailer). Une clé applicative ne se glisse jamais sous `quarkus.*`.
- Les valeurs par défaut vivent dans le mapping (`@WithDefault`) ou dans l'`application.properties` du module `application`, par profil (`%dev`, `%test`, `%prod`, voir [le backend](../architecture/backend.md#configuration-par-profils)). Les secrets viennent des variables d'environnement, jamais du dépôt.
- Une clé manquante ou mal typée fait échouer le démarrage : c'est voulu, et c'est la raison d'être du typage.

## Logs

Le Backend journalise avec **JBoss Logging**, le socle natif de Quarkus, via un logger statique par classe (`Logger.getLogger(OrderService.class)`).

- **Les messages de log sont en anglais** : la documentation est en français, le code et ses sorties techniques sont en anglais, sans exception.
- **Log structuré** : le message reste court et stable, le contexte passe en paramètres et dans le MDC (identifiant de commande, d'établissement, de job). En production, la sortie est du JSON exploitable par la chaîne d'observabilité (voir [operations](../operations/)) ; le format humain reste actif en dev.
- Les niveaux : `ERROR` pour ce qui réclame une intervention, `WARN` pour un état anormal auto-résorbé (retentative de job), `INFO` pour les faits métier structurants (commande payée, établissement activé), `DEBUG` pour le reste. Un log `INFO` par requête HTTP est du bruit : les requêtes relèvent des access logs et des métriques.

!!! warning Jamais de donnée personnelle en clair
Aucun email, nom, téléphone ou jeton (magic link, jeton de suivi de commande, clé Stripe) n'apparaît dans un log, à aucun niveau. Le contexte est porté par des identifiants internes opaques, qui suffisent au diagnostic. Cette règle conditionne la conformité RGPD des journaux (voir [operations](../operations/)).
!!!

## Les interdits

Le condensé de ce que la revue refuse systématiquement :

| Interdit | Pourquoi | À la place |
|---|---|---|
| Logique métier dans une resource | la logique devient intestable sans HTTP et échappe aux transactions | tout déplacer dans le service, la resource convertit et délègue |
| Entité JPA exposée dans l'API | couple le schéma de base au contrat public | DTO du contrat et mapper dédié |
| Requête SQL native sans justification | contourne l'ORM, fragilise migrations et portabilité | requête Panache nommée ; une native se justifie en revue et se commente |
| État métier mutable partagé dans un bean | les beans CDI sont des singletons concurrents et l'état serait perdu au redémarrage | état en base de données, structures immuables ; un compteur technique en mémoire, comme la limite de débit MVP, reste explicitement documenté, borné et thread-safe |
| Appel bloquant dans un flux réactif SSE | bloque l'event loop et gèle tous les canaux | composition Mutiny sur le `Multi`, travail bloquant déporté hors du flux |
| Injection de champ `@Inject` | dépendances cachées, testabilité dégradée | injection par constructeur, champs `final` |
| `@Transactional` sur une resource ou un repository | frontière transactionnelle au mauvais niveau | `@Transactional` sur la méthode de service |
| `@ConfigProperty` hors `@ConfigMapping` | configuration éparpillée, invérifiable au démarrage | le `@ConfigMapping` du domaine |
| Appel externe (Stripe, API OpenAI) en transaction ouverte | connexion et verrous retenus pendant des secondes | motif en trois temps, worker de jobs |

## Pour aller plus loin

| Page | Contenu |
|---|---|
| [Le backend](../architecture/backend.md) | Les modules Maven, les couches, le SSE, les événements de domaine et les jobs que ces conventions encadrent |
| [Les tests](tests.md) | Comment chaque couche se teste : unitaires sur les services, `@QuarkusTest` sur les resources, doublures des intégrations externes |
| [Conventions API et contrat](conventions-api.md) | La génération des DTO et des interfaces Java depuis `api/openapi.yaml` |
| [Workflow git](workflow-git.md) | Commits fréquents sur `main`, préfixe `backend:` pour ces changements |
