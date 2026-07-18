---
label: Personas
order: 20
icon: people
description: "Les cinq personas de référence de Surplasse et l'anti-persona qui délimite la cible."
---

# Personas

Cette page décrit les personnes pour lesquelles Surplasse est conçu. Cinq personas guident les choix de produit, un anti-persona délimite ce que Surplasse ne cherche pas à servir. Chaque persona est rattaché aux applications qu'il rencontre (Onboarding, Commande, Dashboard) et aux trois parcours détaillés : [l'embarquement restaurateur](parcours/onboarding-restaurateur.md), [la commande client](parcours/commande-client.md) et [le quotidien avec le Dashboard](parcours/dashboard-restaurateur.md).

!!! info Des personas fictifs, des situations réelles
Les prénoms, les établissements et les citations de cette page sont fictifs. Ils condensent des situations observées chez les restaurants indépendants ; ils ne décrivent aucune personne réelle. Les citations sont rédigées pour illustrer le ton de chaque persona, pas pour être exactes.
!!!

## Vue d'ensemble

| Persona | Rôle | Application principale | Parcours de référence |
|---|---|---|---|
| Marco | Restaurateur indépendant, bistrot de quartier | Dashboard | [Embarquement](parcours/onboarding-restaurateur.md) |
| Nadia | Gérante d'un établissement à emporter | Dashboard | [Commande client](parcours/commande-client.md) (à emporter) |
| Thomas | Client du midi pressé | Commande | [Commande client](parcours/commande-client.md) (sur place) |
| La tablée du soir | Groupe de clients attablés | Commande | [Commande client](parcours/commande-client.md) (sur place) |
| Karim | Serveur, équipe en salle | Dashboard | [Commande client](parcours/commande-client.md) (sur place) |
| L'anti-persona | Chaîne ou franchise avec POS intégré | Aucune | Hors cible |

## Marco, le restaurateur indépendant

### Contexte

Marco, 52 ans, tient un bistrot de quartier de 45 couverts avec sa compagne et deux salariés. Il est en cuisine du matin au soir, six jours sur sept. Sa carte change avec les saisons et vit sur une ardoise et un PDF imprimé. Il a un smartphone, une page sur les réseaux sociaux mise à jour de temps en temps, et pas de site web. Il a déjà été démarché par des plateformes de livraison et en garde un souvenir amer : commissions à deux chiffres, clients qui deviennent ceux de la plateforme, avis qu'il ne contrôle pas.

### Frustrations actuelles

- Aucune présence en ligne correcte : la fiche de son établissement sur les moteurs de recherche affiche des horaires faux et une photo de 2019.
- Les plateformes prennent une commission qu'il juge indécente et captent la relation client.
- Changer un prix sur la carte suppose de réimprimer, de raturer, de tout revérifier.
- Il n'a ni le temps ni l'envie de piloter un « projet informatique » : le dernier prestataire web lui a coûté cher pour un site jamais mis à jour.

### Objectifs

- Garder ses clients, ses prix, son identité : rester chez lui, même en ligne.
- Encaisser plus vite au moment du coup de feu, sans embaucher.
- Avoir une vitrine web présentable sans y consacrer ses rares heures libres.

### Ce que Surplasse change pour lui

L'embarquement part de ce que Marco possède déjà : le nom de son établissement et une photo de sa carte. L'application Onboarding génère son mini-site et sa carte numérique structurée ; si un espace pré-généré existe pour son établissement, il en prend possession par une revendication en quelques minutes. Le QR code posé sur les tables ouvre le mini-site sur le domaine de son établissement, pas sur une marketplace. Le Dashboard lui montre les commandes en temps réel et lui permet de changer un prix ou d'épuiser un produit en deux gestes. Le parcours complet est décrit dans [l'embarquement](parcours/onboarding-restaurateur.md).

### Risques d'adoption

- Méfiance de principe : il faut prouver très tôt que Surplasse n'est pas « encore une plateforme à commission ».
- Peur de la technique : la moindre étape qui ressemble à de la configuration peut le faire abandonner.
- Habitudes de salle : si son équipe rejette l'outil, il le rangera dans un tiroir.

> « Si je dois créer un compte, choisir un thème et remplir quarante champs, c'est mort. Moi j'ai une carte, une photo et dix minutes. » (citation fictive)

## Nadia, la gérante d'un établissement à emporter

### Contexte

Nadia, 38 ans, gère un food truck de cuisine libanaise installé près d'une zone de bureaux, avec un second emplacement le week-end. Entre 12 h et 14 h, tout se joue : la file d'attente fait sa réputation et son chiffre. Elle prépare seule avec un équipier, prend les commandes, encaisse et sert. Elle perd des clients qui renoncent en voyant la file, et du temps à répéter la même carte à voix haute.

### Frustrations actuelles

- La prise de commande à la volée crée des erreurs et des tensions quand la file s'allonge.
- Aucun moyen de lisser le pic : tout le monde arrive à 12 h 30.
- L'encaissement par carte, les tickets, la monnaie : chaque transaction lui coûte des secondes qu'elle n'a pas.
- Les solutions de « click and collect » qu'elle a regardées supposent un abonnement, un back-office complexe, parfois du matériel dédié.

