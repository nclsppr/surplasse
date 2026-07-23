---
label: Backend
order: 30
icon: server
description: Le monolithe modulaire Quarkus, l'architecture en couches, le temps réel SSE, les événements de domaine et les traitements asynchrones.
---

# Le backend

Le Backend est l'unique processus applicatif de Surplasse : une API REST Quarkus qui implémente [le contrat](api.md), porte la logique métier des six domaines, persiste dans PostgreSQL (voir [les données](donnees.md)) et pousse le temps réel vers le Dashboard et le mini-site Commande. Cette page décrit sa structure interne : le découpage en modules Maven, les couches à l'intérieur de chaque module, les flux SSE, les événements de domaine et les traitements asynchrones.

!!! info Documentation de référence
Les modules `common`, `contract`, `catalog`, `order`, `payment`, `identity` et `application` existent. `identity` est embarqué dans l'assemblage : il n'ajoute aucun processus, port ou conteneur. La liste REST des commandes opérationnelles est implémentée dans `order`, avec autorisation par établissement et pagination par curseur. Leur avancement authentifié est également implémenté : un verrou de ligne sérialise les actions concurrentes, la machine à états rejette les sauts et chaque transition persistée produit l'événement de suivi client. Le remboursement intégral authentifié est livré localement : il restitue aussi la commission Surplasse, rapproche les webhooks Stripe et ne modifie la commande qu'après un succès confirmé. Le contrôle persistant de prise de commandes ferme ensemble les nouvelles sessions de table, commandes et sessions de paiement, sans couper les parcours existants. Les autres modules et certains mécanismes transverses restent la cible de référence, décrite au présent de spécification. Les conventions de code détaillées (nommage, structure des packages, style) vivent dans [les conventions Quarkus](../developpement/conventions-quarkus.md).
!!!

## Pourquoi Quarkus

Le choix de Quarkus est motivé par quatre arguments, développés dans l'[ADR 0003 : Quarkus](../decisions/adr-0003-quarkus.md) :

- **Démarrage et rechargement à chaud.** Le mode dev (`quarkus dev`) recompile et recharge l'application à chaque sauvegarde, en une fraction de seconde. Pour un développeur seul qui alterne entre le contrat, le Backend et trois frontends, la boucle de retour courte est un multiplicateur de productivité, pas un confort.
- **Dev Services.** En dev et en test, Quarkus démarre automatiquement les dépendances d'infrastructure dans des conteneurs jetables : un PostgreSQL éphémère apparaît sans installation locale ni configuration. Un clone du dépôt et une JVM suffisent pour travailler.
- **Écosystème Jakarta et MicroProfile.** Quarkus s'appuie sur des standards (Jakarta REST, CDI, JPA, MicroProfile Config et Health) plutôt que sur des abstractions propriétaires. Les compétences et le code restent portables, et l'écosystème d'extensions couvre tous les besoins du projet sans bibliothèque exotique.
- **Option native plus tard.** La compilation native (GraalVM) reste ouverte si l'empreinte mémoire du VPS devient un sujet. Ce n'est pas un objectif du MVP : la JVM classique suffit largement à la charge visée, mais l'option existe sans réécriture.

## Un monolithe modulaire

Le Backend est un seul déployable, mais pas un bloc indistinct : c'est un projet Maven multi-modules dont chaque domaine métier est un module. Les frontières entre domaines sont donc vérifiées par le compilateur, pas seulement par la discipline. Si un domaine doit un jour être extrait en service séparé (la génération est le candidat le plus probable), la couture est déjà tracée.

### Arborescence Maven cible

