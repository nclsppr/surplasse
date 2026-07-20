---
label: "ADR-0020 : Accounts v2 et embarquement Stripe intégré"
order: 200
icon: law
description: "Pourquoi Surplasse utilise les comptes Connect Accounts v2, les charges directes et les composants Stripe intégrés pour l'embarquement."
---

# ADR-0020 : Accounts v2 et embarquement Stripe intégré

## Statut

Accepté, 2026-07-20. Remplace les [ADR-0007](adr-0007-stripe.md), [ADR-0017](adr-0017-charges-directes-stripe-connect.md) et [ADR-0018](adr-0018-controle-prise-commandes.md).

## Contexte

Les premiers essais réels avec Stripe Connect ont invalidé la formulation historique en « compte Express ». Pour une nouvelle intégration, Stripe expose désormais Accounts v2 et demande de décrire séparément les configurations, l'accès au Dashboard et la répartition des responsabilités. Le type historique du compte ne doit plus piloter la conception.

Le restaurateur ne veut pas ouvrir puis administrer un compte Stripe comme un produit distinct. Il doit néanmoins fournir ses informations légales, son compte bancaire, ses justificatifs éventuels et accepter les conditions applicables. Masquer cette réalité contractuelle serait trompeur. L'enjeu produit est donc de garder le restaurateur dans le parcours Surplasse tout en laissant Stripe collecter directement les données réglementées.

Trois choix d'embarquement existent. Un formulaire hébergé par Stripe réduit au minimum l'intégration mais interrompt visuellement le parcours. Les composants Connect intégrés restent dans l'interface Surplasse et suivent automatiquement les exigences de vérification. Un parcours entièrement construit avec l'API donne un contrôle maximal, mais transfère à Surplasse la collecte, la validation, la traduction et la maintenance continue des exigences KYC.

Le schéma financier reste celui d'un canal direct pour le restaurant. Le paiement doit être porté par le compte connecté de l'établissement, tandis que Surplasse prélève 0 % pendant les 3 premiers mois puis 1 %, hors frais Stripe. Un compte plateforme unique qui encaisse toutes les commandes puis déclenche des virements rendrait Surplasse plus central dans la chaîne financière, concentrerait les soldes et les pertes, et s'écarterait de ce positionnement.

## Options considérées

### Configuration du compte et des charges

| Option | Avantages | Inconvénients |
|---|---|---|
| **Accounts v2, configuration marchand, charges directes** | Le restaurant reste le marchand du paiement ; la transaction et le solde lui appartiennent ; la commission est collectée avec `application_fee_amount` ; les responsabilités sont explicites | Chaque requête de paiement et chaque événement doivent être rapprochés avec le bon compte connecté |
| Charges avec transfert depuis le compte plateforme | Encaissement et pilotage centralisés ; interface Stripe potentiellement moins visible pour le restaurant | Le paiement et le solde sont portés par la plateforme ; les responsabilités et pertes sont concentrées ; le modèle ressemble davantage à une place de marché |
| Transferts séparés après encaissement plateforme | Contrôle maximal du calendrier et des montants reversés | Rapprochement et exploitation plus complexes ; risque de solde plateforme ; flexibilité inutile pour un canal direct |

### Embarquement réglementaire

| Option | Avantages | Inconvénients |
|---|---|---|
| Stripe hébergé | Intégration minimale ; exigences et validations toujours à jour ; bon outil de qualification du pilote | Redirection visible vers Stripe ; personnalisation limitée |
| **Composants Connect intégrés** | Parcours dans Surplasse ; thème cohérent ; Stripe gère pays, langues, justificatifs, validations et changements réglementaires | Demande une session sécurisée côté Backend, une intégration frontend et des états de reprise explicites |
| Embarquement entièrement construit avec l'API | Contrôle intégral de l'interface et de la logique du parcours | Surplasse doit maintenir les formulaires, traductions, pièces, erreurs et changements KYC ; les données sensibles traversent davantage notre système |

## Décision

Surplasse conserve **Stripe** et le **Payment Element** pour le paiement client. Chaque établissement encaissable reçoit un compte connecté créé avec **Accounts v2** et la configuration `merchant`. Les paiements utilisent des **charges directes** sur ce compte. La requête Stripe porte le contexte du compte connecté et `application_fee_amount` porte uniquement la commission Surplasse lorsqu'elle est due.

La configuration de référence est la suivante :

