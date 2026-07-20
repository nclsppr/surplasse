---
label: "ADR-0007 : Stripe et Stripe Connect"
order: 70
icon: law
description: Choix de Stripe, avec Stripe Connect en comptes Express, comme fournisseur de paiement de la plateforme.
---

# ADR-0007 : Stripe avec Stripe Connect comme fournisseur de paiement

## Statut

**Accepté**, 2026-07-18.

## Contexte

Le paiement est au cœur du produit. Dans le parcours [Commande côté client](../produit/parcours/commande-client.md), le client scanne un QR code à table, compose son panier et paie depuis son téléphone, sans application ni compte. Le paiement précède la confirmation de la commande : tant que le paiement n'est pas confirmé, aucune commande ne part en cuisine. Le fournisseur de paiement conditionne donc directement le taux de conversion du parcours le plus critique de la plateforme.

### Une mécanique de plateforme

Surplasse n'est pas une marketplace, mais la mécanique financière est celle d'une plateforme : Surplasse encaisse au nom de l'établissement, prélève sa commission, puis reverse le solde au restaurateur.

```
Client                Surplasse                 Restaurateur
  |                       |                          |
  |  paie la commande     |                          |
  |---------------------->|                          |
  |                       |  commission plateforme   |
  |                       |  retenue à la source     |
  |                       |                          |
  |                       |  reversement automatique |
  |                       |------------------------->|
  |                       |                          |
  |  confirmation         |                          |
  |<----------------------|   commande en cuisine    |
```

Cette position d'intermédiaire d'encaissement emporte des obligations réglementaires lourdes en Europe (DSP2, lutte contre le blanchiment) : vérification d'identité des restaurateurs bénéficiaires (KYC), authentification forte du payeur (SCA, 3-D Secure), traçabilité des flux. Porter ces obligations en propre supposerait un agrément d'établissement de paiement, hors de portée et hors sujet pour Surplasse. Le fournisseur retenu doit donc être un acteur régulé qui porte ces obligations à notre place, dans un produit conçu pour les plateformes.

### Contraintes structurantes

| Contrainte | Exigence |
|---|---|
| Contexte d'usage | Paiement mobile à table, en quelques secondes, sans compte |
| Moyens de paiement | Carte bancaire, Apple Pay et Google Pay indispensables au MVP |
| Flux financiers | Encaissement pour le compte des établissements, commission plateforme, reversement automatique |
| Embarquement | Le KYC du restaurateur doit s'insérer dans le tunnel d'embarquement sans le casser |
| Réglementaire | KYC des restaurateurs et SCA du payeur délégués au fournisseur |
| Conformité carte | Aucune donnée de carte dans les systèmes Surplasse (voir [Sécurité](../architecture/securite.md)) |
| Développement | Mode test complet et documentation permettant d'itérer sans compte de production |

Sur téléphone, Apple Pay et Google Pay ne sont pas un confort : ils suppriment la saisie de carte, qui est le principal point d'abandon d'un paiement mobile. Un client attablé qui doit sortir sa carte bancaire et recopier seize chiffres est un client qui appelle le serveur. L'intégration native des deux wallets, sans développement spécifique par wallet, pèse fortement dans la décision.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Stripe avec Stripe Connect (comptes Express)** | Connect Express conçu exactement pour les plateformes qui encaissent au nom de marchands : KYC entièrement délégué à Stripe, virements automatiques aux restaurateurs, commission prélevée à la source. Apple Pay et Google Pay natifs dans le Payment Element, sans intégration par wallet. Documentation et mode test exemplaires. Périmètre PCI réduit au SAQ A. | Commissions à intégrer au modèle économique. Dépendance forte à un fournisseur unique. Compte plateforme soumis à validation par Stripe. |
| **Adyen for Platforms** | Acteur européen très solide, produit plateforme complet, taux d'acceptation réputés, tarification potentiellement avantageuse à fort volume. | Orienté grands comptes : accès commercial sur dossier, tarification sur devis, intégration nettement plus lourde. Surdimensionné pour un MVP porté par une très petite équipe. |
| **Mollie** | Acteur européen apprécié des PME, tarification lisible, moyens de paiement locaux bien couverts. | Fonctionnalités de plateforme moins abouties que Connect (parcours KYC, reversements, outillage). Documentation et mode test en retrait. Intégration des wallets moins directe. |
| **PayPal seul** | Notoriété maximale auprès du grand public, mise en place rapide, confiance spontanée d'une partie des clients. | Non conçu comme socle de plateforme multi-marchands. Parcours de paiement qui sort du mini-site (redirection), inadapté au paiement à table. Couverture carte et wallets insuffisante pour être le seul rail. |

