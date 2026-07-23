---
label: Fonctionnalités
order: 30
icon: checklist
description: La carte fonctionnelle complète de Surplasse, priorisée selon la méthode MoSCoW ; la roadmap fixe l'ordre de livraison.
---

# Fonctionnalités

Cette page recense toutes les fonctionnalités du produit, organisées par domaine fonctionnel et priorisées selon la méthode MoSCoW. La priorité dit l'importance intrinsèque d'une fonctionnalité pour le produit cible ; elle ne dit pas quand elle est livrée. L'ordre de livraison, lui, est fixé par la [roadmap](../roadmap.md), seule source du séquencement et de la définition du premier MVP livrable.

Le produit est en phase 2 : le Backend et Commande couvrent déjà la carte, le panier, le paiement et le suivi. Cette page reste la carte fonctionnelle du produit cible ; la [roadmap](../roadmap.md) indique précisément ce qui est livré, en cours ou futur. Les pages [vision](vision.md) et [personas](personas.md) donnent le pourquoi ; les [parcours détaillés](parcours/onboarding-restaurateur.md) donnent le comment, pas à pas.

## Méthode de priorisation

| Priorité | Signification |
|---|---|
| **Must** | Indispensable à la promesse du produit. Sans elle, le produit ne remplit pas sa promesse de base. |
| **Should** | Importante, attendue dans sa phase cible, mais le produit fonctionne sans elle. |
| **Could** | Souhaitable si le coût est faible. Première variable d'ajustement du planning. |
| **Won't** | Explicitement exclue de la roadmap actuelle. La mention n'exclut pas une version ultérieure. |

La colonne « Applications » utilise les noms canoniques : Onboarding, Commande, Dashboard, Backend. Le Backend est cité quand la fonctionnalité exige une logique métier ou une persistance qui lui est propre, c'est-à-dire presque toujours. Le moment de livraison de chaque fonctionnalité se lit dans la [roadmap](../roadmap.md) : la priorité dit l'importance, la phase dit le moment.

!!! info Une liste fermée
La priorisation ci-dessous fait foi. Ajouter une fonctionnalité au périmètre Must exige de mettre à jour cette page et la [roadmap](../roadmap.md) dans le même commit.
!!!

## 1. Embarquement et génération IA

Le cœur de la promesse : un restaurateur passe d'une photo de sa carte à un mini-site commandable en quelques minutes. L'extraction s'appuie sur l'API OpenAI (vision), conformément à la [stack de référence](../architecture/index.md).

| Fonctionnalité | Description | Priorité | Applications |
|---|---|---|---|
| Extraction de carte depuis photo | Le restaurateur photographie sa carte papier ; l'IA en extrait catégories, produits, options et prix sous forme structurée. | Must | Onboarding, Backend |
| Relecture et correction de l'extraction | Avant activation, le restaurateur vérifie et corrige le résultat de l'extraction dans une interface d'édition simple. | Must | Onboarding |
| Génération du mini-site | À partir des données extraites et de quelques photos, Surplasse génère le mini-site public de l'établissement sur `{slug}.surplasse.com`. | Must | Onboarding, Commande, Backend |
| Activation du compte par magic link | Le restaurateur active son compte et accède au Dashboard via un lien envoyé par email, sans mot de passe. | Must | Onboarding, Dashboard, Backend |
| Thème visuel extrait | L'IA dérive une palette de couleurs et une ambiance typographique depuis le logo et les photos fournies, pour que le mini-site ressemble au restaurant. | Should | Onboarding, Commande, Backend |
| Harmonisation des photos de plats | Les photos de plats fournies par le restaurateur sont harmonisées par un traitement d'image serveur (cadrage, normalisation de la lumière, miniatures) pour un rendu homogène sur la carte, pendant l'embarquement comme lors des mises à jour. | Should | Onboarding, Dashboard, Backend |
| Premier choix de visuels de plats | Pendant l'embarquement, l'IA produit à partir de la photo du plat réel des visuels candidats privés. Le restaurateur choisit la photo fournie, un rendu généré ou aucune image ; rien n'est publié automatiquement. Sources maîtrisées uniquement, jamais de photos de tiers. Voir [ADR-0025](../decisions/adr-0025-visuels-plats-a-la-demande.md). | Must | Onboarding, Backend |

