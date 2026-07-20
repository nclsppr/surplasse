---
label: Dashboard restaurateur
order: 30
icon: graph
description: Le quotidien du restaurateur avec le Dashboard, du flux de commandes en plein service à l'analyse des chiffres, en passant par la gestion de la carte.
---

# Parcours : le quotidien avec le Dashboard

Le Dashboard (`dashboard.surplasse.com`) est l'application de travail du restaurateur. Une fois l'[embarquement](onboarding-restaurateur.md) terminé, c'est là que tout se passe : les commandes arrivent, la carte se gère, les chiffres se lisent. Cette page décrit le parcours de référence, structuré en trois temps qui suivent le rythme réel d'une journée de restauration.

| Temps | Moment de la journée | Activités |
|---|---|---|
| **Pendant le service** | Coups de feu du midi et du soir | Recevoir, accepter et suivre les commandes, gérer les ruptures |
| **Entre les services** | Matinée, après-midi, fermeture | Ajuster la carte, gérer QR codes et tables, répondre aux avis |
| **En analyse** | À tout moment, souvent en fin de semaine | Lire les métriques du service en cours et l'historique |

Le restaurateur se connecte par magic link envoyé par email : pas de mot de passe à retenir. La session reste ouverte sur ses appareils habituels.

## Pendant le service : le flux de commandes

### La commande arrive

Quand un client valide et paie une commande depuis le mini-site (voir le [parcours client](commande-client.md)), elle apparaît instantanément dans le flux du Dashboard. Le transport temps réel repose sur SSE, décrit dans la page [backend](../../architecture/backend.md).

Chaque nouvelle commande déclenche une alerte sonore et une alerte visuelle (la carte de commande pulse en tête de liste). L'alerte sonore se répète tant que la commande n'est pas acceptée, avec un réglage de volume et un mode silencieux dans les préférences de l'établissement.

La carte de commande affiche tout ce qu'il faut pour décider d'un coup d'œil :

| Information | Détail |
|---|---|
| Numéro de commande | Court, prononçable en salle (ex. « la 47 ») |
| Table ou mode | Numéro de table pour le sur place, mention « à emporter » sinon |
| Contenu | Produits avec quantités, options choisies, remarques du client |
| Statut de paiement | Payée en ligne (cas nominal) avec le montant TTC |
| Horodatage | Heure de validation, et minuteur du temps écoulé depuis |

### Le cycle de vie d'une commande

Le restaurateur fait avancer chaque commande d'un geste (un bouton par transition, pensé pour des mains pressées et un écran tactile) :

```
   accepter        démarrer      fin de prépa.
 +----------+ --> +---------+ --> +--------------+ --> +--------+ --> +----------------+
 | Nouvelle |     | Acceptée|     | En préparation|    | Prête  |     | Servie/Retirée |
 +----------+     +---------+     +--------------+     +--------+     +----------------+
      |
      v
 +----------+
 | Refusée  |  (rupture totale, fermeture imprévue : remboursement du client)
 +----------+
```

Les libellés affichés au restaurateur sont rattachés aux statuts canoniques du [modèle de données](../../architecture/donnees.md) : « Nouvelle » correspond au statut `paid` (la commande arrive déjà réglée), puis un refus confirmé mène à `refunded`. Le restaurateur agit d'un geste par transition (accepter, démarrer la préparation, marquer prête, puis servie ou retirée).

Le client suit ces changements d'état en direct sur son téléphone. Pour le sur place, « Servie » clôt la commande quand le plat arrive à table ; pour l'à emporter, « Prête » déclenche la notification de retrait et « Retirée » correspond à la remise au comptoir.

Le refus d'une commande déjà payée entraîne un remboursement intégral via Stripe. Avant acceptation, le motif canonique est « refus du restaurant ». Après acceptation, le Dashboard demande « produit indisponible » ou « incident de service ». La confirmation affiche le montant total et précise que la commission Surplasse est restituée lorsqu'elle avait été prélevée. La commande reste bloquée pendant le traitement et ne quitte la file qu'après un succès Stripe confirmé. Le délai maximal d'acceptation avant relance reste à trancher.

### Tablette au comptoir, téléphone en poche

Le Dashboard est conçu pour deux postures d'usage, sans mode séparé :

- **Tablette au comptoir** : l'écran de service affiche le flux en colonnes par statut, lisible à deux mètres. C'est l'installation recommandée.
- **Téléphone en poche** : la même application, en vue empilée. Le restaurateur en salle sent la vibration, sort le téléphone, accepte la commande, range le téléphone.

Plusieurs appareils peuvent être connectés en même temps sur le même établissement : une action faite sur l'un se reflète immédiatement sur les autres.

### Impression des tickets en cuisine

