---
label: Socle professionnel
order: 35
icon: shield-check
description: Le périmètre minimum qui permet à une équipe de restaurant d'exploiter Surplasse chaque jour, et la méthode de preuve de sa couverture.
---

# Socle professionnel

Le premier pilote prouve qu'une commande peut être créée, payée, reçue et servie sans incohérence. Il ne prouve pas encore qu'une équipe de restaurant peut dépendre de Surplasse tous les jours. Cette page fixe le second cap : le minimum professionnel à atteindre pendant la [phase 4](../roadmap.md#phase-4-exploiter-piloter).

Elle définit le périmètre et la preuve attendue. Elle ne crée pas un second calendrier : la [roadmap](../roadmap.md) reste la seule source de l'ordre de livraison, et le [catalogue des fonctionnalités](fonctionnalites.md) reste la source de leur priorité MoSCoW.

!!! warning Une hypothèse à prouver, pas un chiffre de marché
« Couvrir 80 % » signifie ici qu'au moins 80 % des établissements d'une cohorte pilote appartenant à la cible accomplissent leurs tâches critiques sans contournement bloquant, avec une exposition minimale définie plus bas. C'est une preuve directionnelle de produit, pas une estimation statistique du marché. Cela ne signifie pas que Surplasse répond déjà à 80 % de tous les restaurants français. Les chaînes, la restauration gastronomique multi-services, la livraison et le remplacement complet d'une caisse restent hors de cette preuve.
!!!

## Cible couverte

Le socle vise les indépendants de un à trois établissements, sans équipe informatique et sans intégration profonde à une caisse imposée. Trois contextes doivent être représentés dans la cohorte :

| Contexte | Besoin principal couvert | Limite assumée |
|---|---|---|
| Restaurant avec service à table | Commandes prépayées par QR, suivi par table, coordination salle et cuisine | Pas d'addition ouverte ni de paiement en fin de repas dans le socle |
| Café, bar ou restauration rapide au comptoir | Carte lisible, commande rapide, file de préparation et retrait | Pas de gestion de stock par ingrédient ni de borne dédiée |
| Établissement à emporter | Commande anticipée et capacité par créneau | Pas de livraison ni d'agrégateur |

Surplasse exploite de bout en bout les commandes passées et payées dans son canal. Les autres commandes continuent de vivre dans l'outil habituel du restaurant. Cette frontière est fixée dans l'[ADR-0032](../decisions/adr-0032-canal-prepaye-sans-caisse.md).

## Principes de conception

### Une application, trois vues métier

Le Dashboard reste une seule application. Il présente trois vues métier alimentées par les mêmes commandes :

| Vue métier | Poste et moment | Information prioritaire |
|---|---|---|
| **Salle** | Téléphone du serveur, tablette au comptoir | Nouvelles commandes, tables, commandes prêtes, service et prise de commandes |
| **Cuisine** | Tablette ou écran fixe en production | Ancienneté, produits, options, allergènes, remarques, préparation et passage à « Prête » |
| **Gestion** | Téléphone ou ordinateur du restaurateur, entre les services | Carte, équipe, apparence, horaires, QR codes, historique, paiements et analyses |

Une vue métier organise le travail. Un rôle autorise les actions. Les deux notions restent séparées : un restaurateur peut ouvrir la vue Cuisine, mais un membre au rôle `kitchen` ne gagne pas l'accès aux finances en ouvrant une autre URL. L'[ADR-0031](../decisions/adr-0031-equipes-roles-vues-metier.md) fixe ce modèle.

### Un canal prépayé, pas une caisse omnicanale

Une commande Surplasse devient opérationnelle après la confirmation du paiement en ligne par le webhook Stripe. Le socle n'enregistre pas les espèces, titres-restaurant, chèques ni paiements effectués sur un terminal externe. Il n'essaie pas de reconstituer le chiffre d'affaires total du restaurant.

Une commande assistée peut être préparée par un membre en salle, puis transmise au client sous forme de lien ou de QR à vérifier et payer sur son téléphone. La proposition ne rejoint jamais la cuisine avant le paiement. Ce parcours reste un Should, sauf si la pré-cohorte démontre avant la preuve formelle qu'il bloque l'exploitation.

### Le QR code est un canal, pas l'unique support

La carte publiée produit aussi une version imprimable. Le restaurateur maintient une seule source, puis exporte une version papier datée avec prix TTC et informations réglementaires. Le Dashboard signale quand un ancien export n'est plus aligné avec la carte publiée.

Le QR code peut enrichir le support physique, mais ne remplace pas les affichages obligatoires ni la note remise au client, comme le rappelle la [fiche Restaurants de la DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/restaurants-droits-et-obligations-des-professionnels). Les allergènes sont accessibles directement et par écrit, conformément au [guide 2026 du ministère de l'Agriculture](https://agriculture.gouv.fr/telecharger/129266?token=86bd6acaf661e075366620baec1b49dddbe9c6ecb52b65c8941f6229e7f0bbea). Le périmètre exact des mentions est validé avant la commercialisation avec un professionnel compétent.

### Des réglages bornés, pas un constructeur de pages

Le restaurateur choisit un profil de présentation et quelques attributs de marque. Surplasse conserve les invariants de lisibilité, de performance et de conversion.

| Profil | Usage | Présentation |
|---|---|---|
| **Compact** | Café, bar, carte longue, lecture rapide | Liste dense, images masquées ou miniatures, descriptions secondaires repliables |
| **Équilibré** | Cas général | Miniature facultative, description courte et prix immédiatement lisible |
| **Visuel** | Carte courte portée par les plats | Images plus grandes et espace éditorial accru, sans masquer les prix ni les actions |

Le restaurateur règle le logo, la couverture, une palette accessible, le profil de densité et la politique d'images. La navigation, les prix, les allergènes, les cibles tactiles, le contraste et le budget de performance restent protégés. Une prévisualisation mobile précède toute publication.

## Repères externes

Ces repères ne prouvent pas une couverture de 80 %. Ils montrent les capacités que plusieurs outils professionnels rendent déjà ordinaires ; la pré-cohorte et les tests Surplasse en décident la forme minimale avant la preuve formelle :

- des accès par utilisateur et par rôle existent chez [Innovorder](https://help.innovorder.fr/hc/fr/articles/19395202095644-G%C3%A9rer-les-utilisateurs-et-r%C3%B4les-de-caisse-dans-le-backoffice) comme chez [Lightspeed](https://k-series-support.lightspeedhq.com/hc/fr-fr/articles/1260804647189-%C3%80-propos-des-utilisateurs-caisses) ;
- un écran de production distinct, trié et actionnable, constitue le cœur du [KDS Lightspeed](https://k-series-support.lightspeedhq.com/hc/fr-fr/articles/4418209500443-%C3%80-propos-de-l-%C3%A9cran-d-affichage-cuisine-KDS-Lightspeed) ;
- la rupture immédiate, le rapport de fin de journée et le rapprochement des versements sont traités séparément par Square dans ses documentations sur la [disponibilité](https://squareup.com/help/fr/fr/article/8495-beta-item-availability), la [fin de journée](https://squareup.com/help/fr/fr/article/6594-end-of-day-reporting-with-square-for-restaurants) et les [dépôts bancaires](https://squareup.com/help/fr/fr/article/3813-match-deposits-to-sales) ;
- la personnalisation par styles prédéfinis, plutôt que par liberté totale, est aussi le modèle documenté par [Square Online](https://squareup.com/help/fr/fr/article/7820-choose-styles-for-your-square-online-site).

Surplasse ne copie pas ces produits et ne cherche pas leur largeur fonctionnelle. Cette convergence sert de garde-fou : rôles, production, indisponibilités et rapprochement appartiennent au socle professionnel ; la façon de les simplifier reste propre au canal prépayé Surplasse.

## Minimum bloquant avant généralisation

### Opérer en équipe

| Capacité | Minimum attendu |
|---|---|
| Membres et rôles | Invitation, acceptation, révocation immédiate et rôles fixes `owner`, `manager`, `service`, `kitchen`, portés par l'appartenance à chaque établissement |
| Poste partagé | Appairage temporaire d'une tablette Salle ou Cuisine, révocable, sans partage du magic link du restaurateur et sans accès aux réglages sensibles |
| Vue Salle | File des nouvelles commandes, regroupement par table, acceptation, pause de sécurité, commandes prêtes et passage à « Servie » ; seule une session nominative peut refuser |
| Vue Cuisine | File chronologique, minuteur, options et remarques saillantes, allergènes, démarrage, passage à « Prête » et retour immédiat du dernier ticket clôturé par la même session s'il l'a été par erreur ; à emporter, ce retour dispose de cinq secondes avant l'envoi du SMS |
| Vue Gestion | Carte, tables, équipe, apparence, historique, finances et réglages de l'établissement |
| Journal d'activité | Auteur, date, établissement et résultat des remboursements, pauses, publications de carte, changements de prix et modifications de droits |

Les contrôles vivent dans le Backend. Masquer un bouton ne constitue jamais une autorisation. Chaque opération protégée possède un test prouvant qu'un rôle interdit reçoit une réponse fermée et qu'une ressource d'un autre établissement reste invisible.

### Tenir un service

| Capacité | Minimum attendu |
|---|---|
| Préparation du service | Contrôle unique de la carte publiée, des horaires, des QR codes, du compte Stripe, du son, du réseau, du poste Cuisine et d'une session de réception capable d'accepter avant l'ouverture explicite |
| Alertes | Son et signal visuel testables, état SSE permanent, âge de la commande et relance visible tant qu'une nouvelle commande n'est pas acquittée |
| Sécurité de réception | Au moins une session explicitement armée, testée et capable d'accepter pendant l'ouverture ; un poste Cuisine seul ne suffit pas. L'absence prolongée de tout réceptionnaire force une pause sans réouverture, une alerte secondaire et le traitement borné des commandes déjà payées |
| Horaires | Fuseau IANA, plages récurrentes, fermetures exceptionnelles et services nommés sans chevauchement |
| Disponibilités | Rupture immédiate d'un produit ou d'une option, réactivation manuelle, effet simultané sur Commande, Salle et Cuisine |
| Tables et QR codes | Création, renommage, désactivation, régénération et export des QR codes depuis le Dashboard |
| Exceptions | Motif obligatoire, remboursement intégral ou partiel par ligne et quantité, trace de l'auteur, reçu mis à jour et continuité de la partie encore servie |
| Reconnexion | Affichage non ambigu des données périmées, reprise SSE avec rejeu et resynchronisation REST sans perte de commande payée |

Le routage simple vers deux ou trois postes, par exemple bar, chaud ou froid, et l'impression thermique restent des Should. Une vue Cuisine fiable et un mode de secours testé précèdent tout support matériel large. La pré-cohorte décrite dans la roadmap comprend deux établissements de comptoir ; si les deux ne peuvent pas tenir une période de pointe avec une file commune, le routage simple devient Must. Si au moins deux établissements ne peuvent pas terminer une pointe avec l'écran et son secours testés, l'impression devient Must. Toute capacité promue est livrée avant le démarrage de la cohorte formelle.

### Gérer une carte professionnelle

| Capacité | Minimum attendu |
|---|---|
| Publication sûre | Ruptures immédiates, mais modifications structurelles en brouillon, prévisualisation, validation et publication atomique d'une version complète |
| Retour arrière | Historique des versions publiées et restauration explicite sans réécrire les lignes des commandes passées |
| Structure | Catégories, produits, options, formules simples, horaires de disponibilité et ordre d'affichage. Une formule regroupe et ordonne ses choix sur un ticket unique, sans pilotage séparé de l'envoi de chaque service |
| Information client | Prix TTC, allergènes déclarés par le restaurateur, régimes, origine et mentions applicables, sans déduction juridique par l'IA |
| Présentation | Profils Compact, Équilibré et Visuel, politique d'images, en-tête de l'établissement et prévisualisation mobile |
| Support papier | PDF dérivé de la version publiée, daté, versionné et utilisable sans images |

### Couvrir les contextes adjacents

| Contexte | Minimum attendu |
|---|---|
| À emporter | Créneaux de retrait, capacité par créneau, prénom et numéro mobile minimaux, SMS à l'état « Prête » et passage à « Retirée » |
| Plusieurs établissements | Appartenance et rôle propres à chaque établissement, bascule explicite, aucune alerte ni donnée mélangée et vue toujours limitée à un établissement |
| Commande assistée | Proposition préparée en Salle, recalculée par le Backend, vérifiée puis payée par le client avant toute entrée en cuisine ; la pré-cohorte décide si elle devient Must avant la preuve formelle |

Ces capacités élargissent la preuve sans transformer le cœur commun. La cohorte formelle ne sert pas à découvrir ses propres prérequis : elle commence avec tous les Must, y compris ceux promus après la pré-cohorte. Une vue consolidée de réseau, la livraison et la commande impayée restent exclues.

### Comprendre l'argent

Les métriques commerciales, le registre financier et le versement bancaire répondent à trois questions différentes. Le Dashboard ne les fusionne pas.

| Surface | Question | Données minimales |
|---|---|---|
| Service en cours | Que se passe-t-il maintenant ? | Ventes brutes Surplasse TTC, remboursements, commandes payées et temps moyen de préparation |
| Historique de ventes | Qu'a vendu le canal ? | Commandes, lignes figées, remboursements et ventilation fiscale configurée par le restaurateur |
| Registre de paiement | Pourquoi ce montant ? | Montant brut, remboursement, commission Surplasse, frais Stripe disponibles, net et identifiants de rapprochement |
| Versements | Quand l'argent arrive-t-il ? | Montant, statut, date attendue, compte connecté, transactions incluses et échec éventuel |
| Fin de service | Tout est-il expliqué ? | Commandes encore ouvertes, ventes, remboursements, litiges, net attendu et écarts |

Le Dashboard intègre les composants Stripe nécessaires aux paiements, versements, litiges, documents et rapports, ainsi que la bannière d'exigences et la remédiation du compte. Le Backend crée une session Stripe courte avec une liste de composants et d'actions autorisés par le rôle. Les remboursements et captures restent désactivés dans les composants lorsqu'un workflow Surplasse doit garantir l'idempotence, la commission et le journal. Il produit un export CSV des seules ventes Surplasse, avec les identifiants permettant au comptable de les rapprocher. Chaque ligne de commande conserve la catégorie fiscale, le taux, la base hors taxe et le montant de taxe validés lors de l'achat ; une modification ultérieure de la carte ne réécrit jamais cet instantané. Le Dashboard n'affiche jamais ce sous-total comme « chiffre d'affaires du restaurant ».

Les taux de TVA et mentions fiscales sont fournis ou validés par le restaurateur avec son conseil. Surplasse ne devine pas un taux à partir du nom d'un plat. Une revue juridique et comptable confirme avant la généralisation si le périmètre doit être certifié comme système de caisse et comment il s'insère dans les obligations de facturation et de transmission de données.

## Ce qui reste hors du socle

- Encaissement d'espèces, chèques, titres-restaurant ou paiements sur un terminal externe.
- Addition ouverte, partage d'une addition après consommation et paiement en fin de repas.
- Intégration bidirectionnelle à une caisse, sauf demande validée après les pilotes.
- Stock par ingrédient, achats fournisseurs, coût matière et marge théorique.
- Planification, pointage, paie et gestion des ressources humaines.
- Réservations, livraison et agrégateurs.
- Routage complexe par brigade et séquencement gastronomique des plats.
- Rôles entièrement personnalisables et constructeur visuel libre.
- Consolidation avancée de réseaux et franchises.

Ces exclusions ne rendent pas le besoin illégitime. Elles empêchent le socle de devenir une suite de restauration générale avant d'avoir prouvé le canal direct. Si plus de deux établissements recrutés sur dix échouent uniquement parce que les deux flux imposent une ressaisie ou une double surveillance intenable, une intégration caisse unidirectionnelle devient un bloqueur de généralisation et doit être cadrée par un nouvel ADR.

## Preuve de couverture

La cohorte de validation comprend exactement dix établissements recrutés selon les mêmes critères : quatre restaurants à table, trois activités principalement au comptoir et trois activités principalement à emporter. Au moins deux exploitants gèrent deux établissements dans Surplasse afin de vérifier les droits et la bascule. Un établissement peut servir plusieurs contextes, mais il ne compte que dans son contexte principal pour cette répartition. La période observée dure quatre semaines consécutives après une première semaine d'accompagnement. Chaque établissement s'engage à exposer le canal pendant au moins huit services réels, dont deux périodes de pointe, et à traiter au moins cinquante commandes payées. Un abandon après recrutement reste dans le dénominateur et compte comme un échec.

Le socle est validé quand toutes les conditions suivantes sont vraies :

- au moins huit établissements sur dix ouvrent, exploitent, ferment et rapprochent leurs services sans assistance quotidienne, avec au minimum trois succès sur quatre à table, deux sur trois au comptoir et deux sur trois à emporter ;
- chaque établissement avec plusieurs personnes utilise des comptes nominatifs ou des postes appairés, jamais le compte du restaurateur partagé ;
- 100 % des commandes, paiements, remboursements, commissions, frais Stripe disponibles et versements sont rapprochés jusqu'au dépôt bancaire, avec au moins un dépôt effectivement observé par établissement ; aucun écart inexpliqué ni aucun écart attribuable à Surplasse ne subsiste. Seules les transactions postérieures à la dernière échéance de versement documentée peuvent rester en transit ; un incident externe ouvert reste attribué et suivi ; les échecs et litiges restent visibles ;
- chaque établissement qualifie au moins un remboursement partiel de bout en bout sur une commande payée, avec ligne ou quantité, instantané fiscal, commission, reçu corrigé, auteur et continuité de la partie non remboursée ;
- aucune commande payée n'est perdue et aucun double débit, mauvais montant, mauvaise table ou action hors droit n'est constaté ;
- au moins 95 % des commandes payées apparaissent dans la vue métier attendue en moins de 5 secondes ;
- chaque reprise après coupure rattrape les commandes manquées et indique clairement la période de données potentiellement périmées ; une panne injectée de tous les réceptionnaires force la pause, l'alerte secondaire et le traitement de chaque commande payée dans la fenêtre ; la veille écran, l'arrière-plan mobile et un changement de réseau font partie du test ;
- chaque commande payée est acceptée ou remboursée avant le délai maximal configuré, et le délai paiement vers acceptation est mesuré séparément du délai paiement vers affichage ;
- au moins huit établissements sur dix publient une modification de carte, gèrent une rupture, régénèrent un QR code et exportent la carte imprimable sans intervention de Surplasse ;
- les trois établissements à emporter configurent une capacité, reçoivent et retirent des commandes sur plusieurs créneaux sans survente imputable à Surplasse ; chacun observe au moins un SMS « Prête » remis et un échec fournisseur injecté, visible puis récupéré sans perte silencieuse ;
- les deux exploitants multi-établissements basculent de contexte sans mélange d'alerte, de commande, de droit ni de donnée financière ;
- l'export est importé ou rapproché sans retraitement manuel structurel par les comptables d'au moins trois établissements ;
- aucun incident P0 ou P1 ne reste ouvert à la fin de la période.

Un incident P0 désigne une perte ou duplication de commande payée, un débit erroné, une fuite inter-établissements, une action financière hors droit ou une indisponibilité générale du canal pendant un service. Un incident P1 bloque la préparation, le service, la publication de la carte ou le rapprochement d'un établissement sans contournement sûr dans Surplasse.

Un échec révèle soit une lacune commune à remettre dans le socle, soit une demande propre à un segment qui doit rester une extension. La décision se prend sur les observations de service, pas sur le nombre de demandes formulées hors contexte. Une cohorte plus large reste nécessaire avant de présenter ce résultat comme une couverture confirmée du marché.
