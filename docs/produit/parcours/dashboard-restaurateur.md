---
label: Dashboard restaurateur
order: 30
icon: graph
description: Le quotidien de l'équipe avec le Dashboard, du flux de commandes en plein service au rapprochement, en passant par la gestion de la carte.
---

# Parcours : le quotidien avec le Dashboard

Le Dashboard (`dashboard.surplasse.com`) est l'application de travail du restaurateur et de son équipe. Une fois l'[embarquement](onboarding-restaurateur.md) terminé, c'est là que les commandes arrivent, que la salle et la cuisine se coordonnent, que la carte se gère et que les ventes Surplasse se rapprochent. Cette page décrit le parcours de référence, structuré en trois temps qui suivent le rythme réel d'une journée de restauration.

| Temps | Moment de la journée | Activités |
|---|---|---|
| **Pendant le service** | Coups de feu du midi et du soir | Recevoir, accepter, préparer et servir, gérer les ruptures |
| **Entre les services** | Matinée, après-midi, fermeture | Ajuster la carte, gérer l'équipe, les QR codes et les tables |
| **Après le service** | Fermeture et fin de semaine | Rapprocher les ventes et versements, puis lire les analyses |

Le restaurateur et les membres nominatifs se connectent par magic link envoyé par email : pas de mot de passe à retenir. Un restaurateur peut aussi appairer une tablette comme poste partagé Salle ou Cuisine. Les rôles et sessions sont fixés dans l'[ADR-0031](../../decisions/adr-0031-equipes-roles-vues-metier.md).

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

L'équipe fait avancer chaque commande d'un geste, selon ses droits : la salle accepte et sert, un membre nominatif autorisé peut refuser une nouvelle commande, la cuisine démarre la préparation et marque prête, le responsable traite les remboursements après acceptation. Un poste partagé Salle peut aussi déclencher une pause de sécurité, mais ne peut ni refuser ni rouvrir.

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

Les libellés affichés à l'équipe sont rattachés aux statuts canoniques du [modèle de données](../../architecture/donnees.md) : « Nouvelle » correspond au statut `paid` (la commande arrive déjà réglée), puis un refus confirmé mène à `refunded`. Chaque transition reste idempotente et attribuée à son auteur. Une action déjà réalisée sur un autre appareil resynchronise la carte au lieu de produire une seconde transition.

Le client suit ces changements d'état en direct sur son téléphone. Pour le sur place, « Servie » clôt la commande quand le plat arrive à table ; pour l'à emporter, « Prête » déclenche la notification de retrait et « Retirée » correspond à la remise au comptoir.

Le refus d'une nouvelle commande déjà payée entraîne un remboursement intégral via Stripe. Avant acceptation, une session nominative `service` peut utiliser uniquement le motif canonique « refus du restaurant » et ne choisit jamais le montant. Après acceptation, seul un rôle `owner` ou `manager` rembourse avec le motif « produit indisponible » ou « incident de service ». La confirmation affiche le montant total et précise que la commission Surplasse est restituée lorsqu'elle avait été prélevée. La commande reste bloquée pendant le traitement et ne quitte la file qu'après un succès Stripe confirmé. La référence reste une acceptation manuelle ; une commande non acceptée avant le délai maximal configuré est remboursée automatiquement et la prise de commandes reste en pause jusqu'à l'intervention d'un responsable.

### Un Dashboard, trois vues métier

Le Dashboard ne se duplique pas en trois applications. Il adapte sa hiérarchie au poste :

| Vue | Utilisateur principal | Tâche première |
|---|---|---|
| **Salle** | Serveur, comptoir, responsable | Voir les tables, accepter les nouvelles commandes, repérer ce qui est prêt et marquer servi |
| **Cuisine** | Cuisinier, pass | Lire les tickets par ancienneté, démarrer, signaler une rupture et marquer prêt |
| **Gestion** | Restaurateur, responsable | Gérer la carte, l'équipe, l'apparence, les horaires, les QR codes, les finances et l'analyse |

Les rôles `owner`, `manager`, `service` et `kitchen` autorisent les actions côté Backend. Changer d'URL ou de vue ne donne aucun droit supplémentaire. Un `owner` ou `manager` peut utiliser une vue combinée dans un petit établissement où la même personne accepte, prépare et sert.

Plusieurs appareils peuvent être connectés en même temps sur le même établissement : une action faite sur l'un se reflète immédiatement sur les autres. Le poste Cuisine n'affiche ni montant de vente, ni identité de compte, ni composant Stripe.