### Objectifs

- Prendre des commandes anticipées pour étaler le flux du midi.
- Réduire la file au comptoir à un simple retrait.
- Annoncer un créneau de retrait fiable et le tenir.

### Ce que Surplasse change pour elle

Le mini-site de son établissement accepte des commandes à emporter payées en ligne avant l'arrivée du client. La commande arrive en temps réel dans le Dashboard, qui lui sert de file de préparation pendant le service : elle voit ce qui est payé, ce qui est prêt, ce qui est retiré. Le client reçoit l'information de retrait sans qu'elle ait à gérer un appel ou un message. Le détail est décrit dans le [parcours de la commande client](parcours/commande-client.md).

### Risques d'adoption

- Le Dashboard doit être utilisable d'une main, sur un téléphone posé près de la plancha, en plein soleil : sinon il ne sera pas ouvert.
- Une seule promesse de créneau non tenue à cause de l'outil et la confiance est perdue.
- La gestion fine des créneaux et de la capacité de production reste à trancher : sans elle, le risque est de sur-vendre le pic au lieu de le lisser.

> « Mon problème n'est pas de vendre plus, c'est de vendre les mêmes cent commandes sans que la file fasse fuir la cent-unième. » (citation fictive)

## Thomas, le client du midi pressé

### Contexte

Thomas, 29 ans, travaille en horaires contraints et dispose de 45 minutes pour déjeuner. Il choisit souvent son restaurant en fonction de la vitesse, pas seulement de l'envie. Il a déjà quitté une salle faute de voir un serveur arriver. Il n'installe pas d'application pour un déjeuner et se méfie des formulaires qui demandent un compte, un email et un mot de passe pour un plat du jour.

### Frustrations actuelles

- Attendre trois fois : pour la carte, pour commander, pour payer.
- Les QR codes qui ouvrent un PDF illisible ou un site qui exige une inscription.
- Ne pas savoir, avant de s'asseoir, si le service sera assez rapide pour son créneau.

### Objectifs

- Commander en moins de deux minutes, payer dans la foulée, partir sans attendre l'addition.
- Ne rien installer, ne créer aucun compte, ne laisser que le strict nécessaire.

### Ce que Surplasse change pour lui

Le scan du QR code à table ouvre directement la carte de l'établissement dans le navigateur : aucune application, aucun compte, conformément au choix d'authentification décrit dans la [stack de référence](../architecture/index.md). Thomas compose son panier, valide sa commande et paie par carte, Apple Pay ou Google Pay. La commande part en cuisine sans intermédiaire humain ; le paiement étant déjà réglé, il se lève quand il a terminé. Le déroulé complet est dans le [parcours de la commande client](parcours/commande-client.md).

### Risques d'adoption

- La première impression est décisive : un mini-site lent ou une carte mal structurée et Thomas repasse au comptoir.
- Si le personnel n'est pas au courant du dispositif (« ah, le QR code, il ne marche pas trop »), Thomas n'essaiera pas deux fois.
- Un parcours de paiement qui échoue au moment de payer est pire qu'une commande au serveur.

> « Je ne veux pas d'une appli de plus. Je veux la carte, un bouton payer, et mon plat. » (citation fictive)

## La tablée du soir

### Contexte

Quatre amis autour d'une table un vendredi soir. Le rythme est inversé par rapport au midi : on prend son temps, on commande en plusieurs fois, on rajoute une bouteille, un dessert, un dernier café. Le moment délicat arrive à la fin : l'addition commune, la calculette mentale, la personne qui avance pour tout le monde et court après les remboursements pendant une semaine.

### Frustrations actuelles

- Attraper le regard du serveur pour chaque commande supplémentaire, surtout quand la salle est pleine.
- L'addition unique en fin de repas : le partage se règle hors du restaurant, avec des applications tierces et des approximations.
- Les resservices de boissons qui n'arrivent pas parce que la demande s'est perdue.

### Objectifs

- Ajouter un produit à tout moment sans interrompre la conversation ni le service.
- Voir où en est la table : ce qui est commandé, ce qui est arrivé, ce que cela coûte déjà.
- Régler la soirée sans qu'une seule personne porte toute l'addition.

### Ce que Surplasse change pour elle

Le QR code de la table permet des commandes successives sur une même session de table : chaque salve part en temps réel vers le Dashboard sans mobiliser un serveur pour la prise de commande. La carte reste consultable pendant tout le repas, avec les produits épuisés à jour. Chaque convive peut payer sa part depuis son propre téléphone.

### Risques d'adoption

- Le repas du soir reste un moment social : si l'outil donne le sentiment de remplacer le contact humain, la table le rejettera. Surplasse prend la commande, le service reste humain.
- Une session de table mal gérée (mauvaise table, session qui expire en plein repas) casse la confiance du groupe entier.
- Le partage précis de l'addition (par produit, en parts égales, mixte) est un sujet identifié mais son périmètre exact dans le MVP reste à trancher ; il est suivi dans la [roadmap](../roadmap.md).

