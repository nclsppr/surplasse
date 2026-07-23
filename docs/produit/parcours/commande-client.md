---
label: Commande client
order: 20
icon: device-mobile
description: Le parcours du client convive de bout en bout, du scan du QR code au pourboire, avec les cas limites et les exigences UX transverses.
---

# Parcours : la commande client

Ce parcours décrit l'expérience du client, le convive attablé ou de passage, depuis le scan du QR code jusqu'à l'après-repas. C'est le parcours le plus fréquent et le plus sensible du produit : chaque friction se paie en commande abandonnée. Il est porté par l'application **Commande**, le mini-site de l'établissement servi sur `{slug}.surplasse.com` (voir [les frontends](../../architecture/frontends.md)).

Le principe directeur est constant : **zéro barrière**. Pas d'application à installer, pas de compte à créer, pas de bandeau parasite. Le client scanne, consulte, commande, paie. Tout le reste est optionnel.

## Vue d'ensemble

```
  Client                        Mini-site (Commande)               Cuisine / Dashboard
    |                                  |                                  |
    |  1. Scan QR (table, sticker)     |                                  |
    |--------------------------------->|                                  |
    |                                  |                                  |
    |  2. Carte visible < 2 s          |                                  |
    |<---------------------------------|                                  |
    |                                  |                                  |
    |  3. Consultation de la carte     |                                  |
    |  4. Constitution du panier       |                                  |
    |  5. Sur place / à emporter       |                                  |
    |--------------------------------->|                                  |
    |                                  |                                  |
    |  6. Paiement (Apple Pay,         |                                  |
    |     Google Pay, CB)              |                                  |
    |--------------------------------->|                                  |
    |                                  |  Paiement confirmé :             |
    |                                  |  transmission de la commande     |
    |                                  |--------------------------------->|
    |                                  |                                  |
    |  7. Suivi temps réel             |   recue -> acceptee ->           |
    |     (page de confirmation)       |   en preparation ->              |
    |<---------------------------------|   prete / servie                 |
    |                                  |<---------------------------------|
    |                                  |                                  |
    |  8. Pourboire, avis, opt-in      |                                  |
    |--------------------------------->|                                  |
```

## Étape 1 : le scan du QR code

Le point d'entrée principal est un QR code physique placé par le restaurateur : sur la table, en sticker sur la vitrine, sur un sous-verre ou un chevalet. Chaque QR code encode l'URL du mini-site de l'établissement, avec le contexte du support :

| Support | URL encodée | Contexte transmis |
|---|---|---|
| QR de table | `{slug}.surplasse.com/?table={identifiant}` | Numéro de table pré-rempli, mode sur place par défaut |
| Sticker, sous-verre, chevalet | `{slug}.surplasse.com` | Aucun : le client choisit son mode à l'étape 5 |
| Lien direct (Instagram, Google, site du restaurant) | `{slug}.surplasse.com` | Aucun ; sert aussi la commande à emporter à distance |

L'identifiant de table encodé dans l'URL est un jeton stable et non devinable, jamais un numéro séquentiel (voir [les intégrations](../../architecture/integrations.md)) : le numéro de table affiché au client vient de la résolution du jeton par le backend, pas de l'URL elle-même.

Le lien direct est un point d'entrée à part entière : un client peut commander à emporter depuis chez lui sans jamais avoir scanné de QR code.

## Étape 2 : l'ouverture du mini-site

Le scan ouvre immédiatement le mini-site dans le navigateur du téléphone. Trois engagements non négociables :

- **Pas d'application.** Tout se passe dans le navigateur mobile, sans installation ni redirection vers un store.
- **Pas de compte.** Le client n'a jamais d'identifiant Surplasse. Une session anonyme suffit pour tout le parcours.
- **Pas de bandeau parasite.** Pas d'interstitiel, pas de popup de bienvenue, pas de bannière promotionnelle Surplasse. Le mini-site porte l'identité de l'établissement, pas celle de la plateforme.

!!! warning Exigence de performance
La carte doit être visible en moins de 2 secondes sur un mobile en 4G. C'est une exigence produit, pas une préférence : un client debout ou attablé qui attend un écran blanc abandonne. Cette contrainte guide l'architecture de l'application Commande (rendu léger, images optimisées, mise en cache agressive de la carte), détaillée dans [les frontends](../../architecture/frontends.md).
!!!

## Étape 3 : la consultation de la carte

