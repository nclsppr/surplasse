---
label: "ADR-0015 : Modèle de commission"
order: 150
icon: law
description: "Pourquoi Surplasse offre trois mois sans commission puis prélève 1 % par commande, hors frais Stripe."
---

# ADR-0015 : Modèle de commission

## Statut

Accepté, 2026-07-19.

## Contexte

Surplasse doit financer l'exploitation de la plateforme sans reproduire les commissions élevées et opaques des marketplaces. Le modèle doit rester simple à comprendre pour un restaurateur, proportionnel à son activité et sans coût Surplasse tant que le nouveau canal de commande n'a pas encore fait ses preuves.

Les frais Stripe sont distincts de la rémunération de Surplasse. Ils comprennent les frais de transaction et les frais liés à Stripe Connect. Leur montant dépend notamment du moyen de paiement et du schéma de charges Connect, qui reste à préciser. La communication publique doit donc séparer sans ambiguïté la commission Surplasse des frais facturés par Stripe.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Commission dès la première commande | Revenus immédiats, modèle simple | Frein à l'essai avant que Surplasse ait démontré sa valeur dans un service réel |
| Abonnement mensuel fixe | Revenus prévisibles | Coût supporté même sans commande, mal aligné sur l'activité des petits établissements |
| **0 % pendant les 3 premiers mois, puis 1 % par commande** | Essai sans commission Surplasse, rémunération ensuite proportionnelle à l'usage, taux facile à expliquer | Aucun revenu de commission pendant la période de lancement ; les frais Stripe restent dus dès le premier paiement |

## Décision

Nous retenons une commission Surplasse de **0 % pendant les 3 premiers mois suivant l'activation de chaque établissement, puis 1 % du montant de chaque commande**.

Cette commission ne comprend pas les frais Stripe. Les frais de transaction et les éventuels frais Stripe Connect sont présentés séparément. Leur chiffrage exact sera vérifié avec le schéma de charges Connect et le panier moyen réel avant l'ouverture commerciale.

La future vitrine Onboarding doit expliquer publiquement ce modèle. La homepage présente le tarif et conduit vers l'embarquement. Une documentation destinée aux restaurateurs détaille le fonctionnement, les commissions et les frais Stripe. Le blog complète cet ensemble avec des contenus utiles au référencement de `surplasse.com`.

## Conséquences

### Positives

- Le restaurateur peut éprouver Surplasse pendant trois mois sans commission de plateforme.
- Le tarif reste proportionnel au volume réellement encaissé après la période de lancement.
- La distinction entre commission Surplasse et frais Stripe rend le coût total vérifiable.
- Le modèle se résume en une phrase et peut être affiché clairement sur la homepage et dans la documentation publique.

### Négatives et dettes assumées

- Surplasse supporte ses coûts d'exploitation sans revenu de commission pendant les trois premiers mois de chaque établissement.
- Les frais Stripe s'appliquent dès le premier paiement et peuvent rendre la période gratuite moins évidente à expliquer : la communication doit préciser qu'elle concerne la commission Surplasse.
- Le coût total exact ne peut pas être publié avant d'avoir tranché le schéma de charges Connect et vérifié les tarifs Stripe applicables.