### La vue Cuisine

La cuisine travaille sur une file plein écran triée par ancienneté. Chaque ticket rend saillants le numéro, la table, le temps écoulé, les quantités, les options, les allergènes et la remarque du client. Deux actions principales suffisent : « Démarrer » puis « Prête ».

Le dernier ticket passé à « Prête » par la même session peut être rappelé immédiatement en cas de geste involontaire : il revient à « En préparation » sur tous les appareils et dans le suivi client, tant qu'il n'est ni servi ni retiré. Pour une commande à emporter, l'interface affiche une fenêtre de cinq secondes avant l'envoi du SMS « Prête » ; le rappel annule aussi cette remise. Une fois l'envoi commencé, le rappel est remplacé par le traitement d'incident afin de ne pas contredire un message potentiellement reçu. Une rupture de produit ou d'option est accessible sans ouvrir la gestion complète de la carte. Le routage par poste spécialisé, par exemple bar, chaud ou froid, arrive après la validation de cette file commune.

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
9 h 30 : Camille arrive à son restaurant. La vue Gestion affiche le contrôle de préparation. Elle marque le velouté d'hier indisponible, vérifie les horaires, le son, le poste Cuisine et les QR codes, puis publie le plat du jour depuis un brouillon.

11 h 55 : première commande, alerte sonore. Table 4, deux formules du midi, une cuisson à point. Karim l'accepte dans la vue Salle. Le ticket apparaît dans la vue Cuisine et peut aussi être imprimé si l'option est activée.

12 h 30 : le coup de feu. Six commandes sont en préparation. La cuisine marque la table 2 « Prête » ; Karim la voit immédiatement dans la vue Salle, apporte les assiettes et marque la commande « Servie ». Une commande à emporter tombe pour un créneau encore disponible à 13 h.

13 h 10 : plus de tarte au citron. La cuisine la signale indisponible. La rupture est tracée et synchronisée immédiatement avec la carte publique. Personne ne commandera un dessert qui ne peut plus être servi.

14 h 30 : le calme revient. Le bandeau du service affiche 43 commandes Surplasse, 1 118 euros de ventes brutes Surplasse TTC, 24 euros de remboursements et 14 minutes de préparation en moyenne. Camille vérifie qu'aucune commande n'est restée ouverte, met la prise de commandes en pause et rapproche les ventes, remboursements et versements attendus.
!!!

## Entre les services : la gestion

### La carte

La carte se modifie sans intermédiaire. Les ruptures prennent effet immédiatement ; les changements structurels restent dans un brouillon jusqu'à leur publication :

| Élément | Actions disponibles |
|---|---|
| Catégories | Créer, renommer, réordonner, masquer |
| Produits | Créer, modifier le nom et la description, archiver |
| Prix | Modifier à l'unité ; l'historique des prix est conservé |
| Options | Définir des groupes d'options (choix unique ou multiple), suppléments tarifés |
| Photos | Téléverser, recadrer, remplacer ou retirer une photo ; demander des rendus IA depuis la photo du plat réel ; choisir la photo fournie, un candidat généré ou aucune image |
| Horaires | Plages d'ouverture de la commande, par jour de la semaine |
| Disponibilités | Restreindre un produit à un créneau (formule du midi) ou à un jour |

Une modification structurelle passe par une prévisualisation mobile et une publication atomique. La version précédente reste restaurable. Pour un visuel, la photo déjà publiée reste affichée pendant la génération et en cas d'échec. Les candidats IA restent privés jusqu'à ce que le restaurateur compare les rendus et en sélectionne explicitement un ; il peut aussi conserver la photo fournie ou choisir de ne rien afficher. La génération exige une photo du plat réellement servi dont il détient les droits, jamais une photo issue d'une plateforme ou d'un tiers. Le rendu retenu porte la mention « suggestion de présentation ». Ce workflow est fixé par l'[ADR-0025](../../decisions/adr-0025-visuels-plats-a-la-demande.md).

La vue Gestion propose trois profils de présentation : Compact, Équilibré et Visuel. Le restaurateur règle aussi la politique d'images, le logo, la couverture et une palette accessible. Les prix, allergènes, actions, contrastes et budgets de performance restent protégés. Une prévisualisation mobile précède la publication.

La carte initiale provient de l'extraction par IA faite pendant l'embarquement ; le Dashboard devient ensuite la source de ses modifications courantes, sans intervention de Surplasse.

### QR codes et tables