> « Le pire moment du restaurant, c'est la fin : qui a pris quoi, qui doit combien. Si on peut chacun payer son truc, c'est réglé. » (citation fictive)

## Karim, le serveur

### Contexte

Karim, 24 ans, est serveur dans le bistrot de Marco. Un service normal : trente couverts, deux mains, une mémoire saturée de « et aussi une carafe d'eau ». Il a connu des outils imposés d'en haut : une caisse tactile lente, un terminal de paiement capricieux. Son critère est simple : est-ce que l'outil lui enlève des allers-retours ou est-ce qu'il en ajoute.

### Frustrations actuelles

- Les allers-retours sans valeur : prendre la commande, l'apporter en cuisine, revenir pour l'addition, revenir pour le terminal.
- Les erreurs de saisie et les commandes oubliées dans le rush, qui retombent toujours sur la salle.
- Les outils pensés pour le gérant et subis par l'équipe, sans formation ni écoute.

### Objectifs

- Passer son temps sur ce qui compte : accueillir, conseiller, servir, désamorcer.
- Avoir une vue fiable de ce que chaque table a commandé, sans rien ressaisir.
- Ne pas être l'assistance technique du QR code auprès des clients.

### Ce que Surplasse change pour lui

Les commandes prises par les clients arrivent dans le Dashboard en temps réel, et le ticket cuisine part sur l'imprimante thermique quand l'établissement en est équipé (le choix du matériel d'impression fait l'objet d'un ADR dans [decisions](../decisions/index.md)). Karim ne saisit plus les commandes passées par QR code : il les voit, les suit et les sert. La prise de commande assistée par le serveur pour les clients qui préfèrent le contact humain, ainsi que l'existence d'un accès propre à l'équipe en salle distinct de celui du restaurateur, restent à trancher.

### Risques d'adoption

- Si le Dashboard sonne, clignote et réclame des validations en plein service, Karim le coupera.
- Un écart entre ce que le client a commandé et ce qui s'affiche détruit la confiance en une soirée.
- L'outil ne doit jamais donner aux clients le sentiment que le serveur est devenu optionnel : Karim est un utilisateur du produit, pas une variable d'ajustement.

> « Un bon outil, je ne le remarque pas. Le jour où je passe plus de temps sur l'écran que dans la salle, c'est que quelqu'un s'est trompé quelque part. » (citation fictive)

## Anti-persona : la chaîne avec POS intégré

### Contexte

Un réseau de trente restaurants sous enseigne commune, avec une direction des systèmes d'information, un POS central connecté au stock et à la comptabilité, des menus décidés au siège et une application de fidélité maison. L'enseigne cherche des intégrations profondes : synchronisation bidirectionnelle avec le POS, gestion multi-marques, SSO d'entreprise, contrats de niveau de service et interlocuteur technique dédié.

### Pourquoi c'est hors cible

- La proposition de valeur de Surplasse (créer un canal de commande sans projet informatique, depuis une photo de la carte) ne résout aucun problème de cette organisation : elle a déjà une équipe pour cela.
- Ses exigences (intégration POS bidirectionnelle, SSO, personnalisation contractuelle) tireraient le contrat et le backend vers une complexité qui dégraderait le produit pour les indépendants.
- Le modèle relationnel est incompatible : Surplasse s'adresse en direct au restaurateur, pas à une DSI via un cycle d'achat de dix-huit mois.
- Le multi-établissements existe (un restaurateur peut avoir plusieurs établissements), mais il est pensé pour le patron de deux ou trois adresses, pas pour un réseau piloté centralement.

!!! warning Un garde-fou de conception
Face à un choix de produit ou d'architecture, si une option ne se justifie que par les besoins de cet anti-persona, elle est écartée. La cible de Surplasse est l'indépendant sans équipe technique, et chaque page de cette documentation doit pouvoir le vérifier.
!!!

## Personas et applications

Le tableau suivant croise chaque persona avec les trois applications frontend décrites dans [l'architecture](../architecture/index.md).

| Persona | Onboarding | Commande | Dashboard |
|---|---|---|---|
| Marco | Embarquement, revendication de son espace | Contrôle sa carte publiée en se mettant à la place du client | Suivi des commandes, mise à jour des prix et des produits |
| Nadia | Embarquement rapide, activation de l'à emporter | Vitrine consultée par ses clients avant le pic du midi | File de préparation en temps réel pendant le service |
| Thomas | Aucun contact | Scan, carte, panier, paiement : tout son parcours | Aucun contact |
| La tablée du soir | Aucun contact | Commandes successives et paiement de chaque part | Aucun contact |
| Karim | Aucun contact | Point d'appui pour aider un client qui hésite | Vue de service : tables, commandes, tickets cuisine |
| Anti-persona (chaîne) | Hors cible | Hors cible | Hors cible |

Les parcours détaillés prolongent cette page : [l'embarquement](parcours/onboarding-restaurateur.md) pour Marco et Nadia, la [commande client](parcours/commande-client.md), sur place ou à emporter, pour Thomas, la tablée du soir, Karim et les clients de Nadia.
