---
label: Embarquement restaurateur
order: 10
icon: rocket
description: Le parcours d'embarquement du restaurateur, de la découverte de surplasse.com jusqu'au premier service en conditions réelles.
---

# Embarquement restaurateur

L'embarquement est le parcours par lequel un restaurateur crée son établissement sur Surplasse : de la découverte de la promesse « une photo suffit » jusqu'à la première commande encaissée en salle. C'est le parcours le plus critique du produit. S'il échoue, rien d'autre n'existe. Il est porté par l'application Onboarding (`surplasse.com`), s'appuie sur le backend pour l'extraction et la persistance, et débouche sur les deux autres applications : le mini-site servi par Commande et le pilotage dans le Dashboard.

Cette page décrit la cible de référence du tunnel, étape par étape. Le projet n'a pas encore de code applicatif : tout ce qui suit est une spécification, et les points restant à trancher sont signalés explicitement. Les fonctionnalités mobilisées à chaque étape sont détaillées dans [la page fonctionnalités](../fonctionnalites.md), et les intégrations externes (Stripe, API OpenAI) dans [la page intégrations](../../architecture/integrations.md).

## Vue d'ensemble du tunnel

Huit étapes, dont une seule vraiment lourde (l'activation des paiements). L'objectif de conception : que le restaurateur voie son mini-site généré en quelques minutes, avant tout engagement.

```
+----------------+    +----------------+    +----------------+    +----------------+
| 1. Découverte  |--->| 2. Création    |--->| 3. Extraction  |--->| 4. Prévisuali- |
|  surplasse.com |    |  nom + photos  |    |    IA          |    |    sation      |
+----------------+    +----------------+    +----------------+    +----------------+
                                                                          |
        Variante : revendication d'un espace                              |
        pré-généré (rejoint le tunnel ici) ---------------------------+   |
                                                                      v   v
+----------------+    +----------------+    +----------------+    +----------------+
| 8. Premier     |<---| 7. QR codes    |<---| 6. Paiements   |<---| 5. Relecture   |
|    service     |    |    (supports)  |    |    (Stripe)    |    |    corrections |
+----------------+    +----------------+    +----------------+    +----------------+
```

Les étapes 1 à 4 sont conçues pour être parcourues en une seule session, sans compte préalable ni carte bancaire. Les étapes 5 à 7 peuvent être reprises plus tard : l'établissement reste en brouillon tant que le restaurateur n'a pas activé son mini-site.

## Étape 1 : découverte

**Objectif** : convaincre le restaurateur d'essayer, en une promesse : « une photo suffit ».

**Actions du restaurateur** : il arrive sur `surplasse.com` (bouche-à-oreille, recherche, démarchage, ou courrier de revendication, voir la variante en fin de page). Il parcourt la promesse, des exemples de mini-sites, et clique sur « Créer mon établissement ».

**Ce que fait le système** : l'application Onboarding sert la vitrine produit : promesse, exemples de mini-sites d'établissements réels ou de démonstration, positionnement (pas une marketplace, le restaurant garde son identité et ses clients). Aucune inscription n'est demandée à ce stade.

**Erreurs possibles** : aucune erreur technique attendue. Le risque est l'abandon avant le clic : la vitrine doit rendre la promesse crédible sans jargon.

**Critère de succès** : clic sur « Créer mon établissement ».

## Étape 2 : création

**Objectif** : recueillir le strict nécessaire pour générer un mini-site : un nom, une photo de la carte, quelques images.

**Actions du restaurateur** :

- il saisit le nom de son établissement et son adresse email (l'authentification passe par magic link, aucun mot de passe) ;
- il photographie ou téléverse la photo de sa carte (plusieurs photos si la carte tient sur plusieurs pages) ;
- il ajoute quelques photos du lieu et des plats (optionnel mais recommandé, le mini-site sera plus convaincant).

**Ce que fait le système** : le backend crée l'établissement en brouillon, génère un slug provisoire à partir du nom, envoie le magic link, et contrôle chaque photo à la réception : format accepté, taille, netteté estimée. Un retour immédiat par photo évite de découvrir un problème après coup.

**Erreurs possibles** et traitement :

| Erreur | Traitement |
|---|---|
| Photo floue, sombre ou en contre-jour | Refus immédiat avec aperçu et conseils de reprise (lumière, cadrage, à plat) |
| Carte manuscrite ou typographie fantaisiste | Acceptée, mais un avertissement prévient que l'extraction demandera plus de relecture |
| Carte sur plusieurs pages, photo partielle | L'interface propose d'ajouter des photos supplémentaires avant de lancer l'extraction |
| Email invalide ou magic link non reçu | Renvoi possible, vérification du domaine, saisie corrigeable sans perdre les photos |

**Critère de succès** : au moins une photo de carte acceptée, extraction lancée.

## Étape 3 : extraction IA

**Objectif** : transformer la photo de la carte en carte numérique structurée : catégories, produits, prix, options.

**Actions du restaurateur** : aucune. Il attend devant un écran d'attente.

**Ce que fait le système** : le backend appelle l'API OpenAI (vision) pour lire la photo et en extraire une structure : catégories, produits avec descriptions, prix, options détectées (tailles, suppléments explicites sur la carte). Chaque valeur extraite porte un indice de confiance ; les valeurs douteuses sont marquées « à vérifier » pour l'étape de relecture. En parallèle, une harmonisation optionnelle des photos du lieu et des plats (recadrage, tonalité cohérente) peut être proposée. Les détails de l'intégration sont décrits dans [la page intégrations](../../architecture/integrations.md).

Le délai perçu est un enjeu à part entière. L'écran d'attente affiche des étapes lisibles (« lecture de la carte », « structuration des produits », « génération du mini-site ») plutôt qu'une barre muette. La cible de durée de bout en bout reste à trancher (ordre de grandeur visé : moins de deux minutes) ; au-delà d'un seuil, le tunnel doit proposer de continuer par email (« nous vous prévenons quand c'est prêt »).

**Erreurs possibles** et traitement :

| Erreur | Traitement |
|---|---|
| Extraction partielle (prix illisibles, colonne coupée) | La carte est produite quand même ; les éléments douteux sont marqués « à vérifier » |
| Carte manuscrite mal reconnue | Même mécanisme, avec un taux de marquage plus élevé ; proposition de reprendre la photo |
| Échec complet de l'extraction | Proposition de reprendre la photo, ou bascule en saisie manuelle assistée (catégories pré-remplies) |
| Panne ou lenteur de l'API IA | File d'attente côté backend, poursuite par email, jamais de perte des photos téléversées |

**Critère de succès** : une carte structurée existe, même partielle, et le restaurateur arrive à la prévisualisation.

## Étape 4 : prévisualisation

**Objectif** : produire l'effet déclencheur : le restaurateur voit son mini-site, avec sa carte, avant tout engagement.

**Actions du restaurateur** : il parcourt la prévisualisation comme le ferait un client : page d'accueil du mini-site, carte par catégories, fiches produit. Il peut basculer entre le rendu mini-site et la vue structurée de la carte.

**Ce que fait le système** : l'application Onboarding embarque un rendu de l'application Commande en mode prévisualisation, sur le slug provisoire. Le mini-site n'est pas public à ce stade : rien n'est indexé, rien n'est commandable. Si l'harmonisation des photos a été proposée, la prévisualisation permet de comparer avant et après et de choisir.

**Erreurs possibles** : le principal échec est un rendu décevant (photos absentes ou hétérogènes, carte trop marquée « à vérifier »). Le traitement est éditorial autant que technique : proposer l'ajout de photos, l'harmonisation, et enchaîner sans friction sur la relecture plutôt que de laisser le restaurateur sur une mauvaise impression.

**Critère de succès** : le restaurateur passe volontairement à la relecture (il n'abandonne pas devant le rendu).

## Étape 5 : relecture et corrections

**Objectif** : faire de la carte extraite une carte exacte, assumée par le restaurateur.

**Actions du restaurateur** :

- il corrige les prix erronés et les libellés mal lus ;
- il ajoute les produits manquants et supprime ceux qui n'existent plus ;
- il complète les options que la photo ne pouvait pas révéler (cuissons, suppléments, tailles) ;
- il ordonne les catégories si l'ordre extrait ne correspond pas à sa carte.

**Ce que fait le système** : l'interface d'édition met en avant les éléments marqués « à vérifier » et sauvegarde en continu. La carte reste en brouillon jusqu'à validation explicite. Si le restaurateur relance une extraction avec une meilleure photo, la stratégie de fusion avec les corrections manuelles déjà faites reste à trancher (règle envisagée : une correction manuelle n'est jamais écrasée par une extraction).

**Erreurs possibles** et traitement :

| Erreur | Traitement |
|---|---|
| Trop d'erreurs, la relecture décourage | Relance d'extraction depuis une nouvelle photo, sans perdre les corrections déjà faites |
| Produit sans prix validé | Blocage à la validation : un produit commandable doit avoir un prix |
| Session interrompue | Le brouillon est repris à l'identique via le magic link, sur n'importe quel appareil |

**Critère de succès** : carte validée par le restaurateur, plus aucun élément « à vérifier » bloquant.

## Étape 6 : activation des paiements

**Objectif** : permettre à l'établissement d'encaisser, via un compte Stripe Connect.

**Actions du restaurateur** : il suit l'embarquement Stripe Connect : identité du responsable (pièce d'identité), informations légales de l'établissement (SIREN), RIB pour les virements. Ces informations sont saisies dans le parcours hébergé par Stripe, jamais dans Surplasse.

**Ce que fait le système** : le backend crée le compte Stripe Connect, redirige vers le parcours d'embarquement Stripe, puis suit l'avancement via les webhooks Stripe (compte en cours de vérification, pièces manquantes, encaissement activé). Chaque changement d'état est notifié par email, et le tunnel se reprend exactement là où il s'était arrêté. Le détail de l'intégration est dans [la page intégrations](../../architecture/integrations.md).

!!! info Pourquoi c'est l'étape la plus lourde, et comment la doc l'assume
La vérification d'identité et le RIB ne sont pas une exigence de Surplasse : ce sont des obligations réglementaires (connaissance client, lutte anti-blanchiment) portées par Stripe pour tout encaissement pour compte de tiers. Le tunnel l'assume plutôt que de le cacher : il annonce la durée (5 à 10 minutes), liste les pièces à préparer avant de commencer, et permet de différer l'étape. Tout le reste du tunnel est conçu pour être léger précisément parce que celle-ci ne peut pas l'être.
!!!

L'étape peut être différée : le restaurateur peut préparer ses QR codes et son mini-site sans elle. Mais l'établissement ne peut pas encaisser tant que Stripe n'a pas activé l'encaissement.

**Erreurs possibles** et traitement :

| Erreur | Traitement |
|---|---|
| Pièce d'identité refusée par Stripe | Notification email avec le motif remonté par webhook, lien direct pour soumettre à nouveau |
| Vérification en attente prolongée | État visible dans le tunnel et le Dashboard, relances email, aucune action bloquée en dehors de l'encaissement |
| Abandon en cours d'embarquement Stripe | Reprise au même point du parcours Stripe, relance email après un délai (à définir) |
| RIB invalide | Erreur remontée par Stripe, correction dans le parcours hébergé |

**Critère de succès** : le compte Stripe Connect est activé pour l'encaissement.

## Étape 7 : choix et réception des QR codes

**Objectif** : mettre le canal de commande physiquement sur les tables.

**Actions du restaurateur** : il indique son nombre de tables, choisit ses supports et son adresse de livraison. Il peut aussi télécharger immédiatement un PDF à imprimer lui-même, pour ne pas attendre la livraison.

**Ce que fait le système** : le backend génère les QR codes de l'établissement. Un QR code par table (permettant d'associer la commande à la table) est la cible de référence ; un QR code générique unique reste possible pour les usages à emporter. La commande de supports part en fabrication et une notification est envoyée à l'expédition.

| Support | Contenu | Prix |
|---|---|---|
| Stickers | Dotation de départ, un par table | Gratuit |
| Sous-verres | Dotation de départ | Gratuit |
| Chevalets, plaques, supports premium | Sur commande | Payant, tarifs à trancher |
| PDF à imprimer | Généré immédiatement | Gratuit |

**Erreurs possibles** et traitement :

| Erreur | Traitement |
|---|---|
| Adresse de livraison erronée | Modifiable tant que la commande n'est pas expédiée |
| Délai de fabrication ou de livraison | Le PDF imprimable couvre l'attente : le restaurateur peut ouvrir sans les supports définitifs |
| Nombre de tables qui change | Ajout de QR codes de table à tout moment depuis le Dashboard |

**Critère de succès** : des QR codes fonctionnels sont en place sur les tables (imprimés ou livrés).

## Étape 8 : premier service

**Objectif** : la première commande réelle, payée et servie, sans accroc.

**Actions du restaurateur** : avant le service, il passe lui-même une commande de test en scannant un QR code de sa salle, pour vérifier la carte, le paiement et la réception côté Dashboard. Il briefe son équipe (où arrivent les commandes, comment les marquer prêtes). Puis il ouvre son premier service en conditions réelles, le Dashboard affiché en cuisine ou au comptoir.

**Ce que fait le système** : les commandes arrivent en temps réel dans le Dashboard (SSE). La toute première commande réelle est mise en avant (c'est le moment fondateur de la relation). Un guide de premier service, court, accompagne cette étape : checklist de test, réflexes en cas de client bloqué.

**Erreurs possibles** et traitement :

| Erreur | Traitement |
|---|---|
| Équipe non briefée, commandes non vues | Alerte dans le Dashboard sur commande non acquittée après un délai, guide de premier service |
| Client bloqué au paiement | La carte reste consultable ; le restaurateur prend la commande à la voix, l'incident est visible dans le Dashboard |
| QR code d'une mauvaise table | Réassignation du QR code depuis le Dashboard |

**Critère de succès** : première commande réelle payée, préparée et servie. C'est la fin de l'embarquement et le début de la vie courante, décrite dans [la page fonctionnalités](../fonctionnalites.md).

## Variante : revendication d'un espace pré-généré

Surplasse pré-génère des espaces pour des établissements identifiés en ligne, à partir de données publiques enrichies par IA (carte trouvée en ligne, photos publiques, horaires). Un espace est un établissement en attente de son restaurateur. La revendication est le parcours par lequel il en prend possession.

**Déroulé** :

1. **Recherche** : sur `surplasse.com`, le restaurateur cherche son établissement (nom, ville) et trouve son espace pré-généré, avec un aperçu du mini-site déjà construit.
2. **Vérification des informations** : il constate ce que Surplasse a déjà assemblé : carte pré-extraite, photos, coordonnées. L'espace affiche clairement qu'il est pré-généré et non revendiqué.
3. **Prise de possession** : il prouve son lien avec l'établissement. La méthode de vérification reste à trancher (candidates : email professionnel rattaché à l'établissement, appel au numéro public de l'établissement, code envoyé par courrier postal). Une fois vérifié, l'espace devient son établissement et l'espace public cesse d'exister en tant que tel.
4. **Reprise du tunnel** : il entre dans le tunnel standard directement à l'étape 5 (relecture et corrections), la carte étant déjà extraite. Les étapes 6 à 8 sont identiques.

**Différences avec le tunnel standard** :

| Aspect | Tunnel standard | Revendication |
|---|---|---|
| Point d'entrée | « Créer mon établissement » | Recherche de son établissement |
| Photo de la carte | Fournie par le restaurateur | Déjà trouvée en ligne, remplaçable par une photo plus récente |
| Étapes 2 et 3 | Parcourues | Sautées (déjà faites en pré-génération) |
| Qualité initiale de la carte | Dépend de la photo fournie | Dépend des sources publiques, souvent plus datées : relecture d'autant plus importante |
| Vérification d'identité de l'établissement | Implicite (il fournit tout) | Explicite (preuve de lien avec l'établissement) |
| Effet recherché | « C'est rapide » | « C'est déjà prêt » |

!!! warning Une carte pré-générée peut être périmée
Les sources publiques datent parfois de plusieurs saisons. Le parcours de revendication doit pousser fortement la relecture des prix, et proposer d'emblée de reprendre une photo de la carte actuelle si l'écart est trop grand.
!!!

## Métriques du tunnel

Le tunnel est instrumenté étape par étape. Les cibles chiffrées restent à trancher ; les métriques à suivre, elles, sont fixées ici.

| Métrique | Définition |
|---|---|
| Taux de complétion par étape | Part des restaurateurs entrés dans une étape qui la terminent, pour chacune des huit étapes |
| Taux d'abandon à l'étape Stripe | Suivi séparément : c'est l'étape la plus lourde et la principale perte attendue |
| Durée de l'extraction | Temps entre le lancement de l'extraction et la carte structurée, perçu et réel |
| Taux de correction en relecture | Part des produits édités à l'étape 5 : proxy direct de la qualité de l'extraction |
| Temps découverte vers mini-site | Temps entre l'arrivée sur `surplasse.com` et la prévisualisation (étapes 1 à 4) |
| Temps jusqu'à la première commande | Temps entre la création de l'établissement et la première commande réelle payée : la métrique reine du tunnel |
| Taux de revendication | Part des espaces pré-générés effectivement revendiqués |

Ces métriques alimentent le pilotage produit décrit dans [la page fonctionnalités](../fonctionnalites.md) (volet métriques du Dashboard) et s'appuient sur l'instrumentation décrite dans [la page intégrations](../../architecture/integrations.md).