Le client parcourt la carte de l'établissement, structurée en catégories (entrées, plats, desserts, boissons, ou toute structure choisie par le restaurateur). Chaque produit présente :

| Élément | MVP | Cible |
|---|---|---|
| Nom et description | Oui | Oui |
| Prix | Oui | Oui |
| Photo | Si fournie par le restaurateur | Oui, avec traitement homogène |
| Options (cuisson, taille, suppléments) | Oui | Oui |
| Allergènes | Non | Oui, déclarés par le restaurateur, filtrables par le client |
| Disponibilité | Oui (un produit épuisé est signalé, non commandable) | Oui |

La navigation privilégie le geste naturel du mobile : défilement vertical continu, barre de catégories flottante pour sauter d'une section à l'autre, fiche produit ouverte en surcouche sans quitter la carte.

## Étape 4 : la constitution du panier

Le client ajoute des produits au panier depuis la fiche produit :

1. Choix des options si le produit en a (une cuisson, une taille, des suppléments). Les options obligatoires bloquent l'ajout tant qu'elles ne sont pas renseignées ; les options facultatives ont une valeur par défaut.
2. Choix de la quantité.
3. Note libre éventuelle (« sans oignons », « sauce à part »), transmise telle quelle en cuisine.

Le panier reste accessible en permanence via une pastille récapitulative (nombre de produits, total). Le client peut y modifier les quantités, retirer un produit ou revenir à la carte à tout moment. Le panier est un état local avant validation : il ne devient une commande qu'au paiement.

## Étape 5 : sur place ou à emporter

Avant le paiement, le client confirme le mode de sa commande :

- **Sur place** : le numéro de table est pré-rempli si le client est arrivé par un QR de table. Sinon, il le saisit (ou le sélectionne dans la liste des tables de l'établissement). La commande sera servie à table.
- **À emporter** : le client choisit un créneau de retrait parmi ceux que l'établissement propose (dès que possible, ou un horaire précis). Il renseigne un numéro mobile pour le SMS « Prête » et peut ajouter un prénom pour l'appel au comptoir.

L'établissement peut n'activer qu'un seul des deux modes. Le mode et son contexte (table ou créneau) font partie de la commande transmise en cuisine.

## Étape 6 : le paiement

Le paiement est intégré au parcours, via Stripe :

| Moyen | Statut |
|---|---|
| Apple Pay | MVP |
| Google Pay | MVP |
| Carte bancaire | MVP |
| PayPal | Roadmap |

Apple Pay et Google Pay sont présentés en premier : sur mobile, ils permettent de payer en deux gestes sans saisir de numéro de carte. La saisie CB reste disponible en repli.

**Le paiement précède la transmission en cuisine.** Une commande n'est transmise à l'établissement qu'une fois le paiement confirmé. Le restaurateur ne voit jamais une commande impayée ; il n'y a ni encaissement à table ni addition en fin de repas pour ce qui passe par Surplasse.

## Étape 7 : confirmation et suivi

Une fois le paiement confirmé, le client arrive sur une page de confirmation qui affiche le récapitulatif de la commande, le numéro de commande et l'avancement en temps réel :

```
  recue --> acceptee --> en preparation --> prete (a emporter)
                                        \-> servie (sur place)
```

Chaque changement de statut, effectué par le restaurateur depuis le Dashboard, est poussé au client par SSE sans rechargement. La sémantique exacte des statuts et leurs transitions sont spécifiées dans [le modèle de données](../../architecture/donnees.md).

La page de suivi reste accessible via l'URL de la commande : le client peut fermer son navigateur et y revenir. Pour une commande à emporter, le numéro mobile recueilli au strict nécessaire reçoit un SMS lorsque la commande passe à « Prête ». Le SMS ne contient aucune donnée sensible et ne vaut pas consentement marketing.

## Étape 8 : après le repas

L'après-repas est le seul moment où le mini-site sollicite le client, avec trois propositions distinctes, toutes facultatives :

1. **Pourboire numérique, phase 5.** Proposé au moment opportun : à l'état « servie » pour le sur place, jamais avant ni pendant le paiement principal. Montants suggérés et montant libre, versés à l'établissement via un paiement Stripe distinct.
2. **Avis.** Une invitation à laisser un avis, orientée en priorité vers la fiche Google de l'établissement (c'est le référencement du restaurateur qui en bénéficie, pas Surplasse).
3. **Opt-in marketing.** Une case explicite, décochée par défaut, pour recevoir les actualités de l'établissement (et de lui seul). Jamais de pré-cochage, jamais de conditionnement d'une fonctionnalité à l'opt-in.

