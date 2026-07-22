---
label: Pilote de phase 2
order: 35
icon: checklist
description: "Les portes Go ou No-Go, métriques et procédures de repli qui encadrent le pilote restaurant de la phase 2."
---

# Pilote de phase 2

Cette page est le plan d'exécution de la [phase 2 de la roadmap](../roadmap.md#phase-2--commander-et-payer). Elle ne crée ni une roadmap parallèle ni une date de lancement. Elle transforme le critère de sortie de la phase en preuves observables et impose une décision Go ou No-Go avant chaque exposition supplémentaire.

!!! danger État au 2026-07-20 : No-Go live
Les chemins logiciels des charges directes Stripe Connect, du remboursement intégral et de la mise en pause de la prise de commandes sont sécurisés et testés localement avec des doublures. La plateforme test est inscrite à Connect et le compte Accounts v2 du pilote existe, mais son embarquement et ses capacités de paiement restent incomplets. La production, la qualification du remboursement contre Stripe réel et celle sur appareils réels ne sont pas livrées. Aucune transaction live ni aucun service pilote ne peut donc commencer.
!!!

## Principes de décision

- Une porte ne passe à Go que lorsque toutes ses preuves sont archivées avec le SHA testé, la date et le résultat.
- Un seul critère bloquant en échec donne No-Go. Une moyenne satisfaisante ne compense jamais un double débit, une mauvaise table ou une commande payée perdue.
- Les portes sont franchies dans l'ordre. Un test live ne compense pas une production non restaurable et un service à blanc ne compense pas un remboursement non vérifié.
- Aucun déploiement n'a lieu pendant un service à blanc ou réel.
- Le restaurateur dispose toujours de son parcours habituel avec papier et terminal. Le repli est disponible, mais son déclenchement invalide la sortie de phase 2.

## État des portes

| Porte | État au 2026-07-20 | Preuve attendue pour Go |
|---|---|---|
| 0. Noyau paiement local | **Go local** | Idempotence de création et remboursement, isolation par session de table, webhooks retentables, transitions paiement et commande atomiques, pause d'admission, migrations et tests verts |
| 1. Stripe Connect en test | **No-Go** | Compte Accounts v2 pilote activé en test, charges directes, commission correcte, webhooks Connect, mécanismes de remboursement et de pause vérifiés |
| 2. Production prête | **No-Go** | Pile Ubuntu LTS déployable et restaurable, secrets live, SMTP, supervision, retour arrière et données pilote |
| 3. Live fermé | **No-Go** | Transaction réelle de faible montant, rapprochement complet et remboursement réussi hors service |
| 4. Service à blanc | **No-Go** | Répétition complète au restaurant, sans public, sur matériel et réseau réels |
| 5. Service réel contrôlé | **No-Go** | Une plage pilote limitée, observée et rapprochée à 100 % sans incident bloquant ni repli |

## Porte 1 : Stripe Connect en test

Le pilote utilise un compte Accounts v2 avec configuration marchand, provisionné manuellement. La qualification de phase 2 utilise déjà le composant Connect intégré dans une page Surplasse locale. L'automatisation de création et de rattachement des comptes reste en phase 3. Le schéma financier est celui de la cible, à savoir les charges directes fixées par l'[ADR-0020](../decisions/adr-0020-accounts-v2-onboarding-embarque.md).

Le contrôle applicatif de prise de commandes est livré localement selon l'[ADR-0020](../decisions/adr-0020-accounts-v2-onboarding-embarque.md). Il ne fait pas passer cette porte à Go : l'activation du compte Connect test, le remboursement et le scénario complet de pause avec un Payment Intent réel restent à vérifier ensemble.

!!! warning Constat du 2026-07-20
Le premier compte du Cormoran avec `dashboard=full` est abandonné. Le nouveau compte La Paprika `acct_1TvOQECvIDZfXjyu` utilise `dashboard=none`, la configuration `merchant`, `fees_collector=stripe` et `losses_collector=stripe`. Le composant intégré se rend dans Surplasse en français. Les capacités de carte et de virement restent `restricted` tant que le titulaire n'a pas terminé l'embarquement. Aucun contournement par une charge plateforme n'est accepté. La [fiche de preuve](preuve-stripe-connect-2026-07-20.md) consigne le résultat et la reprise attendue.
!!!

### Critères Go

- Le bon compte Connect est rattaché à l'établissement et aucun paiement n'est possible sans compte encaissable.
- Le Payment Intent, Stripe.js et le webhook de paiement utilisent le même compte connecté.
- Les destinations snapshot de paiement et fine Accounts v2 possèdent des endpoints et secrets distincts, testés contre les mauvais types d'événements.
- La commission Surplasse vaut exactement 0 % pendant les 3 premiers mois, puis 1 %, hors frais Stripe.
- Le montant vient exclusivement de la carte recalculée côté Backend.
- Les scénarios carte acceptée, carte refusée, SCA, Apple Pay et Google Pay sont exercés lorsque l'appareil les rend disponibles.
- Une coupure réseau, un rejeu client et un webhook dupliqué ou retardé ne créent ni second débit ni second effet métier.
- Le refus d'une commande payée déclenche depuis le Dashboard un remboursement intégral qui restitue aussi la commission Surplasse lorsqu'elle existe.
- Le passage à `paused` ferme les nouvelles sessions de table, commandes et sessions de paiement sans couper le suivi, les flux SSE, le Dashboard ni les webhooks des commandes existantes.
- Un Payment Intent dont le `client_secret` a été remis avant la pause est rapproché s'il aboutit ensuite, puis sa commande est servie ou remboursée.
- `configuration.merchant.capabilities.card_payments.status` différent de `active` force la pause et le retour à `active` ne rouvre jamais automatiquement le service.

