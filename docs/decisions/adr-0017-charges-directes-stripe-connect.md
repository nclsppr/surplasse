---
label: "ADR-0017 : Charges directes Stripe Connect"
order: 170
icon: law
description: "Pourquoi chaque paiement est créé directement sur le compte Stripe Connect Express de l'établissement."
---

# ADR-0017 : charges directes Stripe Connect

## Statut

Accepté, 2026-07-20.

## Contexte

L'[ADR-0007](adr-0007-stripe.md) fixe Stripe Connect Express, mais laisse ouvert le schéma de charges. Ce choix détermine le compte qui porte le paiement, la visibilité de la transaction, la collecte de la commission, le traitement des remboursements et des litiges, ainsi que la configuration des webhooks.

Surplasse fournit un canal de commande directe. Le restaurant garde son identité, ses prix et sa relation commerciale. Le paiement doit donc apparaître sur son compte connecté, tandis que Surplasse prélève uniquement sa commission. Cette commission est de 0 % pendant les 3 premiers mois suivant l'activation de l'établissement, puis de 1 % par commande, hors frais Stripe, conformément à l'[ADR-0015](adr-0015-modele-commission.md).

Le pilote de phase 2 doit pouvoir être provisionné manuellement sans préjuger du tunnel d'embarquement automatisé de la phase 3. En revanche, il ne doit exister aucun mode dégradé qui encaisse silencieusement sur le compte plateforme quand le compte connecté manque ou n'est pas activé.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Charges directes** | La charge est créée sur le compte connecté, apparaît dans son solde et son Dashboard Stripe. La commission Surplasse est collectée avec `application_fee_amount`. Le modèle correspond à un canal direct du restaurant. | Les requêtes API, Stripe.js et les webhooks doivent tous être rattachés au bon compte connecté. Les remboursements et litiges affectent le solde du compte connecté, avec une responsabilité opérationnelle à cadrer. |
| Charges avec transfert, dites destination charges | Intégration centralisée sur le compte plateforme. La plateforme contrôle la charge et transfère automatiquement le solde au restaurant. | La charge et les frais Stripe sont portés par la plateforme. Le modèle rend Surplasse plus central dans la chaîne financière que ne l'exige le produit. |
| Charges séparées et transferts | Permet de répartir un paiement entre plusieurs bénéficiaires et de découpler charge et transfert. | Complexité de rapprochement et de calendrier inutile pour une commande qui ne bénéficie qu'à un établissement. Risque d'écart entre paiement et transfert. |

## Décision

Nous retenons les **charges directes Stripe Connect** sur le compte Express de l'établissement.

Concrètement :

- le Backend crée chaque Payment Intent dans le contexte du compte connecté de l'établissement ;
- le front Commande initialise Stripe.js avec ce même compte connecté avant d'afficher le Payment Element ;
- le Payment Intent porte une commission Surplasse de 0 centime pendant les 3 premiers mois, puis de 1 % du montant de la commande ;
- le Backend reçoit les événements Connect et vérifie que le compte de l'événement correspond au compte mémorisé sur le paiement avant tout changement d'état ;
- un établissement sans compte connecté encaissable reçoit une erreur métier fermée, jamais une charge plateforme de secours ;
- le compte Express du pilote est créé et rattaché manuellement en phase 2 ; la création du compte et le parcours KYC deviennent automatisés dans l'Onboarding en phase 3.

Les paramètres live exacts du compte plateforme, la tarification Stripe applicable et la répartition contractuelle des pertes restent des portes de lancement. Ils sont vérifiés dans le Dashboard Stripe et dans les conditions applicables avant la première transaction réelle. Cette vérification ne change pas le schéma de charges retenu.

## Conséquences

### Positives

- Le flux financier reflète la promesse produit : le restaurant encaisse directement sur son compte connecté.
- La transaction et son solde sont visibles dans le Dashboard Stripe Express du restaurant.
- La commission Surplasse reste prélevée à la source sans transfert applicatif séparé.
- Le pilote manuel et l'embarquement automatisé utilisent le même schéma financier.
- Une commande ne peut pas être encaissée si son établissement n'est pas correctement activé.

### Négatives et dettes assumées

- L'identifiant du compte connecté et son état d'activation deviennent des données critiques de l'établissement.
- Le client Stripe côté navigateur doit connaître le compte connecté, sans toutefois recevoir de secret.
- Les webhooks Connect doivent être configurés et rapprochés par compte, en plus de la signature de l'événement.
- Les remboursements, litiges, soldes négatifs et commissions restituées demandent une politique opérationnelle explicite avant le live.
- La responsabilité juridique et financière exacte dépend aussi de la configuration Stripe et des conditions contractuelles applicables. Elle doit être validée avant le pilote réel.

## Références

- [Charges directes Stripe Connect](https://docs.stripe.com/connect/direct-charges)
- [Charges avec transfert Stripe Connect](https://docs.stripe.com/connect/destination-charges)
- [Webhooks Stripe Connect](https://docs.stripe.com/connect/webhooks)
