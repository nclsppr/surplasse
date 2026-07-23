---
label: Vision
order: 10
icon: goal
description: La promesse de Surplasse, le problème qu'elle attaque, la thèse produit et les piliers qui guident chaque priorité.
---

# Vision

Cette page est le manifeste produit de Surplasse. Elle est la seule de la documentation à assumer un ton produit : partout ailleurs, le ton reste technique et sobre. Elle restructure le texte fondateur écrit pour la future homepage (reproduit intégralement en fin de page) et sert de référence à toutes les autres pages : quand une décision produit ou technique hésite entre deux options, c'est ici qu'on vérifie laquelle sert la vision.

## La promesse : « Le circuit court de la commande »

En alimentation, le circuit court supprime les intermédiaires entre le producteur et le consommateur. Surplasse applique la même idée à la commande en restauration : le chemin le plus court possible entre un client attablé et la cuisine de l'établissement, sans plateforme, sans agence, sans ressaisie.

Concrètement, la promesse se décline pour chacun :

| Pour | Ce que la promesse signifie |
|---|---|
| Le client | Il scanne un QR code à table, consulte la carte, commande et paie depuis son téléphone. Aucune application à télécharger, aucun compte à créer. |
| Le restaurateur | Chaque commande arrive en temps réel dans le Dashboard, déjà payée, avec la table, les produits et les options. Moins d'allers-retours, moins d'erreurs. |
| La relation | Aucun intermédiaire ne capte la marge, les données ou la relation client. Le canal de vente appartient à l'établissement. |

Le contraste avec le circuit habituel tient en un schéma :

```
Circuit long (marketplace) :

  Client --> appli de la plateforme --> liste de concurrents --> Restaurant
             (marque, commission,       (visibilité achetée,
              données clients)           client anonymisé)

Circuit court (Surplasse) :

  Client --> QR code --> mini-site de l'établissement --> Restaurant
```

Le QR code n'est pas le produit. C'est la porte d'entrée d'une expérience plus directe, et tout ce qui se trouve derrière (mini-site, carte numérique, paiement, temps réel) existe pour raccourcir ce circuit, jamais pour s'y insérer.

## Le problème

### La dépendance aux intermédiaires

Un restaurant indépendant qui veut recevoir des commandes en ligne a aujourd'hui deux voies, toutes deux coûteuses.

La première, la marketplace : l'établissement devient une fiche parmi des centaines de concurrents, sur une plateforme qui impose sa marque, prélève une commission et garde les données clients. Le restaurant gagne des commandes mais perd sa relation client : il ne sait pas qui commande, ne peut pas fidéliser, et reste soumis aux règles de classement et de tarification de la plateforme.

La seconde, le projet informatique : une agence ou un développeur construit un site sur mesure. C'est long, cher, et le résultat est rarement un vrai canal de commande : le plus souvent une vitrine qu'il faut ensuite maintenir, avec une carte qui se périme dès le premier changement de prix.

### La friction du papier et les erreurs de service

Sur place, la carte papier et la prise de commande manuelle produisent une friction quotidienne :

| Friction | Conséquence |
|---|---|
| La carte doit être recopiée pour toute présence en ligne | Elle est rarement à jour, les prix divergent entre supports |
| Le client attend qu'on vienne prendre sa commande | Attente en salle, tables qui tournent moins vite |
| La commande transite oralement ou sur un carnet | Erreurs entre la table et la cuisine, options oubliées |
| L'encaissement est une étape séparée en fin de repas | Allers-retours supplémentaires pour l'équipe, additions à réconcilier |

Aucun de ces problèmes n'exige une technologie spectaculaire. Ils exigent un canal simple, fiable et qui appartient au restaurant.

## La thèse produit

!!! info La phrase qui résume tout
Il ne devrait y avoir personne entre un restaurant et ses clients.
!!!

Les restaurants indépendants ne devraient pas avoir besoin d'une agence, d'un développeur ou d'une grande marketplace pour recevoir des commandes en ligne. Ils devraient pouvoir ouvrir leur propre canal de vente aussi simplement qu'ils ouvrent leur porte chaque matin.

Cette thèse a une conséquence directe sur la forme du produit : Surplasse ne se place jamais entre l'établissement et ses clients. Le mini-site porte l'identité du restaurant, pas celle de Surplasse. Les clients commandent auprès de l'établissement, pas auprès d'une plateforme. Les données de la relation client servent le restaurateur, pas un intermédiaire.

Elle a aussi une conséquence sur la barrière d'entrée : si ouvrir le canal demande un projet, la thèse échoue. D'où l'exigence fondatrice de l'embarquement : une photo de la carte suffit pour commencer.