## 2. Espaces à revendiquer

Le moteur d'acquisition : Surplasse pré-génère des espaces pour des établissements identifiés à partir de données publiques. Le restaurateur découvre que son espace existe déjà et n'a plus qu'à le revendiquer. La revendication est décrite comme variante du [parcours d'embarquement](parcours/onboarding-restaurateur.md).

| Fonctionnalité | Description | Priorité | Applications |
|---|---|---|---|
| Pré-génération depuis données publiques | Des espaces sont créés automatiquement pour des établissements identifiés en ligne (nom, adresse, type de cuisine), enrichis par IA. | Should | Backend |
| Recherche de son établissement | Depuis la vitrine Onboarding, un restaurateur cherche son établissement par nom et ville et découvre son espace pré-généré. | Should | Onboarding, Backend |
| Revendication | Le restaurateur prouve qu'il est bien le propriétaire (vérification par email ou téléphone de l'établissement) et prend possession de son espace. | Should | Onboarding, Backend |

!!! warning Périmètre volontairement tardif
Les espaces à revendiquer sont un levier de croissance, pas une condition de la promesse produit. Ils arrivent en phase 5 de la [roadmap](../roadmap.md), une fois l'embarquement direct et le pilotage éprouvés.
!!!

## 3. Carte numérique

La carte est la donnée centrale du produit : ce que le client consulte côté Commande, ce que le restaurateur édite côté Dashboard. Sa structure exacte est définie dans le [modèle de données](../architecture/donnees.md).

| Fonctionnalité | Description | Priorité | Applications |
|---|---|---|---|
| Catégories et produits | La carte est organisée en catégories ordonnées (entrées, plats, desserts, boissons) contenant des produits avec nom, description, photo et prix. | Must | Commande, Dashboard, Backend |
| Image par produit | Pour chaque produit, le restaurateur choisit son image depuis le Dashboard : téléverser, recadrer, remplacer ou retirer sa propre photo, ou n'afficher aucune image. | Must | Dashboard, Backend |
| Rendus IA récurrents | Après l'embarquement, le restaurateur peut demander depuis une photo réelle de nouveaux rendus candidats, les comparer et en retenir un explicitement. Cette extension ne bloque pas la cohorte de preuve. | Should | Dashboard, Backend |
| Options de produits | Un produit porte des options : variantes exclusives (cuisson, taille) ou suppléments cumulables, avec impact sur le prix. | Must | Commande, Dashboard, Backend |
| Édition de la carte | Le restaurateur modifie la carte depuis le Dashboard : ajout, retrait, réorganisation et changement de prix, sans intervention de Surplasse. | Must | Dashboard, Backend |
| Disponibilités | Un produit peut être marqué indisponible en un geste (rupture du jour) ; il reste visible ou masqué selon le choix du restaurateur. | Must | Commande, Dashboard, Backend |
| Horaires | L'établissement définit ses horaires d'ouverture et ses plages de commande ; hors plage, la carte reste consultable mais la commande est fermée. | Must | Commande, Dashboard, Backend |
| Publication versionnée | Une rupture est immédiate ; les changements structurels passent par un brouillon, une prévisualisation mobile et une publication atomique. Une version publiée peut être restaurée sans modifier les commandes passées. | Must | Dashboard, Commande, Backend |
| Profils de présentation | Le restaurateur choisit Compact, Équilibré ou Visuel, règle la politique d'images et prévisualise la carte. Les contraintes d'accessibilité, de prix, de navigation et de performance ne sont pas désactivables. | Must | Onboarding, Commande, Dashboard, Backend |
| Menus et formules | Des produits composés à prix fixe avec choix par étape. Les choix restent regroupés et ordonnés sur un ticket unique ; le socle ne pilote pas l'envoi séparé de chaque service. | Must | Commande, Dashboard, Backend |
| Informations réglementaires | Chaque produit peut porter les allergènes déclarés, régimes, origine et mentions applicables. Le restaurateur les renseigne ou les valide ; l'IA ne déduit jamais seule une information juridique. | Must | Onboarding, Commande, Dashboard, Backend |