En option, chaque commande acceptée s'imprime automatiquement sur une imprimante thermique ESC/POS en cuisine : numéro, table, produits, options, remarques. Le ticket permet à la cuisine de travailler sans écran.

!!! info Choix matériel à trancher
Le protocole d'intégration des imprimantes (modèles supportés, connexion réseau ou USB, passerelle locale éventuelle) fait l'objet d'un ADR à venir sous `decisions/`. Cette section décrit le comportement cible, pas une compatibilité déjà établie.
!!!

### Gérer une rupture en plein service

Plus de tartare à 12 h 40 : le restaurateur ouvre la fiche du produit depuis le Dashboard et le marque **indisponible** en un geste. Le produit apparaît immédiatement grisé « épuisé » sur la carte du mini-site, et ne peut plus être ajouté à un panier. Le lendemain, ou dès que la cuisine réapprovisionne, le même geste le remet en vente.

La même mécanique s'applique à une option (plus de pain sans gluten) sans retirer le produit entier.

## Une journée type

!!! info Le service du midi chez Camille
9 h 30 : Camille arrive à son restaurant. Sur la tablette du comptoir, le Dashboard affiche le service à venir. Elle marque le velouté d'hier indisponible (il n'en reste plus) et ajoute le plat du jour avec son prix, photo prise à la volée.

11 h 55 : première commande, alerte sonore. Table 4, deux formules du midi, une cuisson à point. Camille accepte, le ticket sort en cuisine. Elle range son téléphone.

12 h 30 : le coup de feu. Six commandes en préparation à l'écran, colonnes bien remplies. Le serveur passe la table 2 en « Prête » depuis son téléphone en apportant les assiettes. Une commande à emporter tombe : le client viendra à 13 h.

13 h 10 : plus de tarte au citron. Camille la marque indisponible depuis le comptoir entre deux encaissements de cafés. Personne ne commandera un dessert qu'elle ne peut pas servir.

14 h 30 : le calme revient. Le bandeau du service affiche 43 commandes, 1 118 euros, 14 minutes de préparation en moyenne. Camille répond à deux avis du déjeuner, puis ferme la salle. Elle regardera la semaine dimanche soir.
!!!

## Entre les services : la gestion

### La carte

La carte se modifie sans intermédiaire et sans délai de publication :

| Élément | Actions disponibles |
|---|---|
| Catégories | Créer, renommer, réordonner, masquer |
| Produits | Créer, modifier le nom et la description, archiver |
| Prix | Modifier à l'unité ; l'historique des prix est conservé |
| Options | Définir des groupes d'options (choix unique ou multiple), suppléments tarifés |
| Photos | Ajouter, recadrer, remplacer ; une photo par produit |
| Horaires | Plages d'ouverture de la commande, par jour de la semaine |
| Disponibilités | Restreindre un produit à un créneau (formule du midi) ou à un jour |

Toute modification est visible sur le mini-site dès l'enregistrement. La carte initiale provient de l'extraction par IA faite pendant l'embarquement ; le Dashboard est ensuite la seule source de modification.

### QR codes et tables

Le restaurateur déclare ses tables (numéro ou nom libre : « Terrasse 3 »). Pour chaque table, le Dashboard génère un QR code propre, téléchargeable en PDF prêt à imprimer, individuellement ou en planche complète. Un QR code générique sans table sert au comptoir et à la vitrine pour l'à emporter.

Une table supprimée ou renumérotée invalide son ancien QR code : le client qui le scanne est redirigé vers la carte en mode à emporter plutôt que vers une erreur.

### Répondre aux avis

Les avis laissés par les clients après leur commande apparaissent dans le Dashboard avec la note, le commentaire et le contenu de la commande associée. Le restaurateur peut publier une réponse publique par avis. Les avis ne sont jamais supprimables par le restaurateur ; un signalement pour contenu abusif reste possible, avec un traitement dont les modalités restent à définir.

## En analyse : les chiffres

### Le service en cours

Un bandeau permanent en haut de l'écran de service affiche trois métriques en temps réel : le chiffre d'affaires du service, le nombre de commandes et le temps moyen de préparation. Elles se mettent à jour au fil de l'eau, par le même flux SSE que les commandes.

### Le passé

L'onglet d'analyse répond aux questions que le restaurateur se pose en fin de semaine :

- **Périodes** : par jour, par semaine, par mois, avec comparaison à la période précédente.
- **Top produits** : classement par quantités vendues et par chiffre d'affaires généré.
- **Heures de pointe** : répartition des commandes par tranche de 30 minutes, pour dimensionner l'équipe.
- **Panier moyen** : évolution dans le temps.
- **Sur place et à emporter** : part de chaque mode dans les commandes.
- **Pourboires et avis** : évolution du total des pourboires et de la note moyenne.