## Les piliers du produit

Cinq piliers découlent de la thèse. Toute fonctionnalité doit se rattacher à au moins l'un d'eux ; une fonctionnalité qui n'en sert aucun est hors sujet.

### 1. L'embarquement en quelques minutes, à partir d'une photo

Le restaurateur envoie ce qu'il possède déjà : le nom de l'établissement, une photo de sa carte, quelques images de la salle et des plats. Surplasse reconnaît les produits, structure les catégories, identifie les prix et génère le mini-site et la carte numérique. Pas de site à concevoir, pas de menu à recopier, pas de compétences techniques nécessaires.

Le même pilier couvre la revendication : Surplasse peut pré-générer l'espace d'un établissement identifié en ligne à partir de ses informations publiques. Le restaurateur retrouve son restaurant déjà présenté, vérifie, complète et revendique son espace au lieu de partir d'une page vide.

### 2. L'identité du restaurant préservée

L'univers visuel de l'établissement est conservé : ses couleurs, son ambiance, sa cuisine, sa personnalité. Les photos peuvent être harmonisées et mises en valeur, mais restent fidèles à ce qui est réellement servi. Le mini-site est celui du restaurant, sur son propre sous-domaine, avec ses propres prix : jamais une fiche standardisée dans le gabarit d'une plateforme.

### 3. La propriété de la relation client

Les clients commandent directement auprès de l'établissement. Le restaurateur garde la maîtrise de ses commandes et construit sa propre relation client : avec leur consentement, les clients peuvent recevoir ses actualités, ses offres, rejoindre son programme de fidélité. Une commande ne reste pas une transaction anonyme ; elle peut devenir une prochaine visite, puis une habitude, puis une relation durable. Les avis et le pourboire numérique prolongent cette relation au bénéfice du restaurant, pas d'un intermédiaire.

### 4. La discrétion de la technologie

La technologie reste invisible pour le client (un scan, une carte, un paiement) et légère pour l'équipe : les commandes Surplasse arrivent dans les vues Salle et Cuisine sur une tablette ou un téléphone, et une petite imprimante thermique peut sortir les tickets pour les établissements qui travaillent au papier. Le canal coexiste avec la caisse en place. Le service devient plus fluide sans que la technologie se voie.

### 5. Sur place et à emporter, un seul canal

Le même canal sert plusieurs usages : commander depuis sa table, préparer une commande à emporter, ou retrouver l'établissement depuis son propre lien. Le restaurateur gère ses produits, ses disponibilités, ses horaires et ses commandes depuis une seule interface. Un menu, un site, un système de paiement, un canal de vente qui lui appartient.

## Ce que Surplasse n'est pas

Assumer une vision, c'est aussi assumer des limites. Trois refus structurent le périmètre :

| Surplasse n'est pas | Pourquoi | Ce que Surplasse fait à la place |
|---|---|---|
| Une marketplace | Placer les restaurants dans une liste concurrentielle contredit la thèse : ce serait redevenir l'intermédiaire | Un canal en propre par établissement, sur son sous-domaine, avec son identité et ses prix |
| Un POS complet | La caisse, les stocks, la comptabilité, les plannings sont des métiers à part entière, déjà bien servis | Le canal prépayé de commande et de paiement client ; la coexistence avec la caisse en place, une intégration n'étant étudiée qu'après preuve d'un blocage récurrent |
| Une agence web | Le sur-mesure facturé au projet est précisément la barrière d'entrée à supprimer | Une génération automatique à partir d'une photo, personnalisée par l'identité du restaurant, sans projet ni devis |

Deux limites supplémentaires sont assumées à ce stade :

- **Pas de livraison.** Le périmètre initial couvre le sur place et l'à emporter. La livraison impose une logistique (livreurs, zones, suivi) qui ramènerait des intermédiaires dans le circuit ; son opportunité reste à trancher.
- **Pas d'annuaire public.** Les espaces pré-générés existent pour être revendiqués par leur restaurateur, pas pour constituer un catalogue consultable qui ferait de Surplasse une marketplace de fait.

!!! warning Une ligne à tenir
La tentation naturelle d'un produit multi-établissements est de devenir une plateforme de découverte (« trouvez un restaurant près de chez vous »). Ce serait franchir la ligne : toute proposition allant dans ce sens doit être confrontée à cette page avant d'entrer dans la [roadmap](../roadmap.md).
!!!

## Le texte fondateur

Le texte ci-dessous a été écrit par Nicolas pour la future homepage. Il alimentera le frontend Onboarding et fait foi pour le ton et les formulations publiques du produit. Il est reproduit fidèlement ; les libellés en gras sont les boutons d'appel à l'action prévus.