## 4. Commande

Le parcours client, sans application ni compte : scanner, choisir, payer. Les enchaînements précis sont décrits dans [le parcours de commande](parcours/commande-client.md).

| Fonctionnalité | Description | Priorité | Applications |
|---|---|---|---|
| Commande sur place via QR par table | Chaque table porte un QR code qui ouvre la carte avec le numéro de table pré-rempli ; la commande arrive en cuisine rattachée à la table. | Must | Commande, Backend |
| Panier | Le client compose son panier (produits, options, quantités, remarque libre) avant de valider ; le panier survit à un rechargement de page. | Must | Commande |
| Statuts de commande | Le client suit sa commande en temps réel : payée, acceptée, en préparation, prête, servie ou retirée. | Must | Commande, Backend |
| Commande à emporter | Le client commande depuis le mini-site sans être sur place, choisit un créneau de retrait encore disponible et reçoit un SMS lorsque la commande est prête. | Must | Commande, Backend |
| Rappel de commande | Le client retrouve sa commande en cours via un lien, sans compte, pour en suivre le statut ou montrer le récapitulatif. | Must | Commande, Backend |
| Proposition de commande assistée | Un membre en salle enregistre une proposition liée à la table. Son ouverture hydrate un nouveau panier côté client, sans réserver le stock ni faire foi sur le prix. Le client le relit et le paie en ligne ; seule la commande payée entre en cuisine. La pré-cohorte décide si elle devient Must avant la preuve formelle. | Should | Dashboard, Commande, Backend |

## 5. Paiement

Le paiement est intégré à la commande, via Stripe. Le client paie depuis son téléphone, le restaurateur encaisse sans terminal supplémentaire. L'intégration est détaillée dans [les intégrations](../architecture/integrations.md).

| Fonctionnalité | Description | Priorité | Applications |
|---|---|---|---|
| Paiement CB via Stripe | Paiement par carte bancaire au moment de la validation de la commande, sans création de compte client. | Must | Commande, Backend |
| Apple Pay et Google Pay | Paiement en un geste via les portefeuilles natifs, servis par la même intégration Stripe. | Must | Commande, Backend |
| Pourboire numérique | Après le service, le client peut laisser un pourboire par un paiement Stripe distinct, avec pourcentages suggérés ou montant libre, reversé à l'établissement. | Should | Commande, Backend |
| Remboursement intégral | Le restaurateur ou un responsable rembourse intégralement une commande depuis le Dashboard, avec motif, idempotence et rapprochement Stripe. | Must | Dashboard, Backend |
| Remboursement partiel | Le restaurateur ou un responsable rembourse une ligne ou une quantité, avec motif, auteur, reçu mis à jour et restitution cohérente de la commission. Un ADR précède son implémentation. | Must | Dashboard, Backend |
| PayPal | Paiement via PayPal. Exclu du MVP : Stripe couvre les moyens de paiement dominants ; PayPal est en roadmap. | Won't | Commande, Backend |

## 6. Temps réel et cuisine

