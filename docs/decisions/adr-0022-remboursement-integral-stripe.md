---
label: "ADR-0022 : remboursement intégral Stripe"
order: 220
icon: law
description: "Pourquoi le MVP réserve puis rapproche un remboursement intégral de charge directe et restitue la commission Surplasse."
---

# ADR-0022 : remboursement intégral Stripe

## Statut

Accepté, 2026-07-20.

## Contexte

Une commande déjà payée peut être refusée avant acceptation ou devenir impossible à servir après acceptation. Le restaurateur doit pouvoir rendre immédiatement la totalité du paiement sans quitter le Dashboard. Une simple transition de la commande vers `refunded` serait dangereuse : elle pourrait annoncer un remboursement au client alors que Stripe ne l'a jamais exécuté.

Les paiements Surplasse sont des charges directes sur le compte connecté de l'établissement. Le remboursement doit donc reprendre le compte Connect et le Payment Intent figés au paiement. Si Surplasse avait prélevé sa commission de 1 %, la conserver après un remboursement intégral pénaliserait le restaurant pour une vente annulée.

Un appel Stripe peut réussir puis perdre sa réponse. Le système doit tolérer ce résultat ambigu, les doubles clics, les reprises réseau et les webhooks livrés plusieurs fois sans créer deux remboursements. Le remboursement partiel ajouterait des décisions de répartition par ligne, pourboire et commission qui ne sont pas nécessaires au pilote.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Procédure manuelle dans le Dashboard Stripe | Aucun développement applicatif | Rupture du parcours, rapprochement fragile, commande locale potentiellement incohérente |
| Remboursement partiel ou intégral dès le MVP | Souplesse maximale pour le restaurateur | Interface plus complexe, choix comptables supplémentaires, surface de test trop large pour le pilote |
| **Remboursement intégral réservé et rapproché par Surplasse** | Un geste dans le Dashboard, idempotence persistante, cohérence entre Stripe, Paiement et Commande | Ne traite pas encore les remboursements partiels |

## Décision

Nous retenons le remboursement intégral applicatif pour les commandes `paid`, `accepted`, `preparing` ou `ready`.

Le Backend réserve une ligne `payment_refund` et associe la clé `Idempotency-Key` avant tout appel réseau. Cette réservation fige le paiement, le compte connecté, le Payment Intent, le montant total, la commission et le motif. L'appel Stripe est exécuté hors transaction avec la même clé d'idempotence et le contexte `Stripe-Account`. Le montant est omis pour demander le remboursement total. `refund_application_fee=true` est envoyé seulement lorsqu'une commission Surplasse positive a été prélevée.

Une clé rejouée rend exactement le remboursement déjà associé. Une nouvelle clé réutilise tout remboursement en cours ou réussi. Après un échec ou une annulation confirmés, une nouvelle clé peut créer une nouvelle tentative. Une panne dont le résultat Stripe reste inconnu conserve la réservation `creating` afin qu'une reprise utilise la même intention au lieu d'en créer une autre.

La commande ne passe jamais à `refunded` sur la seule demande du Dashboard. Le résultat synchrone Stripe ou un événement signé `refund.created`, `refund.updated` ou `refund.failed` rapproche le remboursement. Seul le statut Stripe `succeeded` marque le paiement puis la commande comme remboursés dans une transaction cohérente et diffuse l'événement de suivi. Tant qu'un remboursement est `creating`, `pending` ou `requires_action`, le Dashboard ne peut pas faire avancer la commande en cuisine.

Le Dashboard affiche « Refuser » pour une commande encore `paid`. Après acceptation, il affiche « Rembourser » et demande un motif parmi produit indisponible et incident de service. La confirmation rappelle le montant total et la restitution éventuelle de la commission Surplasse.

Le remboursement partiel reste hors MVP. Il exigera un nouvel ADR avant toute extension du contrat.

## Conséquences

### Positives

- Stripe, le paiement local, la commande et le suivi client convergent vers le même état.
- Les doubles clics, les reprises réseau et les événements dupliqués ne créent pas de second remboursement.
- Le restaurant récupère la commission Surplasse lorsque la vente est intégralement annulée.
- Le Dashboard couvre le refus avant acceptation et les incidents pendant la préparation.
- Le chemin critique reste une orchestration transactionnelle locale sans introduire Temporal avant que son besoin soit démontré.

### Négatives et dettes assumées

- Un remboursement partiel nécessite une conception et une qualification ultérieures.
- Un résultat réseau ambigu peut laisser une réservation `creating` jusqu'à sa reprise ou son rapprochement webhook.
- Les événements de remboursement doivent être ajoutés à la destination snapshot Stripe et à sa supervision.
- Le chemin est validé localement avec des doublures, mais reste à qualifier contre le compte Connect test réel après son embarquement.

## Références

- [Remboursements Stripe](https://docs.stripe.com/refunds)
- [Charges directes Stripe Connect](https://docs.stripe.com/connect/direct-charges)
- [ADR-0020 : Accounts v2 et embarquement Stripe intégré](adr-0020-accounts-v2-onboarding-embarque.md)