!!! info Le client reste celui du restaurant
Conformément au positionnement de Surplasse, les données de contact collectées via l'opt-in appartiennent à l'établissement. Surplasse ne constitue pas de base marketing transverse et ne sollicite jamais le client pour son propre compte.
!!!

## Cas limites

### Tablée qui commande en plusieurs fois

Une tablée de quatre n'attend pas d'avoir un panier commun : chaque convive scanne le même QR de table et passe sa propre commande, payée séparément. Côté cuisine, le Dashboard regroupe les commandes par table pour que le service reste cohérent. Le panier partagé multi-convives (un panier, plusieurs payeurs) n'est pas dans le MVP et reste à trancher pour la cible.

### Commandes successives sur la même table

Commander un dessert ou une seconde tournée est le cas nominal, pas un cas d'erreur. Le client re-scanne le QR (ou revient sur l'onglet resté ouvert) et passe une nouvelle commande, rattachée à la même table. Chaque commande a son propre paiement et son propre suivi ; le Dashboard les présente dans le fil de la table.

### Coupure réseau en cours de commande

Le panier est persisté localement sur l'appareil : une coupure réseau pendant la consultation ou la constitution du panier ne fait rien perdre. Si la coupure survient pendant le paiement, la reprise de session interroge le backend sur l'état réel du paiement avant tout réaffichage : soit le paiement a abouti et le client est redirigé vers sa page de suivi, soit il n'a pas abouti et le panier est restitué intact. Aucun scénario ne doit pouvoir déboucher sur un double paiement.

### Paiement refusé

Un refus (plafond, opposition, 3-D Secure échoué) ramène le client à l'écran de paiement avec un message clair et le panier intact. Il peut changer de moyen de paiement et réessayer immédiatement. Rien n'est transmis en cuisine, aucune commande n'apparaît côté restaurateur.

### Produit devenu indisponible entre l'ajout au panier et le paiement

Le restaurateur peut marquer un produit épuisé à tout moment depuis le Dashboard. La disponibilité est revérifiée au moment de la validation du paiement : si un produit du panier n'est plus disponible, le paiement est bloqué avant tout débit, le produit est signalé dans le panier et le client peut le retirer ou le remplacer, puis payer le nouveau total. Le client n'est jamais débité pour un produit que la cuisine ne peut pas servir.

### QR scanné hors des horaires d'ouverture

Le mini-site reste consultable en permanence : hors horaires, la carte s'affiche en lecture seule avec les horaires d'ouverture et la mention explicite que la commande est fermée. Si l'établissement propose l'à emporter avec créneaux, la pré-commande pour le prochain créneau d'ouverture est une évolution en cible, à trancher.

## Exigences UX transverses

Ces exigences valent pour tout le parcours et s'imposent à l'application Commande :

| Exigence | Règle |
|---|---|
| Mobile-first | Le mobile est le support de conception, pas une adaptation. Le desktop est un confort secondaire (commande à emporter depuis un ordinateur). |
| Performance | Carte visible en moins de 2 secondes sur mobile 4G ; interactions sans latence perceptible ; suivi temps réel sans rechargement. |
| Poids des pages | Budget strict de poids par page (images de la carte optimisées et servies aux bonnes dimensions, pas de dépendance JavaScript superflue). Le budget chiffré est fixé par [les frontends](../../architecture/frontends.md). |
| Accessibilité | Cibles tactiles suffisantes, contrastes conformes, navigation possible au lecteur d'écran, aucune information portée par la couleur seule. Objectif : RGAA / WCAG niveau AA en cible. |
| Langues | Français au MVP. En cible : anglais, puis langues additionnelles selon la clientèle des établissements. La carte elle-même reste dans la langue du restaurateur au MVP ; sa traduction assistée par IA est une piste en cible, à trancher. |
| Sobriété | Aucun élément d'interface qui serve Surplasse au détriment du restaurant : pas de promotion croisée, pas de collecte non sollicitée, opt-in toujours explicite. |

Le détail technique de l'application Commande (stack, rendu, budget de performance) est dans [les frontends](../../architecture/frontends.md). Les statuts de commande et leur cycle de vie sont spécifiés dans [le modèle de données](../../architecture/donnees.md).