La commande doit arriver côté restaurant sans délai perceptible et sans matériel imposé. Le temps réel passe par SSE, conformément au [choix d'architecture](../architecture/backend.md).

| Fonctionnalité | Description | Priorité | Applications |
|---|---|---|---|
| Flux SSE des commandes | Le Dashboard reçoit les nouvelles commandes et les changements de statut en temps réel via un flux SSE, avec reconnexion automatique. | Must | Dashboard, Backend |
| Acceptation ou refus | Un membre autorisé accepte ou refuse chaque commande déjà payée. Un refus avant acceptation déclenche un remboursement intégral contraint et l'information du client. | Must | Dashboard, Backend |
| Avancement de commande | Le restaurateur fait progresser la commande (en préparation, prête, servie ou retirée) ; le client voit chaque changement. | Must | Dashboard, Commande, Backend |
| Vues métier Salle et Cuisine | Le même Dashboard présente une vue Salle centrée sur les tables et le service, et une vue Cuisine centrée sur l'ancienneté, les options, les allergènes et la préparation. | Must | Dashboard, Backend |
| Alerte sonore et visuelle | Une nouvelle commande déclenche une alerte sonore et visuelle testable. Son âge, l'état SSE et la relance avant acquittement restent visibles dans un environnement bruyant. | Must | Dashboard |
| Rappel d'un ticket | La vue Cuisine permet de remettre immédiatement le dernier ticket passé à « Prête » par la même session en « En préparation », tant qu'il n'est ni servi ni retiré, avec une action tracée. À emporter, la fenêtre dure cinq secondes et annule le SMS encore en attente ; après le début possible de l'envoi, le traitement d'incident prend le relais. | Must | Dashboard, Backend |
| Sécurité de réception | Tant que la prise de commandes est ouverte, au moins une session testée, explicitement armée et capable d'accepter confirme qu'elle reçoit le flux. Un poste Cuisine seul ne suffit pas. La perte de tous les réceptionnaires force une pause, une alerte secondaire et le traitement borné des commandes payées dans l'intervalle. | Must | Dashboard, Backend |
| Routage simple par poste | Les produits peuvent être routés vers deux ou trois files spécialisées, par exemple bar, chaud ou froid. La pré-cohorte décide s'il devient Must avant la preuve formelle. | Should | Dashboard, Backend |
| Imprimante thermique | Impression optionnelle d'un ticket cuisine sur une liste courte d'imprimantes ESC/POS à chaque commande acceptée. La pré-cohorte décide si elle devient Must ; le protocole d'intégration reste à trancher par ADR. | Should | Dashboard, Backend |

## 7. Engagement client

Le restaurant garde la relation client : Surplasse fournit les outils, jamais l'intermédiation. Aucune de ces fonctionnalités ne conditionne le MVP.

| Fonctionnalité | Description | Priorité | Applications |
|---|---|---|---|
| Avis post-repas | Après la commande, le client est invité à laisser une note et un commentaire privés, visibles du seul restaurateur. | Should | Commande, Dashboard, Backend |
| Incitation aux avis publics | Un client satisfait (note élevée) est invité à publier son avis sur les plateformes publiques ; un client insatisfait est orienté vers un échange direct. | Could | Commande, Backend |
| Opt-in marketing | Le client peut laisser son email pour recevoir les actualités de l'établissement ; la liste appartient au restaurateur. | Should | Commande, Dashboard, Backend |
| Fidélité | Programme de fidélité simple (nombre de commandes, récompense) sans compte client obligatoire. | Could | Commande, Dashboard, Backend |

## 8. QR codes physiques

Le pont entre la salle et le numérique. Chaque table a son QR code, généré par établissement et par table.

| Fonctionnalité | Description | Priorité | Applications |
|---|---|---|---|
| Génération des QR codes | Le Dashboard génère les QR codes par table et par établissement, exportables en PDF prêt à imprimer. | Must | Dashboard, Backend |
| Carte papier synchronisée | Le Dashboard exporte la carte publiée en PDF daté, avec prix TTC et informations réglementaires. Il signale quand une version imprimée est devenue obsolète. | Must | Dashboard, Backend |
| Stickers et sous-verres gratuits | À l'activation, l'établissement reçoit gratuitement par courrier un jeu de stickers et de sous-verres imprimés avec ses QR codes. | Should | Dashboard, Backend |
| Supports premium | Commande de supports de qualité supérieure (chevalets, plaques gravées) depuis le Dashboard, facturés à prix coûtant majoré. | Could | Dashboard, Backend |

## 9. Équipe et accès

Le restaurateur donne à chacun l'accès nécessaire sans partager son magic link. Le modèle cible est fixé dans l'[ADR-0031](../decisions/adr-0031-equipes-roles-vues-metier.md).

| Fonctionnalité | Description | Priorité | Applications |
|---|---|---|---|
| Appartenances par établissement | Une personne appartient à un ou plusieurs établissements, avec un rôle propre à chacun. | Must | Dashboard, Backend |
| Rôles fixes | Quatre rôles initiaux, `owner`, `manager`, `service`, `kitchen`, autorisent les actions côté Backend selon une matrice commune. | Must | Dashboard, Backend |
| Invitations et révocation | Un administrateur invite un membre par email, choisit son rôle et peut révoquer immédiatement ses sessions. | Must | Dashboard, Backend |
| Postes partagés | Une tablette Salle ou Cuisine est appairée par code temporaire, limitée à un établissement, expirante et révocable à distance. | Must | Dashboard, Backend |
| Journal d'activité | Les changements de droits, remboursements, pauses, publications et changements de prix portent un auteur, une date et un résultat. | Must | Dashboard, Backend |
| Permissions personnalisées | Le restaurateur compose librement chaque droit d'un rôle. Trop complexe pour le socle professionnel. | Won't | Dashboard, Backend |

## 10. Gestion, finances et métriques

Le Dashboard donne au restaurateur une lecture simple de son activité, sans jargon analytique.

| Fonctionnalité | Description | Priorité | Applications |
|---|---|---|---|
| Vue du service en cours | Ventes brutes Surplasse TTC, remboursements, nombre de commandes payées et temps de préparation moyen du service, en temps réel. | Must | Dashboard, Backend |
| Historique des commandes | Liste consultable et filtrable de toutes les commandes passées, avec détail et statut de paiement. | Must | Dashboard, Backend |
| Registre financier | Chaque paiement montre brut, remboursements, commission Surplasse, frais Stripe disponibles, net et identifiants de rapprochement. Le pourboire apparaît séparément lorsque la phase 5 est active. | Must | Dashboard, Backend |
| Paiements et versements Stripe | Les composants Connect intégrés donnent accès aux paiements, versements, litiges, documents, rapports, exigences KYC et remédiation du compte, sans Dashboard Stripe séparé. Leurs fonctions sont limitées selon le rôle et ne contournent jamais un workflow Surplasse. | Must | Dashboard, Backend |
| Rapprochement de fin de service | Le restaurateur explique les ventes Surplasse, remboursements, net attendu, versements et écarts sans requête manuelle en base. | Must | Dashboard, Backend |
| Export comptable | Export CSV des ventes Surplasse, taxes configurées, remboursements, frais et identifiants de rapprochement sur une période. | Must | Dashboard, Backend |
| Analyse de période | Ventes Surplasse TTC, nombre de commandes et panier moyen par jour, semaine ou mois, avec comparaison à la période précédente et répartition par service configuré. | Should | Dashboard, Backend |
| Top produits | Deux classements des produits sur une période, par quantités vendues et par ventes générées dans Surplasse, pour éclairer les choix de carte. | Should | Dashboard, Backend |
| Heures de pointe | Répartition des commandes par jour et par heure, pour ajuster les équipes et les stocks. | Could | Dashboard, Backend |
| Répartition par canal | Part des commandes sur place et à emporter, en nombre de commandes, lorsque l'à emporter est actif. | Should | Dashboard, Backend |
| Multi-établissements | Un restaurateur gère jusqu'à trois établissements depuis le même compte, avec bascule et droits propres dans le Dashboard. | Must | Dashboard, Backend |

## 11. Transverse

Exigences qui traversent toutes les applications et ne se négocient pas fonctionnalité par fonctionnalité.

| Fonctionnalité | Description | Priorité | Applications |
|---|---|---|---|
| Accessibilité | Les interfaces client visent la conformité WCAG 2.2 niveau AA : la carte et la commande doivent être utilisables par tous, y compris au lecteur d'écran. | Must | Onboarding, Commande, Dashboard |
| RGPD | Minimisation des données, pas de compte client, consentements explicites, droits d'accès et d'effacement outillés. Détail dans [la page RGPD](../operations/rgpd.md). | Must | Toutes |
| Multilingue de la carte | Traduction automatique de la carte (anglais en premier), activable par le restaurateur, avec relecture possible. | Could | Commande, Dashboard, Backend |
| Performance mobile | Le mini-site se charge vite sur un réseau mobile moyen : la carte doit être consultable en moins de 2 secondes sur un réseau 4G. | Must | Commande |
| Préparation au service | Avant chaque ouverture, une checklist vérifie carte, horaires, tables, QR codes, Stripe, son, réseau et au moins une session de réception capable d'accepter. Une commande et un remboursement de test sont exercés à l'activation puis après un changement critique, pas avant chaque service. | Must | Onboarding, Dashboard, Backend |
| Frontière avec la caisse | Surplasse ne marque jamais manuellement une commande payée et n'enregistre aucun règlement externe dans le socle professionnel. | Must | Dashboard, Backend |

## Du Must au premier MVP livrable

Toutes les fonctionnalités Must ci-dessus sont indispensables au produit *fini*, mais elles ne sont pas livrées en même temps. Le premier MVP réellement mis entre les mains d'un restaurateur pilote correspond à la **phase 2** de la [roadmap](../roadmap.md) : commander et payer, avec une carte saisie à la main.

| Fonctionnalité Must | Phase de la roadmap |
|---|---|
| Carte numérique du pilote (catégories, produits et options) | Phase 2, saisie à la main |
| Commande sur place via QR par table, panier, rappel de commande | Phase 2 |
| Paiement CB, Apple Pay et Google Pay via Stripe | Phase 2 |
| Flux SSE des commandes, acceptation ou refus, avancement | Phase 2 |
| QR codes du pilote | Phase 2, provisionnés par Surplasse ; gestion autonome en phase 4 |
| Activation du compte par magic link | Phase 2 |
| Extraction de carte depuis photo, relecture et correction | Phase 3 |
| Génération et choix initial des visuels de plats | Phase 3 pendant l'embarquement ; gestion des photos en phase 4, nouvelle génération récurrente Should après la preuve |
| Génération du mini-site, profil initial, informations réglementaires et premier PDF | Phase 3 |
| Équipe, rôles, postes partagés et vues métier | Phase 4 |
| Édition versionnée, formules, mise à jour des informations réglementaires, profils visuels et obsolescence de la carte papier | Phase 4 |
| Historique, remboursement partiel, surfaces Stripe, rapprochement et export | Phase 4 |
| Emporter, sécurité de réception et multi-établissements | Phase 4 |
| Accessibilité, RGPD, performance mobile | Transverse, dès la phase 2 |

En une phrase : la phase 2 qualifie le noyau dans un pilote, la phase 3 industrialise l'embarquement depuis une photo, et la phase 4 transforme ce canal en outil exploitable chaque jour par une équipe et rapprochable par le restaurateur.

!!! info Le contrat suit le périmètre
Chaque fonctionnalité Must correspondra à des opérations décrites dans le contrat OpenAPI (`api/openapi.yaml`) avant son implémentation. Le contrat reste la source de vérité de l'API. Voir [la page API](../architecture/api.md).
!!!

## Pour aller plus loin

Les fonctionnalités décrivent le quoi ; les parcours décrivent le comment, écran par écran :

- [L'embarquement](parcours/onboarding-restaurateur.md) : de la photo de la carte au mini-site actif, revendication d'un espace pré-généré comprise
- [La commande](parcours/commande-client.md) : du scan du QR code au plat servi
- [Le Dashboard](parcours/dashboard-restaurateur.md) : le quotidien du restaurateur, du service à l'analyse

Pour les définitions des termes employés ici, voir le [glossaire](../glossaire.md).
