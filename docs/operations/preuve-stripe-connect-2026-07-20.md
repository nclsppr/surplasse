---
label: Preuve Stripe Connect du 2026-07-20
order: 36
icon: beaker
description: "Résultat de la première vérification Stripe Connect en mode test et condition exacte de reprise."
---

# Preuve Stripe Connect du 2026-07-20

Cette fiche applique la [porte 1 du pilote](pilote.md#porte-1--stripe-connect-en-test). Elle conserve uniquement des états et identifiants techniques non secrets. Le SHA de référence est le commit Git qui ajoute cette fiche.

## Périmètre

| Élément | Valeur |
|---|---|
| Environnement Stripe | Test |
| Établissement | Le Cormoran, fixture locale |
| Opération | Vérification de la plateforme, liste des comptes connectés, création idempotente d'un compte Express français |
| Clés | Fichiers `.env` locaux ignorés par git, aucune valeur archivée |
| Idempotence | Clé stable propre au provisionnement du pilote |

## Résultat observé

L'authentification à l'API Stripe réussit avec la clé de test. Le compte qui porte cette clé est un compte Standard français dont le dossier n'est pas soumis. Les paiements et virements de ce compte sont désactivés. Aucun compte connecté n'existe au moment du contrôle.

La tentative de création du compte Express renvoie HTTP 400. Stripe indique que la plateforme doit d'abord terminer son inscription à Connect dans le Dashboard. Le rejeu avec la même clé d'idempotence donne le même refus et ne crée aucun doublon.

| Critère | Résultat | Décision |
|---|---|---|
| Clé test valide | Oui | Poursuivre |
| Plateforme inscrite à Connect | Non | Bloquant |
| Compte Express créé | Non | Bloquant |
| `charges_enabled` sur le compte Express | Non vérifiable | Bloquant |
| Secret webhook Connect | Absent | Bloquant |
| Charge directe réelle en test | Non exécutée | Bloquant |

Décision : **No-Go porte 1**. Une charge sur le compte plateforme n'est jamais utilisée comme solution de secours.

## Travail logiciel validé sans compte réel

Le dépôt porte désormais le chemin Connect attendu :

- compte connecté, capacités et date d'activation sur l'établissement ;
- compte connecté et commission figés sur le paiement avant l'appel réseau ;
- `Stripe-Account` et métadonnées de rapprochement transmis au SDK Stripe ;
- `application_fee_amount` omis pendant les trois mois gratuits, puis calculé à 1 % avec arrondi inférieur ;
- même compte connecté fourni à Stripe.js dans Commande ;
- webhook rapproché par compte et Payment Intent, avec séparation stricte de `livemode` ;
- capacités Stripe resynchronisées par l'événement signé `account.updated`, puis contrôlées avant toute session nouvelle ou reprise ;
- tests unitaires, contrat et tests frontend sans clé réelle.

Ces preuves de code ne remplacent pas la charge réelle en mode test. Elles empêchent seulement de conserver l'ancien chemin plateforme pendant la reprise.

## Condition de reprise

Une personne habilitée doit ouvrir le Dashboard Stripe, activer Connect pour cette plateforme et compléter les informations demandées par Stripe. Cette étape peut inclure des informations professionnelles et l'acceptation de conditions. Elle n'est pas automatisée par Surplasse.

Après cette action :

1. rejouer la création idempotente du compte Express français ;
2. ouvrir le lien d'embarquement Stripe et terminer le dossier test ;
3. vérifier `details_submitted`, `charges_enabled`, `payouts_enabled`, les capabilities et les requirements ;
4. rattacher l'identifiant du compte à la fixture pilote ;
5. lancer Stripe CLI avec `--forward-connect-to` et conserver le secret `whsec_...` uniquement dans `backend/.env` ;
6. exécuter les scénarios accepté, refusé puis repris, SCA, rejeu, webhook dupliqué et compte incorrect ;
7. rapprocher le paiement, la commande et les événements, puis tester remboursement et suspension.

La porte 1 ne passe à Go qu'après la totalité de cette reprise et l'archivage des identifiants de rapprochement, sans secret ni donnée de carte.
