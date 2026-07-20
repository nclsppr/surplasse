---
label: "ADR-0019 : Maintien de Java et Temporal différé"
order: 190
icon: law
description: "Pourquoi le Backend transactionnel reste en Java 21 avec Quarkus et pourquoi Temporal n'entre pas dans le MVP."
---

# ADR-0019 : maintien de Java et Temporal différé

## Statut

Accepté, 2026-07-20.

## Contexte

L'[ADR-0003](adr-0003-quarkus.md) a retenu Java 21 et Quarkus quand le Backend était encore à construire. Le choix peut maintenant être réévalué sur des faits : le monolithe modulaire existe, le contrat génère ses interfaces Java et les chemins les plus sensibles utilisent déjà les transactions PostgreSQL. La création idempotente d'une commande, la réservation d'un paiement, le traitement atomique des webhooks Stripe, l'avancement concurrent d'une commande et le contrôle de la prise de commandes disposent de code et de tests. Changer de runtime ne serait donc plus un choix à coût nul, mais une réécriture du noyau transactionnel.

La question de Temporal est distincte de celle du langage. Temporal orchestre une suite d'étapes sous forme de workflow durable. Son historique permet de reconstruire l'état d'une exécution après une panne ; les effets externes vivent dans des activités exécutées par des workers. Cette garantie répond à des processus longs et distribués, mais introduit aussi un service Temporal, ses magasins de persistance et de visibilité, des workers, un SDK et un modèle de programmation déterministe.

Le besoin immédiat de Surplasse reste plus étroit. Les invariants de commande et de paiement tiennent dans une transaction locale. Les reprises déjà nécessaires reposent sur l'idempotence Stripe, les événements de commande persistés et des traitements asynchrones courts. Aucun parcours de phase 2 ne coordonne encore pendant des heures ou des jours plusieurs services, attentes externes et compensations.

## Options considérées

### Runtime du Backend transactionnel

| Option | Avantages | Inconvénients |
|---|---|---|
| **Conserver Java 21 et Quarkus** | Protège le code, les tests et les frontières déjà livrés ; outillage transactionnel mûr ; bonne adéquation avec PostgreSQL ; outillage déjà maîtrisé dans le projet | Deux langages dans le monorepo ; verbosité et chaîne Maven propres à Java ; empreinte supérieure à un binaire Go minimal |
| Réécrire en TypeScript avec Node.js | Un seul langage avec les frontends ; recrutement et partage de types facilités ; boucle de développement familière | Réécriture sans bénéfice produit immédiat ; reprise de tous les cas de concurrence, d'idempotence et de transaction ; le contrat OpenAPI apporte déjà le partage de types utile |
| Réécrire en Go | Binaire compact, démarrage rapide, concurrence explicite et exploitation simple | Réécriture complète ; nouvelle expertise et nouvel outillage ; perte du code Jakarta, JPA et Quarkus existant sans simplification suffisante du métier |

### Orchestration des traitements durables

| Option | Avantages | Inconvénients |
|---|---|---|
| **Transactions locales, événements persistés, outbox ciblée et jobs courts en PostgreSQL** | Une seule source de vérité ; peu d'exploitation ; cohérence atomique avec le métier ; complexité proportionnée aux parcours actuels | Les reprises, délais, plafonds d'essais et outils d'intervention restent à construire pour chaque famille de jobs |
| Ajouter Temporal dès le MVP | Reprise durable, temporisations, politiques de nouvel essai, historique et visibilité opérationnelle pour des workflows complexes | Nouveau service ou offre Cloud ; workers supplémentaires ; persistance et exploitation dédiées ; modèle déterministe à apprendre ; frontières et activités à rendre idempotentes alors qu'aucun workflow actuel ne justifie ce coût |
| Ajouter immédiatement un broker comme Kafka | Diffusion à de nombreux consommateurs, journal d'événements et débit élevé | Ne coordonne pas à lui seul un workflow ni ses compensations ; exploitation disproportionnée ; aucun besoin actuel de flux distribué à haut volume |

## Décision

Nous conservons **Java 21 avec Quarkus pour le Backend transactionnel** pendant le MVP et la phase 2. PostgreSQL reste l'unique source de vérité métier. Une réécriture en TypeScript ou en Go ne résout aujourd'hui aucune limite observée et dépenserait du temps produit pour reconstruire des garanties déjà testées.