```
backend/
├── pom.xml            # POM parent : versions, plugins, modules
├── common/            # Types partagés : événements de domaine, erreurs, identifiants, utilitaires
├── contract/          # Interfaces Java et DTO générés depuis api/openapi.yaml, jamais édités à la main
├── catalog/           # La carte : établissements, catégories, produits, options, disponibilités
├── order/             # Le cycle de vie d'une commande et sa diffusion SSE
├── payment/           # L'intégration Stripe : PaymentIntents, webhooks, comptes Connect
├── identity/          # Restaurateurs, magic links, sessions, droits sur les établissements
├── engagement/        # Espaces pré-générés, revendication, relances, métriques d'usage
├── generation/        # Jobs d'extraction IA, génération des mini-sites et des QR codes
└── application/       # Module d'assemblage : agrège les domaines et produit le déployable Quarkus
```

### Règles de dépendances entre modules

| Module | Peut dépendre de | Ne dépend jamais de |
|---|---|---|
| `common` | rien (socle) | tout le reste |
| `contract` | `common` | les domaines |
| Un domaine (`catalog`, `order`, ...) | `common`, `contract` | un autre domaine |
| `application` | tous les modules | (il est le sommet) |

La règle centrale : **les domaines ne se connaissent pas directement**. Un domaine ne peut collaborer avec un autre que par deux mécanismes explicites :

- **Les événements de domaine**, dont les types vivent dans `common` : le domaine émetteur publie, il ignore qui consomme. C'est le mécanisme par défaut, décrit plus bas.
- **Les interfaces explicites**, déclarées dans `common` et implémentées par le domaine fournisseur : réservées aux cas où un domaine a besoin d'une réponse synchrone (par exemple, le domaine commande interroge la disponibilité d'un produit au moment de valider un panier). Chaque interface de ce type est une frontière assumée, documentée, et son ajout se justifie dans la revue.

Toute dépendance Maven directe entre deux domaines est interdite : elle ne compilerait d'ailleurs pas, puisque le POM parent ne la déclare pas. C'est le compilateur qui garde la frontière, pas une convention.

## L'architecture en couches par module

Chaque module de domaine suit la même structure interne, en quatre couches :

```
        HTTP
         │
┌────────▼────────┐
│ Resources REST  │  implémentent les interfaces générées depuis le contrat
├─────────────────┤
│ Services métier │  règles de gestion, transactions, événements
├─────────────────┤
│  Repositories   │  accès aux données via Panache (pattern repository)
├─────────────────┤
│    Entités      │  modèle persistant JPA
└────────┬────────┘
         │
     PostgreSQL
```

| Couche | A le droit de | N'a pas le droit de |
|---|---|---|
| **Resource REST** | Implémenter une interface générée depuis le contrat, convertir DTO et types du domaine, retourner les bons codes HTTP | Contenir une règle métier, toucher un repository ou une entité directement |
| **Service métier** | Porter les règles de gestion, ouvrir les transactions (`@Transactional`), appeler les repositories, émettre des événements de domaine | Connaître HTTP (ni requête, ni code de statut), dépendre d'un service d'un autre domaine |
| **Repository Panache** | Encapsuler les requêtes (`PanacheRepository`), exposer des méthodes nommées par intention (`findBySlug`) | Contenir une règle métier, être appelé depuis une resource |
| **Entité** | Modéliser le persistant, porter ses invariants simples | Sortir du module : les frontières exposent les DTO du contrat, jamais les entités |