### Analyse

**Adyen** est l'alternative la plus crédible sur le papier : son produit plateforme est complet et l'acteur est solide. Mais tout, dans son modèle commercial, vise des volumes que Surplasse n'aura pas avant longtemps : accès sur dossier, tarification négociée, intégration qui suppose une équipe dédiée. Le retenir au MVP, c'est payer aujourd'hui la complexité d'un problème de passage à l'échelle qui ne se posera peut-être jamais sous cette forme.

**Mollie** est sympathique et bien positionné sur les PME européennes, mais son offre plateforme est précisément le point où il est le moins mature. Or c'est le cœur de notre besoin : le KYC délégué et les reversements automatiques ne sont pas des options, ce sont les fonctions qui rendent le produit opérable par une petite équipe.

**PayPal seul** échoue sur le contexte d'usage : une redirection hors du mini-site au moment de payer, à table, est exactement la rupture de parcours que le produit promet d'éviter. En revanche, sa notoriété reste un argument auprès d'une partie des clients : c'est ce qui motive son repositionnement en complément plutôt que son abandon.

**Stripe Connect Express** coche chaque contrainte sans surcoût d'intégration : le cas d'usage « plateforme qui encaisse au nom de marchands » est celui pour lequel le produit est conçu, documenté et outillé.

## Décision

Surplasse retient **Stripe** comme fournisseur de paiement, avec **Stripe Connect en comptes Express** pour les établissements.

Concrètement, dans la cible :

- Chaque établissement activé dispose d'un compte Stripe Express créé lors de l'[embarquement du restaurateur](../produit/parcours/onboarding-restaurateur.md). Le parcours de vérification d'identité (KYC) est celui de Stripe, dans l'interface hébergée par Stripe : Surplasse ne collecte ni ne stocke aucun justificatif.
- Le frontend Commande intègre le **Payment Element** de Stripe, qui présente carte bancaire, Apple Pay et Google Pay dans un composant unique. Aucune donnée de carte ne transite par le backend Surplasse.
- Le backend crée les Payment Intents, associe chaque paiement au compte Express de l'établissement, prélève la commission de la plateforme à la source et laisse Stripe gérer les virements automatiques vers le compte bancaire de chaque restaurateur.
- La confirmation des paiements côté backend passe par les webhooks Stripe, avec vérification de signature et traitement idempotent (détail dans la page [Sécurité](../architecture/securite.md) et la page [Intégrations](../architecture/integrations.md)).
- Les points de contact entre l'API Surplasse et Stripe (création de session de paiement, statut d'une commande, réception des webhooks) sont spécifiés dans le contrat, comme tout le reste de l'API.

**PayPal n'est pas abandonné : il est repositionné.** Il sera ajouté plus tard comme moyen de paiement complémentaire proposé au client final, pas comme socle d'encaissement de la plateforme. Cette échéance relève de la [roadmap](../roadmap.md).

### Répartition des responsabilités

| Responsabilité | Portée par |
|---|---|
| Collecte et vérification des justificatifs d'identité des restaurateurs (KYC) | Stripe |
| Authentification forte du payeur (SCA, 3-D Secure) | Stripe |
| Stockage et traitement des données de carte | Stripe |
| Virements vers les comptes bancaires des restaurateurs | Stripe |
| Création des Payment Intents et calcul de la commission | Backend Surplasse |
| Rapprochement paiement et commande, passage en cuisine | Backend Surplasse |
| Réception et vérification des webhooks | Backend Surplasse |
| Support de premier niveau des restaurateurs sur le paiement | Surplasse |