- `dashboard=full`, afin que le restaurateur garde un accès de secours à ses finances et rapports Stripe ;
- `fees_collector=stripe` et `losses_collector=stripe`, combinaison imposée par le Dashboard complet et cohérente avec les charges directes ;
- capacité `card_payments` demandée sur la configuration marchand ;
- vérification de `configuration.merchant.capabilities.card_payments.status=active` avant tout nouvel encaissement ;
- suivi séparé de `configuration.merchant.capabilities.stripe_balance.payouts.status` pour vérifier que les fonds peuvent être versés ;
- aucune utilisation de `charges_enabled`, `payouts_enabled` ou du type de compte v1 comme source de vérité.

Le Backend crée le compte, génère les sessions nécessaires aux composants, traite les webhooks et rapproche les paiements. Le frontend Onboarding intègre en phase 3 au minimum les composants `account_onboarding`, `notification_banner` et `account_management`. Le restaurateur remplit ces surfaces depuis Surplasse, mais les informations d'identité, les documents et les coordonnées bancaires sont transmis directement à Stripe. Surplasse ne les persiste pas.

Le formulaire Stripe hébergé reste autorisé comme outil provisoire pour qualifier le compte du pilote de phase 2 et comme voie de secours. Il ne devient pas le parcours produit principal. L'embarquement entièrement construit avec l'API est exclu tant qu'une contrainte produit ou réglementaire démontrée ne justifie pas son coût continu.

Les événements Accounts v2 sont des événements fins. Après vérification de la signature, le Backend récupère l'état courant du compte via Accounts v2 avant d'ouvrir la transaction qui applique le nouvel état. Une perte de capacité force la prise de commandes à `paused`. Le Backend revérifie aussi la capacité `card_payments` auprès de Stripe juste avant la création de chaque Payment Intent, afin qu'un cache local en retard n'autorise jamais un encaissement.

Les événements snapshot v1 de paiement et les événements fins v2 de compte utilisent deux destinations, deux endpoints et deux secrets de signature distincts. Le Backend refuse un type d'événement qui ne correspond pas à la destination appelée. Cette séparation évite de traiter les deux contrats de payload et leurs secrets comme s'ils formaient un flux unique.

Le contrôle opérationnel décidé par l'ADR-0018 est conservé avec la nouvelle source de vérité. `order_intake_status` reste distinct du cycle de vie de l'établissement. Une perte de `card_payments` met la prise de commandes en pause sans interrompre le suivi, le Dashboard ni le rapprochement des paiements déjà engagés. Le retour à `active` ne rouvre jamais automatiquement le service. Une réouverture explicite revalide le compte, la carte et les tables sans modifier `activated_at`.

## Conséquences

### Positives

- Le restaurateur reste dans l'expérience Surplasse pour l'essentiel du parcours sans que Surplasse collecte ses justificatifs.
- Les exigences KYC, les traductions, les pièces et les validations évoluent chez Stripe sans reconstruction de nos formulaires.
- La charge directe conserve le restaurant comme marchand et limite le rôle financier de Surplasse à sa commission.
- Le Dashboard Stripe complet offre une voie de secours opérationnelle sans obliger Surplasse à reproduire immédiatement tous les rapports financiers.
- La double vérification, événements puis contrôle juste avant paiement, ferme la fenêtre où un état local obsolète pourrait autoriser un encaissement.
- Accounts v2 rend explicites les responsabilités et évite de bâtir une nouvelle intégration sur les types de comptes historiques.

### Négatives et dettes assumées

- Un compte connecté Stripe existe techniquement pour chaque établissement et le restaurateur doit accepter les conditions Stripe. La communication produit doit l'expliquer sans prétendre que Stripe est absent.
- Le composant intégré impose un endpoint Backend de session, une politique d'autorisation stricte et des états de reprise lorsque des informations deviennent exigibles.
- Le formulaire hébergé reste visible pendant la qualification du pilote, avant la livraison de la phase 3.
- Une indisponibilité de l'API Accounts v2 bloque par sécurité la création d'un nouveau Payment Intent.
- Le suivi des événements v1 de paiement et des événements v2 de compte impose deux destinations et deux secrets à configurer, faire tourner et superviser séparément.
- La tarification, les responsabilités contractuelles et la disponibilité exacte des moyens de paiement doivent encore être vérifiées en live avant le pilote réel.

## Références

- [Choisir une solution d'embarquement Stripe](https://docs.stripe.com/connect/onboarding)
- [Composant Account onboarding](https://docs.stripe.com/connect/supported-embedded-components/account-onboarding)
- [Configuration des comptes connectés Accounts v2](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration)
- [Événements de compte Accounts v2](https://docs.stripe.com/api/v2/core/accounts/event-types)
- [Charges directes Stripe Connect](https://docs.stripe.com/connect/direct-charges)
- [ADR-0018 : contrôle opérationnel remplacé](adr-0018-controle-prise-commandes.md)
