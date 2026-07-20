---
label: Preuve Stripe Connect du 2026-07-20
order: 36
icon: beaker
description: "État de la qualification Stripe Connect Accounts v2 en mode test et condition exacte de reprise."
---

# Preuve Stripe Connect du 2026-07-20

Cette fiche applique la [porte 1 du pilote](pilote.md#porte-1--stripe-connect-en-test). Elle conserve uniquement des états et identifiants techniques non secrets. Le SHA de référence est le commit Git qui ajoute la dernière mise à jour de cette fiche.

## Périmètre

| Élément | Valeur |
|---|---|
| Environnement Stripe | Test |
| Établissement | La Paprika, pilote fictif dédié |
| Plateforme | Compte français `acct_1Bh6s5CvIDeBzuRb` |
| Compte connecté | Accounts v2 `acct_1TvOQECvIDZfXjyu` |
| Configuration | `merchant`, `dashboard=none`, frais, pertes et exigences collectés par Stripe |
| Opérations | Création Accounts v2 par jeton v2, demande de `card_payments`, session Connect intégrée, rendu réel du composant en français, lecture des capacités |
| Clés | Fichiers `.env` locaux ignorés par git, aucune valeur archivée |

## Résultat observé

La première tentative historique de création d'un compte Express a été refusée tant que la plateforme n'était pas inscrite à Connect. Après l'inscription dans le Dashboard Stripe, le compte plateforme est devenu encaissable et payable en environnement de test, sans exigence restante.

Le premier compte `acct_1TvJsYCvIDRh8N2N`, nommé Le Cormoran, utilisait `dashboard=full`. Son formulaire hébergé demandait des accès Stripe autonomes et n'a pas été terminé. Il est conservé comme compte test abandonné, sans rattachement ni paiement. Il ne doit plus être utilisé.

La seconde tentative suit Accounts v2 avec un jeton de compte v2, sans acceptation déléguée des conditions. Le nouveau compte La Paprika utilise `dashboard=none`. Stripe reste collecteur des frais, des pertes et des exigences. Une session courte active `account_onboarding`, `notification_banner` et `account_management`. Le composant `account_onboarding` se rend réellement en français dans la page Surplasse locale, en vue mobile et bureau, sans redirection vers un Dashboard Stripe.

Le parcours n'est pas encore terminé par le titulaire. L'état Accounts v2 observé reste donc fermé :

| Critère | Résultat | Décision |
|---|---|---|
| Clé test valide | Oui | Poursuivre |
| Plateforme inscrite à Connect | Oui | Poursuivre |
| Compte Accounts v2 créé | Oui | Poursuivre |
| Configuration marchand appliquée | Oui | Poursuivre |
| `card_payments.status` | `restricted` | Bloquant |
| `stripe_balance.payouts.status` | `restricted` | Bloquant |
| Session Connect intégrée | Oui | Poursuivre |
| Embarquement et conditions Stripe | Incomplets | Bloquant |
| Destination d'événements Connect et secret | Absents | Bloquant |
| Charge directe réelle en test | Non exécutée | Bloquant |

Décision : **No-Go porte 1**. Le compte existe et la plateforme est prête, mais aucun paiement ne doit être créé avant que `card_payments.status` soit `active`. Une charge sur le compte plateforme n'est jamais utilisée comme solution de secours.

## Travail logiciel validé

Le dépôt porte désormais le chemin Accounts v2 attendu :

- page locale Surplasse avec Connect.js, session courte côté serveur, clé secrète confinée au serveur et refus des origines étrangères ;
- SDK Stripe Java 33.1.1 avec client v2 pour les comptes et client v1 explicite pour les Payment Intents ;
- lecture autoritaire de `configuration.merchant.capabilities.card_payments.status` et de `stripe_balance.payouts.status` ;
- vérification Accounts v2 juste avant chaque création de Payment Intent, en plus du cache local fermé par défaut ;
- compte connecté, capacités actives et date d'activation sur l'établissement ;
- compte connecté et commission figés sur le paiement avant l'appel réseau ;
- `Stripe-Account` et métadonnées de rapprochement transmis au SDK Stripe ;
- `application_fee_amount` omis pendant les 3 premiers mois, puis calculé à 1 % avec arrondi inférieur ;
- même compte connecté fourni à Stripe.js dans Commande ;
- événements fins Accounts v2 vérifiés puis enrichis par une lecture du compte avant la transaction de mise à jour ;
- webhook de paiement rapproché par compte et Payment Intent, avec séparation stricte de `livemode` ;
- remboursement intégral réservé avant Stripe, routé sur le compte connecté et rapproché par réponse ou webhook signé ;
- restitution de la commission Surplasse, idempotence persistante et transition atomique du paiement puis de la commande vers `refunded` ;
- endpoints, familles de payloads et secrets distincts pour les paiements snapshot et les comptes fins Accounts v2 ;
- perte de `card_payments` mise en pause de façon fermée, sans réouverture automatique ;
- migrations V13 pour les capacités Accounts v2 et V14 pour les tentatives de remboursement et leurs clés d'idempotence ;
- tests unitaires Java 21 verts sur les capacités, les signatures, l'orchestration des webhooks et le paiement.

Ces preuves de code ne remplacent pas la charge réelle en mode test. Elles empêchent le chemin plateforme et ferment une fenêtre de cache obsolète avant Stripe.

## Condition de reprise

Le titulaire du compte pilote doit ouvrir `https://surplasse.test/connect.html` avec l'Onboarding local actif, puis terminer le composant intégré. Cette étape comprend les informations professionnelles, l'IBAN, les justificatifs éventuels et l'acceptation des conditions Stripe. Surplasse ne doit ni inventer ces données, ni les stocker.

Après cette action :

1. relire le compte via Accounts v2 et archiver les états `card_payments` et `stripe_balance.payouts` ;
2. rattacher l'identifiant du compte à l'établissement pilote par un mécanisme répétable, jamais par une modification SQL improvisée ;
3. créer la destination snapshot des paiements et remboursements Connect vers `/v1/webhooks/stripe` ;
4. créer séparément la destination fine Accounts v2 vers `/v1/webhooks/stripe/accounts` ;
5. conserver les deux secrets `whsec_...` uniquement dans `backend/.env`, respectivement sous `STRIPE_PAYMENT_WEBHOOK_SECRET` et `STRIPE_ACCOUNT_WEBHOOK_SECRET` ;
6. exécuter les scénarios accepté, refusé puis repris, SCA, rejeu, webhook dupliqué et compte incorrect ;
7. rapprocher le paiement, la commande et les événements, puis vérifier la commission gratuite ;
8. tester le remboursement intégral ;
9. retirer la capacité en test ou simuler son état, vérifier le passage à `paused`, le refus des nouvelles admissions et la continuité du suivi ;
10. restaurer la capacité et vérifier que seule une réouverture explicite reprend le service.

La porte 1 ne passe à Go qu'après la totalité de cette reprise et l'archivage des identifiants de rapprochement, sans secret, donnée de carte ni justificatif d'identité.