Les données brutes ne sont jamais agrégées entre établissements de restaurateurs différents : les chiffres d'un établissement n'appartiennent qu'à lui. La télémétrie technique de la plateforme, distincte de ces métriques métier, est décrite dans la page [observabilité](../../operations/observabilite.md).

## Plusieurs établissements

Un restaurateur peut gérer plusieurs établissements avec le même compte. Un sélecteur en tête de l'application permet de basculer de l'un à l'autre : le flux de commandes, la carte et les analyses affichés sont toujours ceux d'un seul établissement à la fois. Les alertes sonores ne concernent que l'établissement actif à l'écran ; une vue consolidée multi-établissements n'est pas prévue au MVP et reste à évaluer.

## États vides

Le Dashboard soigne le premier contact, quand il n'y a encore rien à afficher :

| Écran | Premier affichage |
|---|---|
| Flux de commandes, premier jour | « Aucune commande pour l'instant. Vos QR codes sont prêts : posez-les sur les tables, la première commande apparaîtra ici. » avec un lien direct vers la planche de QR codes |
| Flux de commandes, service calme | « Aucune commande en cours. » avec l'heure de la dernière commande servie |
| Analyse, sans historique | « Vos chiffres apparaîtront après votre premier service. » avec un exemple illustratif clairement marqué comme fictif |
| Avis, aucun avis | « Pas encore d'avis. Les clients sont invités à en laisser un après leur commande. » |

Un état vide dit toujours ce qui va se passer et ce que le restaurateur peut faire, jamais un écran blanc.

## États d'erreur

### Perte du flux temps réel

Si la connexion SSE se coupe (Wi-Fi du restaurant, veille de la tablette, incident réseau), le Dashboard l'affiche sans ambiguïté : un bandeau « Connexion perdue, reconnexion en cours » remplace le bandeau de métriques, avec l'heure de la dernière synchronisation. La reconnexion est automatique, avec repli progressif.

À la reconnexion, le client SSE transmet l'identifiant du dernier événement reçu et le backend rejoue les événements manqués : aucune commande passée pendant la coupure n'est perdue. Ce mécanisme de rattrapage est spécifié dans la page [backend](../../architecture/backend.md).

!!! warning Le paiement n'attend pas le Dashboard
Une commande payée pendant une coupure existe bel et bien côté client et côté Stripe. Le Dashboard hors ligne ne bloque jamais l'encaissement ; il rattrape. C'est pourquoi le bandeau de coupure est volontairement impossible à manquer : tant qu'il est affiché, des commandes peuvent attendre.
!!!

### Imprimante hors ligne

Si l'impression automatique est activée et que l'imprimante ne répond plus, le Dashboard le signale par une alerte persistante et bascule en mode dégradé : les tickets non imprimés sont conservés en file d'attente et chaque carte de commande porte un marqueur « non imprimé ». Le restaurateur peut relancer l'impression de la file en un geste une fois l'imprimante revenue, ou continuer le service à l'écran. Une commande n'est jamais bloquée par un problème d'impression.

## Indicateurs affichés : définitions exactes

Pour éviter toute ambiguïté de calcul entre le Dashboard, le backend et la documentation, chaque indicateur a une définition unique. Le contrat OpenAPI reprend ces définitions dans la description des champs concernés.

| Indicateur | Définition exacte |
|---|---|
| Chiffre d'affaires | Somme des montants TTC des commandes payées de la période, pourboires exclus, commandes remboursées déduites à la date du remboursement |
| Nombre de commandes | Nombre de commandes payées de la période ; les paniers non validés et les paiements échoués ne comptent pas |
| Panier moyen | Chiffre d'affaires de la période divisé par le nombre de commandes de la période ; non affiché si le nombre de commandes est nul |
| Temps moyen de préparation | Moyenne, sur les commandes servies de la période, du délai entre l'acceptation et le passage à « Prête » |
| Top produits | Classement des produits par quantité vendue dans les commandes payées de la période ; les options ne forment pas de ligne propre, leur montant est rattaché au produit porteur |
| Heures de pointe | Nombre de commandes payées par tranche de 30 minutes, la commande étant rattachée à l'heure de sa validation par le client |
| Part sur place et à emporter | Répartition en pourcentage du nombre de commandes payées par mode ; calculée en nombre de commandes, pas en valeur |
| Pourboires | Somme des pourboires des commandes payées de la période ; jamais inclus dans le chiffre d'affaires ni dans le panier moyen |
| Note moyenne des avis | Moyenne arithmétique des notes (sur 5) des avis publiés pendant la période, réponses du restaurateur sans effet sur le calcul |

Le rattachement d'une commande à une période se fait sur l'heure de validation du paiement, dans le fuseau horaire de l'établissement. Un service « du midi » ou « du soir » est une plage horaire configurable par établissement ; les valeurs par défaut de ces plages restent à définir.