La première marche asynchrone reste volontairement simple :

- une opération qui ne traverse qu'un processus et une base utilise une transaction locale ;
- un événement nécessaire au rejeu, comme `OrderEvent`, est persisté dans cette transaction ;
- une outbox transactionnelle n'est ajoutée que lorsqu'un effet doit être remis durablement hors du processus ;
- un traitement court et retentable utilise une table de jobs PostgreSQL et un worker interne.

Nous n'introduisons **pas Temporal dans le MVP ni en phase 2**. Cela signifie aucun serveur Temporal, aucun SDK, aucun worker Temporal et aucune infrastructure associée dans ces phases. Ce choix n'interdit pas une adoption ultérieure : Temporal fournit un SDK Java, donc le runtime retenu ne bloque pas cette évolution.

Temporal ne reçoit pas un rôle qu'il ne vise pas dans cette architecture. Il peut orchestrer l'exécution durable d'un processus, mais il ne remplace ni PostgreSQL comme source de vérité métier, ni un broker comme Kafka si Surplasse a un jour besoin de transporter un flux vers de nombreux consommateurs indépendants. Son historique d'événements décrit l'exécution d'un workflow ; il n'est pas le journal métier général de la plateforme. Une outbox peut donc rester nécessaire pour amorcer atomiquement une communication depuis une transaction PostgreSQL, même si Temporal est adopté plus tard.

La question sera rouverte dans un nouvel ADR seulement lorsqu'un parcours réel présentera plusieurs des signaux suivants :

- une exécution qui dure des heures ou des jours ;
- des temporisations durables, des attentes humaines ou des rappels externes ;
- plusieurs étapes dépendantes réparties entre des services ou fournisseurs ;
- des politiques de nouvel essai et de nombreuses compensations métier ;
- une logique répétée de reprise après panne devenue difficile à tester ;
- un besoin d'historique, de recherche, de reprise manuelle et de visibilité opérationnelle que l'outillage interne rend coûteux.

L'activation Stripe Connect avec attente de conformité, un futur processus de litige ou de remboursement, ou une chaîne d'extraction IA avec validation humaine pourront devenir des candidats. Leur présence dans une phase future ne suffira pas à elle seule : le parcours concret devra franchir le seuil ci-dessus. Le nouvel ADR devra aussi comparer Temporal Cloud à l'auto-hébergement, notamment sur le coût, l'exploitation et la localisation des données.

## Conséquences

### Positives

- Le travail déjà investi dans le Backend transactionnel reste utilisable et la roadmap produit n'est pas interrompue par une réécriture.
- Les invariants d'argent et de commande continuent de bénéficier des transactions PostgreSQL et des tests existants.
- Le MVP n'ajoute ni service distribué, ni stockage technique, ni worker supplémentaire à exploiter.
- La frontière d'adoption de Temporal est explicite et mesurable, au lieu de dépendre d'une préférence technologique.
- Le SDK Java laisse ouverte l'adoption de Temporal sans migration préalable du Backend.
- La distinction entre source de vérité, transport d'événements et orchestration durable évite de demander à une seule brique de remplir trois rôles.

### Négatives et dettes assumées

- Le monorepo conserve deux chaînes d'outillage, Java avec Maven pour le Backend et TypeScript avec npm pour les frontends.
- La table de jobs interne doit fournir verrouillage, délais, plafonds d'essais, état d'échec et moyens d'intervention adaptés à sa montée en charge.
- Une outbox transactionnelle devra être conçue au premier effet durable hors processus ; elle n'est pas fournie automatiquement par le bus CDI.
- Si les workflows longs apparaissent rapidement, une partie de l'outillage de reprise construit localement pourra être remplacée par Temporal.
- Une adoption future demandera de définir des frontières d'activités idempotentes et une stratégie de migration sans déplacer la vérité métier hors de PostgreSQL.

## Références

- [ADR-0003 : Quarkus pour le Backend](adr-0003-quarkus.md)
- [Architecture du Backend](../architecture/backend.md)
- [Temporal : workflows](https://docs.temporal.io/workflows)
- [Temporal : activités](https://docs.temporal.io/activities)
- [Temporal Service](https://docs.temporal.io/temporal-service)
- [Guide du SDK Java Temporal](https://docs.temporal.io/develop/java)