Le restaurateur déclare ses tables (numéro ou nom libre : « Terrasse 3 »). Pour chaque table, le Dashboard génère un QR code propre, téléchargeable en PDF prêt à imprimer, individuellement ou en planche complète. Un QR code générique sans table sert au comptoir et à la vitrine pour l'à emporter.

Une table supprimée ou renumérotée invalide son ancien QR code : le client qui le scanne est redirigé vers la carte en mode à emporter plutôt que vers une erreur.

Le même écran exporte une carte papier datée depuis la version publiée. Le Dashboard signale qu'un PDF déjà imprimé est devenu obsolète après une nouvelle publication. Le restaurateur ne maintient jamais une seconde carte dans Surplasse.

### Répondre aux avis

Les avis laissés par les clients après leur commande apparaissent dans le Dashboard avec la note, le commentaire et le contenu de la commande associée. Le restaurateur peut publier une réponse publique par avis. Les avis ne sont jamais supprimables par le restaurateur ; un signalement pour contenu abusif reste possible, avec un traitement dont les modalités restent à définir.

## Après le service : rapprocher puis analyser

### Le service en cours

Un bandeau permanent en haut de l'écran de service affiche quatre métriques en temps réel : les ventes brutes Surplasse TTC, les remboursements réussis pendant le service, le nombre de commandes payées et le temps moyen de préparation. Le brut et les remboursements restent séparés afin qu'un remboursement tardif ne réécrive jamais le volume historique. Ces métriques se mettent à jour au fil de l'eau, par le même flux SSE que les commandes.

### Le rapprochement

Avant l'analyse, le restaurateur doit comprendre l'argent. Le rapport de fin de service distingue ventes brutes Surplasse TTC, remboursements, commission Surplasse, frais Stripe disponibles, net attendu et versements. Chaque écart renvoie aux commandes et identifiants Stripe concernés. Les composants Connect intégrés donnent accès aux paiements, versements, litiges, documents et rapports sans ouvrir un Dashboard Stripe séparé. Les pourboires rejoignent ce registre lorsqu'ils sont livrés en phase 5.

L'export comptable porte uniquement les ventes du canal Surplasse. Il ne prétend jamais représenter le chiffre d'affaires complet du restaurant, conformément à l'[ADR-0032](../../decisions/adr-0032-canal-prepaye-sans-caisse.md).

### Le passé

L'onglet d'analyse répond aux questions que le restaurateur se pose en fin de semaine :

- **Périodes** : par jour, par semaine, par mois, avec comparaison à la période précédente.
- **Top produits** : classement par quantités vendues et par ventes Surplasse générées.
- **Heures de pointe** : répartition des commandes par tranche de 30 minutes, pour dimensionner l'équipe.
- **Services** : comparaison des plages configurées, par exemple midi et soir.
- **Panier moyen** : évolution dans le temps.
- **Sur place et à emporter** : part de chaque mode dans les commandes.
- **Pourboires et avis** : évolution du total des pourboires et de la note moyenne, à partir de la phase 5.

Les données brutes ne sont jamais agrégées entre établissements de restaurateurs différents : les chiffres d'un établissement n'appartiennent qu'à lui. La télémétrie technique de la plateforme, distincte de ces métriques métier, est décrite dans la page [observabilité](../../operations/observabilite.md).

## Plusieurs établissements

Un membre peut appartenir à plusieurs établissements avec un rôle propre à chacun. Un sélecteur en tête de l'application permet de basculer de l'un à l'autre : le flux de commandes, la carte et les analyses affichés sont toujours ceux d'un seul établissement à la fois. Les alertes sonores ne concernent que l'établissement actif à l'écran ; une vue consolidée multi-établissements n'appartient pas au socle professionnel.

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

À la reconnexion, le client SSE transmet l'identifiant du dernier événement reçu et le backend rejoue les événements manqués : aucune commande passée pendant la coupure n'est perdue. Seules les sessions explicitement armées et capables d'accepter comptent comme réceptionnaires ; un poste Cuisine seul ne permet ni l'ouverture ni son maintien. Si tous les réceptionnaires perdent leur présence au-delà du délai de grâce, y compris après verrouillage de l'écran, arrière-plan durable ou perte de réseau, le Backend met automatiquement la prise de commandes en pause, sans la rouvrir au retour du réseau, et alerte le responsable par le canal secondaire configuré. Ce mécanisme est spécifié dans la page [backend](../../architecture/backend.md).