Les resources sont volontairement minces : le contrat étant la source de vérité, elles se contentent de faire le pont entre les interfaces Java générées (module `contract`) et les services. Le workflow de génération est décrit dans [le contrat et l'API](api.md).

### Autorisation professionnelle en phase 4

Le modèle livré filtre encore les opérations par le propriétaire de l'établissement. Le lot 4A le remplace par une résolution centrale de `EstablishmentMembership`, conformément à l'[ADR-0031](../decisions/adr-0031-equipes-roles-vues-metier.md). Chaque service métier demande une capacité explicite, par exemple accepter une commande, marquer prête, rembourser, publier la carte ou gérer l'équipe. Les resources ne déduisent jamais un droit de la route du Dashboard.

Une projection de lecture peut aussi dépendre du rôle. La vue Cuisine reçoit les produits, options, allergènes, remarques et temps opérationnels, mais pas les montants financiers ni les détails du compte. Comme le schéma `DashboardOrder` livré rend ces montants obligatoires, le contrat ajoute un schéma `KitchenOrder` et un endpoint additifs au lot 4A ; il ne fragilise pas `/v1` en rendant un ancien champ optionnel. Le filtrage s'effectue avant la sérialisation. Les tests croisent au minimum chaque rôle, un rôle interdit dans le bon établissement et un membre d'un autre établissement.

Les actions sensibles appellent le journal append-only dans la même transaction que leur résultat métier lorsque c'est possible. Un refus d'autorisation peut être journalisé séparément sans révéler la ressource au demandeur. Les traitements automatiques utilisent l'acteur `system` avec l'identifiant du job durable, jamais l'identité d'un membre. Le refus d'une commande `paid` passe par une opération dédiée qui fixe le motif et le remboursement intégral ; le rôle `service` ne gagne aucun accès à l'endpoint générique de remboursement.

## Le contrôle de prise de commandes

Le domaine catalogue possède l'état opérationnel de prise de commandes de chaque établissement. Cet état persistant vaut `open` ou `paused` et reste distinct du cycle de vie `Establishment.status`, conformément à l'[ADR-0020](../decisions/adr-0020-accounts-v2-onboarding-embarque.md). Le contrat professionnel permet de le lire et de le fixer de manière idempotente selon le rôle. Une ouverture revalide le cycle de vie, la carte publiée, au moins un canal actif, table avec QR ou à emporter configuré, la capacité Stripe Connect et la présence d'au moins une session de réception testée et capable d'accepter une commande : membre `owner`, `manager` ou `service`, ou poste partagé Salle. Un poste Cuisine seul ne satisfait jamais ce prérequis.

Pendant l'ouverture, le Backend maintient une présence bornée des seules sessions capables d'accepter et explicitement armées comme réceptionnaires. Le navigateur renouvelle un bail court uniquement tant que la vue de réception est visible, connectée et a réussi son test sonore et SSE. Le verrouillage du téléphone, le passage durable en arrière-plan ou la perte de réseau font expirer ce bail ; l'interface avertit avant l'expiration et empêche de présenter un appareil non fiable comme actif. Si aucun réceptionnaire ne renouvelle sa présence au-delà du délai de grâce, le Backend force `paused` sous le même verrou d'établissement, ne rouvre jamais automatiquement, alerte un responsable par le canal secondaire configuré et continue de diffuser les commandes déjà payées. Une commande payée pendant la fenêtre de grâce reste à servir ou à rembourser ; si elle dépasse le délai maximal d'acceptation, le job durable créé lors du passage à `paid` force aussi la pause, même si un autre bail reste actif, puis déclenche son remboursement intégral idempotent. Seul un `owner` ou `manager` peut rouvrir après diagnostic. Les deux délais sont configurés dans des bornes sûres et qualifiés pendant les pilotes, y compris écran en veille, arrière-plan mobile et changement de réseau.

Trois familles de chemins demandent une admission au catalogue avant tout nouvel effet métier :

| Chemin | Effet refusé pendant `paused` |
|---|---|
| Session anonyme | Création d'un nouveau jeton depuis un QR de table ou le canal à emporter direct |
| Commande | Persistance d'une nouvelle commande `pending_payment` depuis une session déjà ouverte |
| Paiement | Création ou restitution d'une session Stripe encore ouverte |

Le contrôle ne repose pas sur deux lectures sans coordination. L'admission prend un verrou partagé sur la ligne de l'établissement pendant la transaction concernée. La pause prend un verrou exclusif sur cette même ligne. Le commit détermine ainsi une frontière : une opération admise avant la pause peut terminer, tandis que toute admission postérieure échoue avec l'état fermé. Une requête idempotente qui retrouve une commande déjà créée peut encore restituer cette commande, car elle ne crée aucun nouvel effet.

Le paiement traverse une frontière externe supplémentaire. La réservation applicative et le routage Stripe sont figés avant l'appel réseau, mais un Payment Intent dont le `client_secret` a déjà été remis ne peut pas être repris au navigateur. Il peut donc aboutir après la pause. Le webhook signé continue alors son traitement normal, fait passer la commande à `paid` et diffuse son événement. Le restaurateur termine ou rembourse cette commande. La pause ne filtre jamais les pages de suivi, les flux SSE, la file Dashboard ni les transitions des commandes existantes.

Le remboursement suit la même forme d'orchestration sans transaction réseau longue. Une première transaction verrouille Commande puis Paiement, persiste l'intention et sa clé d'idempotence, et fige le routage Stripe. L'appel Stripe se déroule ensuite hors transaction. Une seconde transaction reprend les verrous dans le même ordre et rapproche le résultat. Les événements de remboursement signés peuvent terminer ce rapprochement après une réponse réseau ambiguë. Tant que l'intention est active, le domaine Commande refuse toute nouvelle transition de cuisine. Seul un succès Stripe émet `PaymentRefunded`, puis déplace atomiquement la commande vers `refunded` et persiste son événement SSE.

Les événements fins Stripe Accounts v2 participent au mode fermé. Après vérification de signature, le module Paiement relit le compte hors transaction. La transaction de traitement synchronise ensuite `card_payments` et force la prise de commandes à `paused` si cette capacité n'est plus `active`. Un événement ultérieur qui rétablit la capacité ne rouvre pas le service. Seule une demande explicite peut revenir à `open`, après une nouvelle vérification de tous les prérequis.

## Le temps réel : SSE via Mutiny

Le Backend pousse les mises à jour en Server-Sent Events, le choix est argumenté dans l'[ADR 0006 : SSE](../decisions/adr-0006-sse.md). Côté implémentation, chaque endpoint SSE retourne un `Multi` Mutiny : un flux réactif auquel Quarkus branche la réponse HTTP, un événement émis sur le `Multi` partant immédiatement vers les clients connectés.

Deux types de canaux :

| Canal | Abonné | Contenu |
|---|---|---|
| **Par établissement** | Le Dashboard | Nouvelles commandes payées, changements de statut, ruptures de produits |
| **Par commande** | La page de suivi du mini-site Commande | Les changements de statut de cette commande uniquement |

Les deux canaux de commande sont implémentés. Chaque transition persistée est diffusée à la fois sur le canal de la commande concernée et sur celui de son établissement. Le canal par établissement rejoue les événements persistés dont l'identifiant est supérieur à `Last-Event-ID` avant de reprendre le direct.

Le canal par établissement est authentifié par le cookie `HttpOnly` hôte uniquement pour `api.surplasse.com` (voir [la sécurité](securite.md)). Ce point est structurant : l'API navigateur `EventSource` n'accepte aucun en-tête personnalisé, donc aucun `Authorization: Bearer` ; le Dashboard utilise `withCredentials: true` pour envoyer le cookie à l'API. Le registre de flux associe chaque connexion à sa session et à son appartenance. Une révocation ou expiration ferme ces connexions avant de répondre, et chaque événement ou battement de cœur revalide l'autorisation pour fermer une connexion ouverte dans une course. Le canal par commande est adressé par un jeton non devinable propre à la commande : le client n'a pas de compte, le jeton fait office de capacité d'accès (transmis en paramètre de l'URL du flux).

### Stratégie de reconnexion

Une connexion SSE se coupe : réseau mobile du client, mise en veille de la tablette du restaurateur, redéploiement du Backend. La reprise s'appuie sur le mécanisme standard du protocole :

1. Chaque événement envoyé porte un `id` monotone par canal.
2. `EventSource` (côté navigateur) se reconnecte automatiquement et renvoie le dernier identifiant reçu dans l'en-tête `Last-Event-ID`.
3. Le Backend rejoue les événements manqués depuis cet identifiant, en les relisant depuis la base (les événements diffusés sont persistés, voir [les données](donnees.md)), puis rebranche le flux vif.

Le flux envoie en outre un battement de cœur périodique (commentaire SSE) pour empêcher les proxies intermédiaires de couper une connexion jugée inactive. Le Dashboard traite de son côté toute reconnexion comme une occasion de resynchroniser l'état complet par un appel REST : le SSE est un accélérateur, jamais la seule source de vérité.

## Les événements de domaine

À l'intérieur du monolithe, les domaines communiquent par événements de domaine : des faits métier immuables, nommés au passé. Le mécanisme retenu pour le MVP est le bus d'événements CDI (`Event` et `@Observes`), le plus simple disponible dans Quarkus ; un mince habillage applicatif dans `common` en fixe les types et les conventions. Un bus applicatif plus élaboré (file en mémoire, observation asynchrone systématique) reste à trancher si les besoins le justifient.

Les trois événements structurants du MVP :

| Événement | Émis par | Quand | Consommé par |
|---|---|---|---|
| **Commande payée** (`OrderPaid`) | paiement | Le webhook Stripe signé confirme le paiement | commande (passage au statut `paid`, diffusion sur le canal de l'établissement, ticket cuisine si activé), observabilité (compteur après commit) |
| **Commande acceptée** (`OrderAccepted`) | commande | Le restaurateur prend la commande en charge depuis le Dashboard | commande (diffusion sur le canal de la commande pour le suivi client) |
| **Produit en rupture** (`ProductOutOfStock`) | catalogue | Le restaurateur marque un produit indisponible | commande (refus des paniers contenant ce produit à la validation), diffusion sur le canal de l'établissement |

Trois règles d'usage :

- **Un événement décrit un fait, pas une intention.** « Commande payée » constate un paiement confirmé ; il ne demande à personne de faire quoi que ce soit. Chaque consommateur décide seul de sa réaction.
- **Les écritures critiques partagent la transaction.** Le webhook Stripe, la réussite du paiement, le passage de la commande à `paid` et l'événement SSE persistant sont validés ensemble. Une erreur annule le tout, y compris l'identifiant de webhook, afin que Stripe puisse livrer à nouveau l'événement.
- **Les effets volatils attendent le commit.** La diffusion en mémoire vers les connexions SSE s'observe en `TransactionPhase.AFTER_SUCCESS`. Elle ne peut donc jamais annoncer un état finalement annulé. Une diffusion perdue au redémarrage est réparée par le rejeu des événements persistés.

L'assemblage `application` observe aussi les signaux internes `OrderCreated`, `PaymentSessionOpened`, `PaymentFailed`, `PaymentRefunded`, `PaymentRefundFailed`, `MagicLinkDeliveryCompleted` et `SseConnectionChanged`. `OperationalMetrics` les convertit en compteurs ou jauges à faible cardinalité. Les signaux liés à une transaction sont observés en `TransactionPhase.AFTER_SUCCESS` : une transaction annulée ne produit pas de métrique métier. Cet observateur écrit uniquement dans le registre Micrometer du processus et ne fait aucun appel réseau. L'arrêt de Prometheus ou Grafana ne peut donc pas influencer un service métier ni la readiness du Backend.

!!! warning Événements internes, pas une API
Ces événements vivent dans le processus et ne franchissent jamais la frontière du Backend. Ce que les frontends reçoivent (SSE) et ce que le Backend expose (REST) relève exclusivement du contrat.
!!!

## Les traitements asynchrones

Certains traitements ne peuvent pas vivre dans le cycle requête-réponse. La cible pour les traitements durables est un **worker interne adossé à une table de jobs en base**, sans broker externe au MVP.

Le fonctionnement :

1. Le code métier insère un job dans la table (type, charge utile JSON, statut `pending`), dans la même transaction que l'opération qui le déclenche : un job n'existe que si son déclencheur a été commité.
2. Un worker planifié (extension `scheduler`) réclame les jobs en attente à intervalle court, en les verrouillant par `SELECT ... FOR UPDATE SKIP LOCKED` pour rester correct même avec plusieurs instances.
3. Le job s'exécute ; en cas d'échec, il est retenté avec un délai croissant jusqu'à un plafond, puis marqué `failed` et visible pour intervention manuelle.

Les jobs prévus au fil de la roadmap :

| Job | Déclencheur | Effet |
|---|---|---|
| **Extraction IA** | L'embarquement : le restaurateur envoie la photo de sa carte | Appel de l'API OpenAI (vision), production de la carte structurée, progression consultable par le frontend |
| **Notification transactionnelle durable** | SMS « Prête », notification de revendication, litige ou échec de virement | Création ou reprise d'une `NotificationDelivery` rattachée à sa ressource réelle ; le SMS « Prête » attend cinq secondes pour permettre son annulation avant envoi, puis l'adaptateur rapproche remise, échec et reprise |
| **Génération des QR codes** | Activation d'un établissement, ajout de tables | Production des QR codes de table et de la planche imprimable |
| **Expiration avant paiement** | Réservation d'un créneau à emporter par une commande `pending_payment` | À l'échéance, refus de toute nouvelle remise de session ; libération seulement sans Payment Intent ou après annulation fournisseur confirmée, jamais pendant un état Stripe ambigu |
| **Échéance d'acceptation** | Webhook signé faisant passer une commande à `paid` | À l'échéance, relecture verrouillée de la commande puis création idempotente d'un remboursement `acceptance_timeout` si elle est encore `paid` |

Cette approche assume ses limites : la latence de prise en charge est celle du tick du scheduler, et le débit est celui d'un pool de workers dans le processus. C'est exactement suffisant pour la volumétrie visée, et cela n'ajoute aucune brique d'exploitation. Le passage à un broker externe sera réévalué si un besoin réel le justifie (fan-out important, jobs longs concurrents nombreux) ; ce serait alors l'objet d'un ADR.

Le magic link actuel suit une voie plus simple : le jeton haché est persisté, puis l'email est remis de façon asynchrone par `quarkus-mailer`, sans job durable ni retentative automatique. Une panne du processus ou du SMTP après la réponse 202 peut donc perdre cet envoi. Le restaurateur peut demander un nouveau lien, ce qui invalide le précédent. Cette limite est acceptée pour le MVP et doit être revue avant que la volumétrie ou les attentes de support n'imposent une livraison durable.

### Seuil d'adoption d'une orchestration durable

Temporal n'entre ni dans le MVP ni dans la phase 2. Il orchestre des workflows durables, mais n'est ni le bus d'événements général du Backend, ni la source de vérité métier, ni un remplacement de PostgreSQL ou d'un éventuel broker de transport. Son adoption ajouterait un service, des magasins de persistance et de visibilité, des workers et un modèle de programmation supplémentaire.

La première marche reste composée de transactions locales, d'événements persistés quand un rejeu est nécessaire, d'une outbox transactionnelle au premier effet durable hors processus et de jobs courts en PostgreSQL. Temporal sera réévalué seulement si un parcours réel cumule plusieurs besoins : exécution sur des heures ou des jours, temporisations et attentes externes durables, nombreuses étapes et compensations, ou visibilité opérationnelle devenue coûteuse à construire localement. L'[ADR-0030](../decisions/adr-0030-java-25-quarkus-courant.md) conserve ce seuil et fixe le Backend sur Java 25 avec la version stable courante de Quarkus.

## Les extensions Quarkus

| Extension | Rôle |
|---|---|
| `quarkus-rest-jackson` | Endpoints REST (Jakarta REST) avec sérialisation JSON Jackson, support natif de Mutiny pour le SSE |
| `quarkus-hibernate-orm-panache` | ORM Hibernate et pattern repository Panache pour la couche d'accès aux données |
| `quarkus-jdbc-postgresql` | Pilote JDBC PostgreSQL, seule base du système |
| `quarkus-flyway` | Exécution des migrations versionnées au démarrage, jamais de DDL manuel |
| `quarkus-mailer` | Envoi des emails transactionnels (magic links, notifications) |
| `quarkus-smallrye-jwt` | Vérification des JWT restaurateur signés en RS256 |
| `quarkus-smallrye-jwt-build` | Émission des JWT restaurateur avec la clé privée courante |
| `quarkus-scheduler` | Planification du worker de jobs et des tâches périodiques (relances, purges) |
| `quarkus-smallrye-health` | Endpoints de vivacité et de disponibilité (`/q/health`) pour Docker Compose et la supervision |
| `quarkus-micrometer-registry-prometheus` | Métriques HTTP, JVM, JDBC et métier sur `/q/metrics`, collectées en pull par Prometheus |
| `quarkus-opentelemetry` | Traces distribuées, non installées ; elles restent une évolution distincte si un besoin de diagnostic le justifie |

La liste est volontairement courte : chaque extension supplémentaire se justifie, dans l'esprit du principe de simplicité opérationnelle posé dans la [vue d'ensemble](index.md).

## Configuration par profils

La configuration suit les profils standards de Quarkus, dans un unique `application.properties` du module `application` :

| Profil | Usage | Particularités |
|---|---|---|
| `%dev` | Développement local | Dev Services PostgreSQL, clés JWT de travail générées par Quarkus, SMTP local Mailpit sans authentification ; clés Stripe en mode test |
| `%test` | Tests automatisés | Dev Services, base éphémère, clés JWT de travail générées et mailer simulé ; aucun Mailpit dans la CI |
| `%prod` | VPS Ubuntu LTS | PostgreSQL persistant, clé privée RS256 et JWKS montés hors image, SMTP transactionnel ; toute valeur sensible vient de l'environnement Docker Compose, jamais du dépôt |

La configuration applicative est consommée par des interfaces `@ConfigMapping` : des types Java qui portent les clés, leurs types et leurs valeurs par défaut. Ce choix rend la configuration vérifiable à la compilation et au démarrage (une clé manquante fait échouer le boot, pas une requête à minuit), et documente en un seul endroit ce que chaque module attend de son environnement. Chaque module déclare ses propres mappings ; le module `application` n'agrège que les valeurs.

## Pour aller plus loin

| Page | Contenu |
|---|---|
| [Le contrat et l'API](api.md) | Le workflow contract-first et la génération des interfaces Java implémentées par les resources |
| [Les données](donnees.md) | Le modèle PostgreSQL, les migrations Flyway, la table de jobs et les événements persistés |
| [Les conventions Quarkus](../developpement/conventions-quarkus.md) | Nommage, structure des packages, style de code et conventions de test du Backend |
| [ADR 0003 : Quarkus](../decisions/adr-0003-quarkus.md) | La décision d'adopter Quarkus et les alternatives écartées |
| [ADR 0006 : SSE](../decisions/adr-0006-sse.md) | La décision de retenir SSE plutôt que WebSockets pour le temps réel |
| [ADR 0019 : maintien de Java et Temporal différé](../decisions/adr-0019-maintien-java-temporal-differe.md) | La réévaluation du runtime transactionnel et le seuil d'adoption d'une orchestration durable |
| [ADR 0029 : Prometheus et Grafana](../decisions/adr-0029-observabilite-prometheus-grafana.md) | La collecte pull, l'absence de dépendance du Backend et les règles de cardinalité |