### No-Go immédiat

- Charge créée sur le compte plateforme ou sur le mauvais compte connecté.
- Commission différente du tarif acté.
- Remboursement ou mise à `paused` impossibles.
- Secret live requis pour réussir un test.

## Porte 2 : production prête

La production démarre avec `order_intake_status=paused`. Elle suit la topologie décrite dans [Exploitation](index.md) et [CI/CD](../developpement/ci-cd.md).

### Critères Go

- Les images, le Compose et Caddy sont versionnés et exécutables sur Ubuntu LTS.
- PostgreSQL utilise un volume persistant. Une sauvegarde puis une restauration complète ont été réalisées et datées.
- Les clés Stripe live, les deux secrets de webhook, les clés JWT et les identifiants SMTP sont absents de git, des images et des logs.
- Les domaines et certificats TLS sont valides. CORS reste fermé par défaut et limité aux origines exactes autorisées.
- Le magic link est reçu via le fournisseur SMTP réel.
- Le profil `observability` collecte le Backend, le tableau de bord `Surplasse / Vue opérationnelle` est lisible par tunnel SSH et les logs corrélés sont accessibles par Compose.
- Une sonde externe et son canal de notification ont été déclenchés volontairement puis acquittés. Les règles Prometheus seules ne satisfont pas ce critère tant qu'Alertmanager est absent.
- Prometheus et Grafana ont été arrêtés ensemble : `/q/health/ready` et une lecture applicative sont restés verts. Leur redémarrage a retrouvé la cible Backend sans redémarrer celui-ci.
- Le dernier SHA sain peut être redéployé. Les migrations de base ne sont jamais annulées.
- L'établissement, la carte et les QR du pilote sont provisionnés par migration, seed contrôlé ou outil interne répétable, jamais par DML improvisé en production.

### No-Go immédiat

- Service déclaré sain malgré une dépendance critique absente.
- Sauvegarde non restaurée, secret exposé ou procédure de retour arrière non exercée.
- Prise de commandes impossible à mettre à `paused` et à vérifier avant l'ouverture.

## Porte 3 : live fermé

Cette porte se déroule hors service, avec un montant faible convenu et une seule table de contrôle.

### Critères Go

- Le compte plateforme et le compte connecté pilote sont validés pour les encaissements et virements live.
- Le domaine de paiement est enregistré auprès de Stripe et les moyens disponibles sont contrôlés sur les appareils cibles.
- Une commande issue du QR de contrôle est encaissée sur le bon compte avec le bon montant et une commission Surplasse nulle pendant la période gratuite.
- Seul le webhook live signé fait passer la commande à `paid`.
- La commande apparaît une seule fois dans le Dashboard et progresse jusqu'à `served`.
- La commande, le paiement, le Payment Intent, la commission et l'événement webhook sont rapprochés à 100 %.
- Le paiement de contrôle est remboursé et le remboursement est à son tour rapproché.
- Un redémarrage du Backend conserve la commande, le paiement et l'accès Dashboard.

### No-Go immédiat

- Écart de montant, de table, d'établissement, de commission ou de statut.
- Effet métier avant webhook, événement non rapproché ou remboursement incomplet.

## Porte 4 : service à blanc

Le restaurant est fermé au public. Le restaurateur travaille avec la vraie tablette, les vrais téléphones, les QR imprimés et le réseau du lieu.

### Scénario minimum

1. Créer 10 à 15 commandes réparties sur plusieurs tables.
2. Exercer plusieurs commandes simultanées et chaque moyen de paiement réellement disponible.
3. Provoquer une carte refusée, une reprise de paiement, une coupure réseau client et une reconnexion SSE du Dashboard.
4. Accepter et faire progresser les commandes jusqu'à `served`.
5. Passer la prise de commandes à `paused`, vérifier les refus et la continuité, puis revenir explicitement à `open`.
6. Rembourser les paiements de contrôle et rapprocher toutes les écritures.

### Critères Go

- Aucune commande payée n'est absente du Dashboard plus de 60 secondes.
- Aucun double débit, mauvais montant, mauvais établissement ou mauvaise table.
- La reconnexion SSE ne perd aucune commande et ne nécessite aucune écriture SQL.
- Le restaurateur exécute le parcours sans assistance technique constante.
- Le rapprochement final est de 100 % et chaque paiement est remboursé.

Un seul écart financier, une intervention directe en base ou un repli vers le parcours habituel impose No-Go, correction, puis nouveau service à blanc complet.

## Porte 5 : service réel contrôlé