!!! warning Le paiement n'attend pas le Dashboard
Une commande payée dans la fenêtre entre la dernière présence valide et la pause existe bel et bien côté client et côté Stripe. Elle reste dans la file au retour du réseau. Si personne ne l'accepte avant le délai maximal, Surplasse lance son remboursement intégral et maintient la prise de commandes en pause. Une coupure ne produit donc ni commande invisible indéfiniment, ni réouverture silencieuse.
!!!

### Imprimante hors ligne

Si l'impression automatique est activée et que l'imprimante ne répond plus, le Dashboard le signale par une alerte persistante et bascule en mode dégradé : les tickets non imprimés sont conservés en file d'attente et chaque carte de commande porte un marqueur « non imprimé ». Le restaurateur peut relancer l'impression de la file en un geste une fois l'imprimante revenue, ou continuer le service à l'écran. Une commande n'est jamais bloquée par un problème d'impression.

## Indicateurs affichés : définitions exactes

Pour éviter toute ambiguïté de calcul entre le Dashboard, le backend et la documentation, chaque indicateur a une définition unique. Le contrat OpenAPI reprend ces définitions dans la description des champs concernés.

| Indicateur | Définition exacte |
|---|---|
| Ventes brutes Surplasse TTC | Somme des montants TTC dont le paiement a réussi pendant la période, avant remboursement et pourboires exclus ; ce montant n'est pas le chiffre d'affaires total du restaurant |
| Remboursements | Somme des remboursements Stripe réussis pendant la période, intégraux ou partiels, affichée séparément et jamais effacée rétroactivement |
| Ventes nettes Surplasse TTC | Ventes brutes Surplasse TTC de la période diminuées des remboursements réussis dans la même période |
| Nombre de commandes payées | Nombre de commandes dont le paiement a réussi pendant la période ; les paniers non validés et les paiements échoués ne comptent pas, un remboursement ultérieur ne supprime pas ce volume historique |
| Panier moyen | Ventes brutes Surplasse TTC de la période divisées par le nombre de commandes payées de la période ; non affiché si le nombre est nul |
| Temps moyen de préparation | Moyenne, sur les commandes servies et non remboursées intégralement de la période, du délai entre l'acceptation et le dernier passage à « Prête » avant service ou retrait |
| Top produits par quantité | Pour les commandes payées pendant la période, quantité payée diminuée des quantités ensuite remboursées sur leurs lignes à la date du rapport ; les options ne forment pas de ligne propre |
| Top produits par ventes | Pour les commandes payées pendant la période, somme des montants de ligne figés, options comprises et pourboires exclus, diminuée des ajustements ensuite associés à ces lignes à la date du rapport |
| Heures de pointe | Nombre de commandes dont le paiement a réussi par tranche de 30 minutes, remboursement ultérieur sans effet ; la commande est rattachée à l'instant du succès de paiement |
| Répartition par service | Nombre et ventes Surplasse TTC des commandes rattachées à chaque plage de service configurée |
| Part sur place et à emporter | Répartition en pourcentage de toutes les commandes dont le paiement a réussi par mode, remboursement ultérieur sans effet ; calculée en nombre de commandes, pas en valeur |
| Pourboires | Somme des pourboires payés pendant la période, diminuée de leurs remboursements lorsqu'ils sont concernés ; jamais inclus dans les ventes Surplasse TTC ni dans le panier moyen |
| Note moyenne des avis | Moyenne arithmétique des notes (sur 5) des avis publiés pendant la période, réponses du restaurateur sans effet sur le calcul |

Le rattachement d'une commande à une période se fait sur l'instant du succès de paiement, dans le fuseau horaire de l'établissement. Un remboursement est rattaché à l'heure de sa réussite Stripe. Il ne fait pas disparaître rétroactivement la vente brute ni le volume de commandes de leur période d'origine. Les vues par produit forment une cohorte sur le succès de paiement, puis appliquent les ajustements associés à ses lignes à la date du rapport ; elles peuvent donc évoluer après un remboursement tardif sans changer le brut. Une modification ultérieure de la carte ne change jamais le nom, les options, le taux fiscal configuré ni le prix figés dans ses lignes.

Un service « du midi » ou « du soir » est une plage horaire configurable par établissement. La configuration refuse les chevauchements. Chaque commande rejoint l'unique service qui contient l'instant du succès de son paiement, dans le fuseau de l'établissement ; une commande en dehors de toute plage apparaît dans « Hors service ». Les valeurs par défaut de ces plages restent à définir.