### Ce qui reste à trancher

| Point ouvert | Où il sera traité |
|---|---|
| Politique de remboursement (qui déclenche, qui supporte les frais) | Page [Intégrations](../architecture/integrations.md) |
| Calendrier de reversement proposé aux restaurateurs | Modèle économique, puis page [Intégrations](../architecture/integrations.md) |
| Gestion du pourboire dans le parcours de paiement | Parcours [Commande côté client](../produit/parcours/commande-client.md) |

!!! info Ce que la décision fige
Cet ADR fige le fournisseur (Stripe), le modèle de comptes (Connect Express) et l'intégration frontend (Payment Element). L'[ADR-0017](adr-0017-charges-directes-stripe-connect.md) fixe ensuite les charges directes. Les points du tableau ci-dessus relèvent de la spécification détaillée, pas d'une remise en cause de ces décisions.
!!!

## Conséquences

### Positives

- **Le parcours de paiement mobile est au meilleur niveau du marché dès le MVP** : Apple Pay et Google Pay natifs, formulaire carte optimisé, SCA gérée par Stripe.
- **Zéro obligation réglementaire portée en propre** : KYC des restaurateurs, SCA, conformité des flux plateforme, tout est délégué à Stripe. Surplasse n'a pas besoin d'agrément.
- **Périmètre PCI minimal** : aucune donnée de carte dans les systèmes Surplasse, questionnaire SAQ A, le plus léger.
- **Reversements sans travail opérationnel** : virements automatiques de Stripe vers les comptes bancaires des restaurateurs, sans rapprochement manuel côté plateforme.
- **L'embarquement reste fluide** : le KYC est un écran hébergé par Stripe inséré dans le tunnel, pas un dossier papier à instruire par Surplasse.
- **Vélocité de développement** : le mode test de Stripe (cartes de test, webhooks simulés, comptes Express de test) permet de construire et vérifier toute la chaîne de paiement avant l'ouverture du compte de production.

### Négatives et dettes assumées

- **Les commissions Stripe s'ajoutent à la commission Surplasse** et doivent être intégrées au modèle économique dès sa construction : la marge de la plateforme se calcule après frais Stripe, pas avant. Les frais Connect (comptes actifs, virements) s'ajoutent aux frais par transaction.
- **Dépendance forte à un fournisseur unique** : une panne Stripe interrompt l'encaissement de tous les établissements, un changement tarifaire touche directement la marge. Dette assumée au MVP ; l'abstraction du paiement derrière le contrat limite le coût d'une éventuelle migration, sans le rendre faible pour autant.
- **Le compte Stripe de la plateforme doit être validé par Stripe** avant tout encaissement réel : activité décrite, site publié, justificatifs fournis. Cette validation est un préalable au lancement et doit apparaître comme jalon dans la [roadmap](../roadmap.md).
- **Un restaurateur peut être bloqué par le KYC Stripe** (justificatif refusé, compte suspendu) sans que Surplasse puisse débloquer la situation elle-même : le support devra savoir accompagner vers les parcours de résolution de Stripe.
- **Le vocabulaire Stripe entre dans le code** (Payment Intent, Connected Account, application fee) : la terminologie canonique de Surplasse reste celle du [glossaire](../glossaire.md), les termes Stripe restant cantonnés à la couche d'intégration.

### Critères de remise en cause

La décision sera réexaminée par un nouvel ADR si l'un de ces signaux apparaît :

- une évolution tarifaire de Stripe qui rend le modèle économique intenable sur le panier moyen de la restauration ;
- des refus ou suspensions de comptes Express récurrents sur le profil type des restaurateurs visés, que le support ne parvient pas à absorber ;
- un besoin structurel non couvert par Stripe (moyen de paiement local indispensable, contrainte d'encaissement spécifique à la restauration) ;
- une indisponibilité répétée qui affecte l'encaissement en service, mesurée par l'[observabilité](../operations/observabilite.md) de la plateforme.