> **Surplasse**
>
> **Le circuit court de la commande.**
>
> **Vos commandes. Vos clients. Votre restaurant.**
>
> Surplasse permet aux restaurants de créer leur propre canal de commande directe, simplement, rapidement et sans projet informatique.
>
> À partir du nom de l'établissement, d'une photo du menu et de quelques images du restaurant, Surplasse génère une expérience complète, prête à être utilisée : un mini-site élégant, une carte numérique structurée, des photos de plats mises en valeur, un système de commande et des paiements intégrés.
>
> Le restaurateur n'a pas à construire un site, recopier toute sa carte ou organiser une séance photo professionnelle.
>
> Il envoie ce qu'il possède déjà.
>
> Surplasse s'occupe du reste.
>
> **Créer mon restaurant**

> **Une photo du menu suffit pour commencer.**
>
> Le restaurateur photographie sa carte, sa salle et quelques-uns de ses plats.
>
> Surplasse reconnaît les produits, structure les catégories, identifie les prix et prépare automatiquement un menu numérique clair, moderne et agréable à parcourir.
>
> Les photos peuvent être harmonisées et améliorées afin de présenter les plats sous leur meilleur jour, tout en restant fidèles à ce qui est réellement servi.
>
> L'univers visuel du restaurant est conservé : ses couleurs, son ambiance, sa cuisine et sa personnalité.
>
> En quelques minutes, l'établissement dispose de sa propre vitrine et peut commencer à recevoir des commandes.
>
> Pas de site à concevoir.
>
> Pas de menu à recopier.
>
> Pas de compétences techniques nécessaires.
>
> **Essayer avec une photo**

> **Votre restaurant est peut-être déjà prêt.**
>
> Surplasse peut également identifier les restaurants présents en ligne et préparer une première version de leur espace à partir des informations publiques disponibles.
>
> Le restaurateur retrouve son établissement, vérifie les informations, complète éventuellement quelques photos et revendique son espace.
>
> Au lieu de commencer devant une page vide, il découvre un restaurant déjà présenté, déjà structuré et presque prêt à vendre.
>
> Il ne reste plus qu'à l'activer.
>
> **Voir mon restaurant sur Surplasse**

> **Scanner. Choisir. Commander. C'est servi.**
>
> Dans le restaurant, le client scanne le QR code installé sur sa table, sur un sticker, un sous-verre ou un support plus premium.
>
> Aucune application à télécharger.
>
> Aucun compte à créer.
>
> Le menu s'ouvre immédiatement sur son téléphone. Le client consulte les plats, sélectionne ses options, ajoute ses boissons et commande à son rythme.
>
> Il règle directement avec Apple Pay, Google Pay, PayPal ou sa carte bancaire.
>
> La commande est payée, confirmée et immédiatement transmise au restaurant.
>
> Moins d'attente pour le client.
>
> Moins d'allers-retours pour l'équipe.
>
> Moins d'erreurs entre la table et la cuisine.

> **Le chemin le plus court jusqu'à la cuisine.**
>
> Chaque commande arrive en temps réel sur une tablette, un téléphone ou l'interface du restaurant.
>
> L'équipe voit immédiatement ce qui a été commandé, pour quelle table, avec quelles options et si le paiement a bien été effectué.
>
> Le restaurant peut accepter la commande, suivre sa préparation et informer le client de son avancement.
>
> Pour les établissements qui préfèrent travailler avec des tickets physiques, Surplasse propose également une petite imprimante capable d'imprimer automatiquement les nouvelles commandes au comptoir, au bar ou en cuisine.
>
> La technologie reste discrète.
>
> Le service, lui, devient plus fluide.

> **Vos clients, enfin à vous.**
>
> Surplasse n'est pas une marketplace.
>
> Le restaurant n'est pas placé dans une liste, à côté de centaines de concurrents. Il conserve sa propre identité, ses propres prix et sa propre expérience.
>
> Les clients commandent directement auprès de l'établissement.
>
> Le restaurant garde la maîtrise de ses commandes et construit sa propre relation client.
>
> Avec leur consentement, les clients peuvent recevoir les actualités du restaurant, découvrir ses nouvelles cartes, profiter d'offres ou rejoindre son programme de fidélité.
>
> Une commande ne reste plus une simple transaction anonyme.
>
> Elle peut devenir une prochaine visite.
>
> Puis une habitude.
>
> Puis une relation durable.