Le premier service ouvre sur une plage, un menu et un nombre de tables définis. Un opérateur Surplasse est présent, les QR hors périmètre sont couverts et le parcours habituel du restaurant reste immédiatement disponible.

### Seuils d'arrêt

Suspendre immédiatement les nouvelles commandes si l'un des seuils suivants est atteint :

| Seuil | Détection | Réaction et preuve |
|---|---|---|
| Double débit, mauvais montant, mauvaise table ou commande payée perdue | Rapprochement exact Stripe, PostgreSQL et observation du service, pas Prometheus | Passer immédiatement à `paused`, couvrir les QR et suivre le runbook ci-dessous |
| Deux erreurs techniques de paiement consécutives | Panneau des événements de paiement par résultat, règle Prometheus d'échecs et logs corrélés | Confirmer les deux événements, passer à `paused` et diagnostiquer Stripe avant toute reprise |
| Plus de 5 % de réponses API en erreur sur 5 minutes | Panneau du taux de 5xx et règle Prometheus correspondante | Passer à `paused`, vérifier santé, logs et pool JDBC, puis revenir au dernier SHA sain si la régression est applicative |
| Dashboard sans données fiables pendant plus de 2 minutes | Panneau des connexions SSE, smoke externe et contrôle REST de la file | Utiliser REST au plus 5 minutes, puis passer à `paused` si le flux ne revient pas |
| Remboursement impossible ou prise de commandes impossible à suspendre | Panneau des remboursements par résultat et contrôle fonctionnel du Dashboard | Couvrir les QR, conserver les preuves et traiter les commandes existantes manuellement sans DML direct |

Les règles Prometheus rendent un état visible, mais ne notifient personne sans Alertmanager. Pendant le pilote, l'opérateur garde Grafana ouvert et la sonde externe porte l'alerte indépendante. Les contrôles financiers exacts restent issus du rapprochement, jamais d'un compteur Micrometer.

### Critère de sortie de phase 2

La phase 2 est terminée uniquement si :

- toutes les commandes payées sont servies ou remboursées ;
- le rapprochement Stripe, Paiement et Commande est de 100 % ;
- il n'existe aucun double débit, mauvais montant, mauvais établissement, mauvaise table ni commande payée perdue ;
- aucun incident P0 ou P1 ne reste ouvert ;
- le service se termine sans repli sur le papier ou le terminal habituel ;
- le retour du restaurateur et les irritants observés sont consignés.

## Métriques

### Métriques bloquantes

| Mesure | Seuil |
|---|---|
| Rapprochement Stripe, Paiement et Commande | 100 % |
| Double débit, mauvais montant, mauvais établissement ou mauvaise table | 0 |
| Commande payée absente du Dashboard | 0 |
| Paiement confirmé vers Dashboard | p95 inférieur à 5 secondes |
| Reconnexion SSE sans perte | 100 % des essais |
| Acceptation par le restaurateur | p95 inférieur à 90 secondes |
| Alerte après panne simulée | moins de 5 minutes |
| Repli pendant le service réel | 0 |

### Métriques d'apprentissage

Le petit échantillon du premier pilote ne permet pas d'utiliser la conversion comme porte. Sont néanmoins observés : progression session de table vers commande puis paiement, abandons, temps de commande, aide demandée, irritants clients, irritants restaurateur et demandes hors périmètre.

## Repli et reprise

1. Fixer la prise de commandes à `paused`, puis vérifier que `acceptingOrders=false` et `blockedReason=paused`, sans couper les pages de suivi existantes.
2. Si seul le SSE est indisponible, utiliser la lecture REST pendant 5 minutes au maximum.
3. Si le paiement, l'API ou le Dashboard deviennent douteux, couvrir les QR et reprendre le parcours habituel du restaurant.
4. Conserver les preuves. Ne faire aucune écriture SQL manuelle.
5. Pour une régression applicative identifiée, redéployer le dernier SHA sain. Le premier SHA sain de production inclut V14 : aucun retour vers un SHA pré-V14 n'est autorisé. Ne jamais annuler une migration de base.
6. Rapprocher chaque Commande, Paiement, Payment Intent et événement Stripe, puis rembourser les cas concernés.
7. Consigner un post-mortem court, corriger et refaire un service à blanc avant tout nouveau service réel.

## Feuille de preuve

Chaque répétition ou service conserve au minimum :

- date, lieu, plage et responsable de la décision ;
- SHA Backend, Commande et Dashboard ;
- versions des images et version Flyway ;
- appareils, navigateurs, réseau et moyens de paiement exercés ;
- identifiants de rapprochement sans secret ni donnée de carte ;
- résultat de chaque critère, incident, décision Go ou No-Go et actions suivantes.

La preuve de pause conserve en plus l'état lu avant l'action, la réponse idempotente du `PUT /v1/establishments/{establishmentId}/order-intake`, l'état relu après l'action et le résultat de quatre contrôles : nouvelle session de table refusée, nouvelle commande refusée, nouvelle session de paiement refusée et suivi d'une commande existante toujours accessible. Aucune écriture SQL manuelle ne remplace cette preuve.