> **Chaque commande renforce votre restaurant.**
>
> Après leur expérience, les clients peuvent être invités à partager leur avis.
>
> Les retours permettent au restaurateur de mieux comprendre ce qui fonctionne et d'améliorer son service. Les clients les plus satisfaits peuvent être encouragés à publier leur avis en ligne afin d'aider le restaurant à gagner en visibilité.
>
> Surplasse permet également de proposer simplement un pourboire numérique, au moment opportun et sans rendre l'expérience inconfortable.
>
> Chaque étape est conçue pour prolonger naturellement la relation entre le restaurant et son client.
>
> Pas celle d'un intermédiaire.

> **Sur place. Ou à emporter.**
>
> Le même canal peut servir plusieurs usages.
>
> Les clients peuvent commander depuis leur table, préparer une commande à emporter ou retrouver directement le restaurant depuis son propre lien.
>
> Le restaurateur gère ses produits, ses disponibilités, ses horaires et ses commandes depuis une seule interface.
>
> Un menu.
>
> Un site.
>
> Un système de paiement.
>
> Un canal de vente qui lui appartient.

> **Des QR codes prêts à prendre place.**
>
> Pour faciliter le lancement, Surplasse fournit gratuitement les premiers stickers ou sous-verres à disposer dans le restaurant.
>
> Le restaurateur peut ainsi tester le service sans devoir acheter du matériel ou concevoir lui-même ses supports.
>
> Pour les établissements qui souhaitent une présentation plus élégante, des supports premium peuvent être proposés : chevalets, plaques, socles ou éléments en plastique faciles à déplacer et à nettoyer.
>
> Le QR code n'est pas le produit.
>
> C'est simplement la porte d'entrée vers une expérience plus directe.

> **Il ne devrait y avoir personne entre un restaurant et ses clients.**
>
> Les restaurants indépendants ne devraient pas avoir besoin d'une agence, d'un développeur ou d'une grande marketplace pour recevoir des commandes en ligne.
>
> Ils devraient pouvoir ouvrir leur propre canal de vente aussi simplement qu'ils ouvrent leur porte chaque matin.
>
> Surplasse leur donne les outils pour présenter leur cuisine, accepter les commandes, recevoir les paiements et développer leur clientèle.
>
> Sans perdre leur identité.
>
> Sans abandonner leur relation client.
>
> Sans devenir une simple fiche sur la plateforme de quelqu'un d'autre.

> **Votre restaurant mérite son propre canal de vente.**
>
> Envoyez une photo de votre menu.
>
> Surplasse prépare le reste.
>
> **Créer gratuitement mon restaurant**

!!! info Deux écarts entre le texte et la cible technique
Le texte fondateur cite PayPal parmi les moyens de paiement : la cible de référence est Stripe (CB, Apple Pay, Google Pay), PayPal figurant en [roadmap](../roadmap.md). Il évoque aussi l'imprimante à tickets : le choix du matériel et du protocole d'impression reste à trancher dans un ADR. Le texte reste valable comme ambition ; la documentation technique fait foi pour l'état de la cible.
!!!

## Comment cette vision guide les priorités

Les piliers ne sont pas décoratifs : ils ordonnent la construction du produit. Chaque pilier se traduit en fonctionnalités concrètes, détaillées dans les [fonctionnalités](fonctionnalites.md), et en jalons dans la [roadmap](../roadmap.md) :

| Pilier | Traduction produit | Application porteuse |
|---|---|---|
| Embarquement en quelques minutes | Extraction de la carte par IA depuis une photo, espaces pré-générés, revendication | Onboarding |
| Identité préservée | Mini-site par établissement sur son sous-domaine, personnalisation visuelle | Commande |
| Propriété de la relation client | Commande et paiement en direct, consentement, avis, pourboire, fidélité | Commande, Dashboard |
| Technologie discrète | Temps réel dans le Dashboard, tickets imprimés optionnels, aucun matériel imposé | Dashboard |
| Un seul canal | Sur place et à emporter dans le même mini-site, gestion unifiée de la carte | Commande, Dashboard |

L'ordre des priorités découle mécaniquement de la thèse : d'abord rendre l'embarquement réel (sans lui, rien n'existe), ensuite rendre la commande irréprochable côté client (c'est elle qui fait vivre la promesse à table), enfin enrichir le Dashboard (temps réel, puis métriques, puis relation client). Les [personas](personas.md) décrivent pour qui ces priorités sont pensées, et le [glossaire](../glossaire.md) fixe les termes employés dans toute la documentation.

Quand deux fonctionnalités se disputent une place dans la roadmap, la question à poser est toujours la même : laquelle raccourcit le plus le circuit entre le restaurant et ses clients ?
