---
label: Roadmap
order: 60
icon: milestone
description: L'ordre d'attaque du projet Surplasse, phase par phase, avec les critères de sortie et les risques identifiés.
---

# Roadmap

Cette page décrit la trajectoire du projet Surplasse, de la documentation fondatrice jusqu'à la relation client fidélisée. Chaque phase a un objectif unique, des livrables identifiés et un critère de sortie observable. Une phase n'est terminée que lorsque son critère de sortie est atteint, pas lorsque ses livrables sont « à peu près là ».

!!! warning Un ordre d'attaque, pas un calendrier contractuel
Les phases décrivent dans quel ordre les problèmes sont attaqués, pas quand ils seront résolus. Les dates mentionnées sont indicatives et revues en continu. Seul le critère de sortie de chaque phase fait foi pour décider de passer à la suivante.
!!!

## Vue d'ensemble

| Phase | Nom | Objectif | Critère de sortie |
|---|---|---|---|
| 0 | Fondations | Poser une documentation de référence complète avant la première ligne de code | La doc est publiée et fait référence |
| 1 | Le contrat et les squelettes | Établir le contrat OpenAPI et les squelettes générés des applications | Une carte statique de démonstration s'affiche de bout en bout depuis l'API |
| 2 | Commander et payer | Faire fonctionner le cœur du produit dans un vrai restaurant | Un service du midi réel géré via Surplasse dans un restaurant pilote |
| 3 | L'embarquement magique | Automatiser la création d'un établissement depuis une photo de la carte | Un restaurateur inconnu de l'équipe s'embarque seul en moins de 30 minutes |
| 4 | Exploiter et piloter | Rendre Surplasse utilisable chaque jour par une équipe et rapprochable par le restaurateur | Au moins 80 % d'une cohorte cible exploite le socle professionnel pendant quatre semaines sans contournement bloquant |
| 5 | La relation | Transformer les commandes en relation client durable | Un restaurant convertit des commandes en clients fidèles identifiés |

Les fonctionnalités visées par chaque phase sont détaillées dans [le catalogue des fonctionnalités](produit/fonctionnalites.md). Les choix structurants pris en chemin sont consignés dans [les ADR](decisions/index.md).

## Le cap professionnel

La phase 2 et la phase 4 ne prouvent pas la même chose. La phase 2 qualifie le noyau sur un restaurant pilote, avec une carte et des accès préparés par Surplasse. La phase 3 prouve qu'un restaurateur peut créer ce canal seul. La phase 4 prouve qu'une équipe peut ensuite l'exploiter sans partager un compte, dépendre d'une intervention Surplasse ou découvrir un écart financier inexpliqué.

Le seuil de 80 % porte sur la cible explicite : indépendants de un à trois établissements, commandes Surplasse prépayées en ligne, service à table, comptoir ou à emporter, sans remplacement complet de la caisse. Il ne constitue pas une estimation de part de marché. La définition du périmètre, les exclusions et le protocole de preuve vivent dans le [socle professionnel](produit/socle-professionnel.md).

Deux décisions protègent cette trajectoire :

- un seul Dashboard avec des rôles par établissement et des vues métier Salle, Cuisine et Gestion, conformément à l'[ADR-0031](decisions/adr-0031-equipes-roles-vues-metier.md) ;
- un canal autonome pour les commandes payées en ligne, qui coexiste avec la caisse sans enregistrer les autres encaissements, conformément à l'[ADR-0032](decisions/adr-0032-canal-prepaye-sans-caisse.md).

## Phase 0 : Fondations

**Période indicative : juillet 2026. Statut : terminée le 2026-07-18.**

### Objectif

Écrire la cible avant de la construire. Cette phase produit la documentation de référence du projet : vision, parcours, architecture, conventions. Elle force les décisions à être explicites et discutables avant qu'elles ne coûtent cher à changer.

### Livrables

- Documentation Retype complète : produit, architecture, développement, opérations.
- Conventions de contribution (terminologie canonique, style, workflow git) dans `docs/AGENTS.md`.
- Premiers ADR pour les décisions déjà prises (stack, contract-first, monorepo).
- CI de la documentation : build Retype vérifié à chaque push, déploiement automatique sur GitHub Pages.

### Risques et parades

| Risque | Parade |
|---|---|
| La doc décrit un produit fantasmé, jamais confronté au réel | Chaque page distingue la cible de ce qui reste à trancher ; les phases suivantes corrigent la doc en continu |
| Sur-spécification : tout documenter avant de coder fige des choix prématurés | Les détails d'implémentation restent ouverts ; seuls les invariants (terminologie, contrat, architecture) sont fixés |
| La doc diverge du code dès que le code existe | Le workflow impose de mettre à jour la page concernée dans le même commit que le changement |

### Exclusions explicites

- Durant cette phase terminée, le backend, les frontends et le contrat OpenAPI restaient hors périmètre.
- Aucune maquette graphique ni charte visuelle définitive.

### Critère de sortie

La documentation est publiée, couvre l'ensemble de l'arborescence prévue, et sert effectivement de référence : toute question sur le produit ou l'architecture trouve sa réponse dans une page.

## Phase 1 : Le contrat et les squelettes

**Statut : terminée le 2026-07-18.** Critère de sortie constaté : la carte de démonstration s'affiche de bout en bout, de PostgreSQL au front Commande via l'API conforme au contrat et le client généré.

### Objectif

Matérialiser l'approche contract-first. Le contrat `api/openapi.yaml` naît avec ses deux premiers domaines (catalogue et commande), la génération outillée produit les interfaces Java côté backend et le client TypeScript côté frontends, et les squelettes des applications prennent forme autour de lui.

### Livrables

- Première version du contrat : domaines catalogue (la carte, les produits, les options) et commande.
- Chaîne de génération outillée : interfaces Java pour le Backend, client TypeScript dans `frontends/shared/`.
- Squelette Backend Quarkus (Maven multi-modules, PostgreSQL, Flyway, premiers endpoints du catalogue).
- Squelette du front Commande (React, Vite, TanStack Query) consommant le client généré.
- Package `frontends/shared/` : client API généré, premières briques du design system.
- CI de tests : le backend et les frontends sont testés à chaque push, la génération est vérifiée contre le contrat.

### Risques et parades

| Risque | Parade |
|---|---|
| Le contrat est mal découpé et devra être cassé tôt | Ne couvrir que catalogue et commande ; versionner le contrat dès le départ et assumer les ruptures tant qu'aucun client externe n'existe |
| L'outillage de génération devient un projet en soi | Choisir des générateurs éprouvés du monde OpenAPI, consigner le choix dans un ADR, ne rien écrire de custom en phase 1 |
| Les squelettes accumulent du code mort « pour plus tard » | Chaque module créé doit servir le critère de sortie ; le reste attend sa phase |

### Exclusions explicites

- Pas de paiement, pas d'authentification, pas de temps réel.
- Pas de front Onboarding ni de Dashboard.
- Pas de saisie de carte : la carte de démonstration est chargée par migration Flyway.

### Critère de sortie

Une carte statique de démonstration s'affiche de bout en bout : les données sortent de PostgreSQL, transitent par l'API du Backend conformément au contrat, et sont rendues par le front Commande via le client généré.

## Phase 2 : Commander et payer

**Statut : en cours depuis le 2026-07-18.**

### Objectif

Le vrai MVP. Un établissement pilote, une carte saisie à la main, des clients réels qui scannent le QR code à table, commandent et paient. Le restaurateur voit les commandes arriver et les accepte. Tout le reste du produit existe pour rendre ce moment possible.

!!! info Pourquoi une carte saisie à la main
L'extraction par IA arrive en phase 3. En phase 2, la carte du pilote est saisie par l'équipe via une migration, un seed contrôlé ou un outil interne répétable, jamais par une modification improvisée de la production. Le sujet de cette phase est le flux de commande et de paiement, pas l'embarquement.
!!!

### Livrables

- Carte complète de l'établissement pilote, saisie à la main.
- Commande sur place par QR code : scan à table, panier, validation, numéro de table.
- Paiement Stripe intégré au front Commande : noyau sécurisé en mode test, compte Connect Accounts v2 du pilote provisionné manuellement, puis live sur un périmètre fermé avant le service pilote.
- Dashboard minimal : flux SSE des commandes entrantes, acceptation des commandes, authentification du restaurateur par magic link.
- Contrôle opérationnel persistant : ouverture ou pause des nouvelles sessions de table, commandes et sessions de paiement, sans couper le suivi existant.
- Boucle de retour avec le restaurateur pilote : observations de service, irritants, demandes.

### État de livraison au 2026-07-20

Le flux client local couvre déjà le scan du QR code, la carte, le panier, la création de commande, le paiement en environnement de test et le suivi. L'identité restaurateur couvre le magic link, les cookies de session, la rotation du refresh token et l'autorisation par établissement. Le Backend expose la file paginée des commandes opérationnelles, leur avancement authentifié et un flux SSE par établissement avec rejeu par `Last-Event-ID`. Le Dashboard consomme cette lecture REST après une connexion par magic link, permet de sélectionner un établissement autorisé, fait avancer chaque commande de `paid` à `served` ou `picked_up` selon son type et resynchronise sa file à chaque événement SSE.

Le Dashboard minimal de cette phase est livré localement, y compris l'indicateur permanent de connexion temps réel. Les deux durcissements navigateur sont livrés. Quarkus refuse toujours les credentials CORS et Caddy les accorde seulement aux origines exactes du Dashboard et de l'Onboarding. Le Dashboard sérialise la rotation du refresh token entre onglets avec Web Locks, propage l'état par BroadcastChannel et force une nouvelle connexion si le verrou n'est pas disponible. Les tests couvrent ces branches et un scénario réel à deux onglets a confirmé une seule rotation effective.

Le noyau paiement local refuse désormais de rendre une session à une autre session de table, persiste et rejoue les clés d'idempotence, transmet la même clé au SDK Stripe, conserve un Payment Intent retentable après un moyen de paiement refusé et rend atomiques la confirmation du paiement, le passage de la commande à `paid` et son événement persistant. Les migrations et les tests d'intégration PostgreSQL couvrent ces garanties.

Le remboursement intégral est livré localement selon l'[ADR-0022](decisions/adr-0022-remboursement-integral-stripe.md). Le Dashboard permet de refuser une nouvelle commande payée ou de rembourser une commande en cours avec un motif. Le Backend réserve l'intention et sa clé avant Stripe, reprend le compte Connect de la charge directe, restitue la commission Surplasse lorsqu'elle existe, rapproche les événements de remboursement et ne passe la commande à `refunded` qu'après un succès confirmé. Une tentative active bloque simultanément l'avancement en cuisine. Le contrat, la migration V14 et les tests unitaires couvrent l'idempotence, les réponses réseau ambiguës, les événements dupliqués et les comptes incorrects. La qualification contre le compte Stripe test réel reste bloquée par son embarquement incomplet.

Le chemin logiciel des charges directes est maintenant livré localement. L'établissement porte son compte connecté et sa date d'activation. Chaque paiement fige ce compte et la commission, le SDK Stripe reçoit le contexte `Stripe-Account`, Commande initialise Stripe.js avec le même compte, et le webhook exige le couple compte connecté et Payment Intent ainsi que le bon mode `livemode`. La période gratuite omet `application_fee_amount`, donc la commission Surplasse uniquement. Les frais Stripe restent dus dès le premier paiement. Après trois mois calendaires, le Backend calcule 1 % en centimes avec un arrondi inférieur.

Le contrôle opérationnel de prise de commandes est lui aussi livré localement. Un état persistant `open` ou `paused`, distinct de `Establishment.status`, ferme ensemble les nouvelles sessions de table, commandes et sessions de paiement. L'admission et la pause sont sérialisées sur l'établissement. Les commandes existantes, leur suivi, les flux SSE, le Dashboard et les webhooks restent actifs. Une perte de la capacité Accounts v2 `card_payments` force `paused` et aucune récupération Stripe ne rouvre automatiquement le service. Le contrat expose l'état configuré, `acceptingOrders` et le `blockedReason` effectif. La frontière et le contrôle Accounts v2 sont fixés par l'[ADR-0020](decisions/adr-0020-accounts-v2-onboarding-embarque.md).

La plateforme test est inscrite à Connect. Le premier compte du Cormoran avec `dashboard=full` est abandonné après que son formulaire hébergé a révélé une friction de compte Stripe autonome. Stripe a créé le nouveau compte Accounts v2 `acct_1TvOQECvIDZfXjyu` pour le pilote fictif La Paprika. Sa configuration marchand utilise `dashboard=none`, avec les frais, pertes et exigences collectés par Stripe. Une page Surplasse locale rend maintenant le composant `account_onboarding` en français à partir d'une session courte créée côté serveur. Les capacités `card_payments` et `stripe_balance.payouts` restent `restricted` tant que le titulaire n'a pas terminé les informations réglementaires et l'acceptation Stripe. Le Backend lit ces états Accounts v2 avant chaque paiement et après les événements de compte. Le contrat et le Backend séparent aussi les événements snapshot de paiement et remboursement des événements fins Accounts v2 sur deux endpoints et deux secrets. La charge directe réelle, la création des deux destinations Stripe, la qualification du remboursement et celle de la pause restent non livrées. La porte 1 demeure No-Go, avec le détail dans la [preuve Stripe Connect](operations/preuve-stripe-connect-2026-07-20.md).

Le socle de la porte 2 est livré et exercé localement selon l'[ADR-0026](decisions/adr-0026-compose-commun.md). Un Compose commun, deux surcharges explicites et un seul routage Caddy assemblent PostgreSQL, le Backend et les trois fronts avec les profils `development` et `production`. Les images de production sont isolées du domaine local et les mises à jour sont prévues par SHA immuable. Les smokes Playwright et leur historique Allure 3 sont livrés selon l'[ADR-0027](decisions/adr-0027-playwright-allure-3.md) : ils passent sur le cluster local et le workflow horaire restera fermé jusqu'au premier déploiement public. La première chaîne de métriques est elle aussi livrée selon l'[ADR-0029](decisions/adr-0029-observabilite-prometheus-grafana.md) : Micrometer, Prometheus, Grafana, règles et tableau de bord versionné s'exécutent dans un profil facultatif, sans dépendance du Backend vers sa supervision. La porte n'est pas encore franchie : le fournisseur DNS et son module Caddy, le SMTP transactionnel, les images GHCR et leur automatisation, les CSP de Commande et du Dashboard, la sauvegarde hors site, la restauration prouvée, la sonde externe avec son canal d'alerte et le VPS restent à provisionner selon le [runbook Compose](operations/deploiement-compose.md).

La phase suit désormais des portes explicites, détaillées dans le [runbook pilote](operations/pilote.md) :

| Ordre | Porte | Résultat attendu |
|---|---|---|
| 1 | Stripe Connect en test | Compte Accounts v2 pilote activé, charges directes, commission correcte, remboursement et mise en pause qualifiés avec Stripe réel |
| 2 | Production prête | Pile Ubuntu LTS déployable, restaurable, supervisée et fermée par défaut |
| 3 | Live fermé | Une transaction réelle de faible montant, rapprochée puis remboursée hors service |
| 4 | Service à blanc | Répétition complète sur matériel, QR et réseau du restaurant, sans public |
| 5 | Service réel contrôlé | Service mesuré, rapproché à 100 % et sans incident bloquant ni repli |

Le provisionnement manuel du compte Connect du seul pilote appartient donc à la phase 2. La qualification utilise déjà le composant Stripe intégré, tandis que l'automatisation de la création Accounts v2, du rattachement métier et de la reprise du KYC reste en phase 3. La prochaine action externe est de terminer l'embarquement intégré de La Paprika, puis d'activer les destinations d'événements et d'exécuter la matrice de paiement. La prochaine porte reste Stripe Connect en mode test, pas le live direct.

### Risques et parades

| Risque | Parade |
|---|---|
| Le produit casse en plein service et brûle la confiance du pilote | Franchir chaque porte Go ou No-Go, répéter le service à blanc en conditions réelles et garder le parcours habituel disponible |
| Le paiement en live expose à des obligations réglementaires mal anticipées | Valider le compte plateforme, le compte connecté pilote, les responsabilités et la tarification Stripe avant une transaction live fermée |
| Le réseau du restaurant est mauvais et le temps réel ne suit pas | Tester le SSE en conditions dégradées ; le Dashboard doit survivre à une reconnexion sans perdre de commande |
| Un mini-site compromis appelle l'API avec les cookies du restaurateur | Réserver les requêtes CORS avec credentials aux origines Dashboard et Onboarding explicitement autorisées ; traiter les mini-sites comme des origines publiques sans credentials |
| Deux onglets renouvellent la même session en même temps | Livré : sérialiser la rotation par Web Locks, relire la session sous verrou, diffuser son état par BroadcastChannel et échouer de manière sûre sans Web Locks ; tests unitaires et scénario réel à deux onglets |
| Le pilote demande des fonctionnalités hors périmètre | Tout noter, ne rien promettre : les demandes nourrissent les phases 4 et 5 |

### Exclusions explicites

- Pas d'extraction IA ni de génération de mini-site : phase 3.
- Pas d'à emporter : la commande est sur place uniquement.
- Pas de gestion de carte dans le Dashboard : les corrections passent par l'équipe.
- Pas de multi-établissements.

### Critère de sortie

Un service du midi réel est géré via Surplasse dans un restaurant pilote : de vrais clients commandent et paient depuis leur téléphone, le restaurateur travaille avec le Dashboard, toutes les commandes payées sont servies ou remboursées, le rapprochement Stripe, Paiement et Commande atteint 100 %, aucun double débit, mauvais montant, mauvais établissement, mauvaise table ou commande payée perdue n'est constaté, aucun incident P0 ou P1 ne reste ouvert et le service se termine sans repli sur le papier ou le terminal habituel.

## Phase 3 : L'embarquement magique

### Objectif

Faire disparaître le coût d'entrée. Un restaurateur photographie sa carte, Surplasse en extrait la structure par IA, génère le mini-site avec un thème, et le tunnel d'embarquement l'amène jusqu'à l'activation des paiements. C'est la promesse fondatrice du produit : un canal de commande directe sans projet informatique.

### Livrables

- Extraction IA de la carte depuis une photo (API OpenAI, vision) : catégories, produits, options, prix, avec écran de relecture et correction avant publication.
- Pour chaque plat photographié, harmonisation classique et génération facultative de visuels candidats par IA. Le restaurateur choisit explicitement la photo fournie, un rendu généré ou aucune image, sans publication automatique, conformément à l'[ADR-0025](decisions/adr-0025-visuels-plats-a-la-demande.md).
- Génération du mini-site de l'établissement avec choix d'un thème, **SEO compris** : chaque mini-site généré embarque son référencement (balises, données structurées schema.org du menu, sitemap) pour que chaque nouveau restaurant et sa carte soient indexables dès l'activation.
- Configuration initiale de l'établissement : fuseau horaire IANA, horaires, services nommés et profil de carte Compact, Équilibré ou Visuel, avec prévisualisation mobile.
- Saisie ou validation initiale des prix TTC, allergènes, origines et mentions applicables, puis premier PDF daté de la carte publiée. L'édition versionnée et le signalement d'obsolescence arrivent en phase 4.
- Automatisation de Stripe Connect Accounts v2 dans l'Onboarding : création du compte par le Backend, KYC et gestion des exigences dans les composants Connect intégrés, activation et reprise du parcours. Le schéma de charges directes a déjà été validé manuellement avec le pilote en phase 2.
- Tunnel d'embarquement complet dans le front Onboarding : de la photo de la carte à la première commande encaissable.

### Risques et parades

| Risque | Parade |
|---|---|
| L'extraction IA se trompe et publie des prix faux | La relecture par le restaurateur est une étape bloquante du tunnel ; rien n'est publié sans validation explicite |
| Les cartes réelles (manuscrites, plastifiées, mal éclairées) résistent à l'extraction | Constituer un jeu de photos de cartes réelles variées et mesurer le taux d'extraction correcte avant d'ouvrir le tunnel |
| Un visuel généré embellit ou invente le plat servi | Exiger une photo du plat réel dont le restaurateur détient les droits, garder les candidats privés et publier uniquement son choix explicite avec la mention « suggestion de présentation » |
| Le KYC Stripe bloque des restaurateurs en cours de tunnel | Placer l'activation Stripe en fin de tunnel, afficher les exigences via `notification_banner`, permettre de finir l'embarquement et d'y revenir ; documenter les pièces attendues |
| Le tunnel est magique en démonstration et frustrant en vrai | Le critère de sortie impose un test avec un restaurateur inconnu de l'équipe, sans assistance |

### Exclusions explicites

- Pas d'enrichissement automatique depuis les données publiques ni d'espaces pré-générés à revendiquer : la revendication arrive en phase 5.
- Pas de personnalisation avancée du mini-site au-delà du choix de thème.

### Critère de sortie

Un restaurateur inconnu de l'équipe accomplit seul en moins de 30 minutes de temps actif : photo de la carte, relecture, génération réussie de candidats pour au moins un plat photographié, comparaison puis choix explicite entre photo fournie, rendu généré ou aucune image, choix d'un profil de carte, configuration du fuseau, des horaires et d'au moins un service, validation des informations réglementaires, génération du premier PDF daté, génération du mini-site et soumission complète du dossier Stripe, sans intervention humaine de Surplasse ni publication automatique d'un candidat IA. L'attente d'une vérification externe Stripe ne compte pas dans ces 30 minutes. Quand les capacités deviennent `active`, le tunnel reprend sans ressaisie et rend l'établissement encaissable sans intervention de Surplasse ; cette activation effective reste obligatoire pour sortir de la phase.

## Phase 4 : Exploiter et piloter {#phase-4-exploiter-piloter}

### Objectif

Surplasse devient un outil dont une équipe peut dépendre pendant et après le service. Le Dashboard distribue le travail entre la salle, la cuisine et la gestion, la carte se publie sans risque, et le restaurateur explique chaque vente Surplasse jusqu'au versement bancaire. Cette phase construit les fondations communes du [socle professionnel](produit/socle-professionnel.md), puis les exerce aussi à emporter et sur plusieurs établissements avant sa preuve de sortie.

### Livrables

Les lots sont livrés dans cet ordre. Les lots 4A à 4C forment les fondations communes et sont éprouvés avant d'ajouter les variantes Must du lot 4D. Une pré-cohorte courte tranche ensuite les trois besoins conditionnels. La cohorte formelle ne commence qu'après leur décision et, lorsqu'ils deviennent Must, leur livraison. Les fonctionnalités Should ou Could et les extensions post-preuve ne retardent jamais son démarrage.

#### 4A. Opérer en équipe

- Membres, invitations, révocation, postes partagés et rôles fixes `owner`, `manager`, `service`, `kitchen`, avec autorisations Backend par établissement et journal des actions sensibles.
- Trois vues métier dans le même Dashboard : Salle par table et par commande prête, Cuisine par ancienneté et préparation, Gestion pour la carte, l'équipe, les finances et les réglages. Les petits établissements gardent une vue combinée avec un rôle `owner` ou `manager`.
- Alertes sonores et visuelles testables, état SSE permanent, âge de la commande, relance des commandes non acquittées et reprise sans perte après coupure.
- Présence d'au moins une session explicitement armée, testée et capable d'accepter tant que la prise de commandes est ouverte. Un poste Cuisine seul ne suffit pas. L'absence prolongée de tout réceptionnaire actif force une pause sans réouverture automatique, alerte un responsable par un canal secondaire et laisse chaque commande déjà payée visible, puis la rembourse automatiquement par un job durable si elle dépasse le délai maximal d'acceptation.
- Gestion des horaires, fermetures exceptionnelles, services nommés, tables et QR codes depuis le Dashboard.
- Rupture immédiate d'un produit ou d'une option, synchronisée avec Commande et les vues métier.

#### 4B. Gérer sans risque

- Gestion autonome et versionnée de la carte : brouillon, prévisualisation, publication atomique, retour arrière, catégories, produits, options, formules simples, prix, horaires et disponibilités. Une formule regroupe et ordonne ses choix sur un ticket unique ; le séquencement séparé des services reste hors socle.
- Informations professionnelles : prix TTC, allergènes, régimes, origine et mentions applicables, renseignés ou validés par le restaurateur.
- Carte papier exportée depuis la version publiée, datée et utilisable sans images. Le Dashboard indique qu'un ancien export est devenu obsolète.
- Remboursement partiel par ligne et quantité, avec motif, auteur, reçu corrigé, commission restituée selon la décision dédiée à prendre et continuité de la partie encore servie.

#### 4C. Rapprocher

- Historique des commandes, recherche et filtres, avec détail des lignes figées et des ajustements.
- Composants Stripe intégrés pour les paiements, versements, litiges, documents et rapports, avec bannière d'exigences et remédiation permanente du compte. Les actions mutables restent bornées par rôle et passent par les workflows Surplasse lorsqu'ils existent. Cette dette est obligatoire avec `dashboard=none` dans l'[ADR-0020](decisions/adr-0020-accounts-v2-onboarding-embarque.md).
- Rapprochement de fin de service : ventes brutes Surplasse TTC, remboursements, commission Surplasse, frais Stripe disponibles, net attendu, versements, échecs, litiges et écarts.
- Export CSV comptable des seules ventes Surplasse, avec ventilation fiscale configurée et identifiants de rapprochement. La catégorie fiscale, le taux, la base hors taxe et le montant de taxe sont figés sur chaque ligne. Une revue juridique et comptable valide le périmètre avant la généralisation.
- Vue du service en cours : ventes brutes Surplasse TTC, remboursements, nombre de commandes payées et temps moyen de préparation, mis à jour en temps réel.

#### 4D. Couvrir les variantes de la cible

- Présentation contrainte : profils Compact, Équilibré et Visuel, politique d'images, logo, couverture, palette accessible et prévisualisation mobile, sans constructeur de pages.
- Gestion des visuels produit : téléverser, recadrer, remplacer ou retirer une photo, ou choisir aucun visuel. L'image publiée reste en place jusqu'au choix.
- Multi-établissements : un restaurateur gère jusqu'à trois établissements depuis le même compte, sans consolidation de réseau avancée.
- À emporter avec créneaux et capacité configurable : le client commande à l'avance, choisit un créneau encore disponible et reçoit un SMS lorsque sa commande est prête.

#### Pré-cohorte de décision

Cinq établissements, deux à table, deux principalement au comptoir et un principalement à emporter, réalisent chacun au moins deux services et vingt commandes payées sur les fondations et variantes Must. Les deux comptoirs couvrent chacun une période de pointe et au moins un exploitant gère deux établissements afin d'exercer la bascule, les droits et les alertes. Cette activité sert à corriger les blocages et ne compte pas dans les quatre semaines de preuve, même si un établissement rejoint ensuite la cohorte formelle.

- Le routage simple des produits vers deux ou trois files devient Must si les deux établissements de comptoir ne peuvent pas tenir une période de pointe avec une file commune.
- La commande assistée, proposition vérifiée et payée par le client avant toute entrée en cuisine, devient Must si au moins deux établissements ne peuvent pas intégrer les commandes Surplasse à leur prise de commande sans elle.
- L'impression thermique devient Must si au moins deux établissements ne peuvent pas terminer une période de pointe avec la vue Cuisine et son mode de secours testés. Son ADR matériel est alors tranché avant la cohorte formelle.
- Chaque décision est consignée avant le recrutement définitif de la cohorte. Toute capacité promue est livrée, testée et répétée sur les établissements concernés avant le début de la preuve.

#### Extensions après la preuve

Ces éléments restent utiles, mais ne justifient pas de retarder la preuve du canal professionnel :

- analyse par jour, semaine ou mois, comparaison à la période précédente, panier moyen, produits classés, heures de pointe et répartitions détaillées ;
- nouvelle génération de rendus IA depuis le Dashboard, comparaison des candidats et choix explicite conformément à l'[ADR-0025](decisions/adr-0025-visuels-plats-a-la-demande.md). L'embarquement conserve déjà son premier parcours de génération ;
- autres améliorations Should ou Could du [catalogue des fonctionnalités](produit/fonctionnalites.md).

### Risques et parades

| Risque | Parade |
|---|---|
| Des métriques que personne ne regarde | Partir des questions que les restaurateurs pilotes posent réellement, pas d'un catalogue de graphiques |
| Des chiffres difficiles à croire | Nommer « ventes Surplasse » le périmètre du canal, définir chaque indicateur une seule fois, le calculer dans le fuseau de l'établissement et le rapprocher des commandes, paiements et versements |
| Un membre voit ou exécute une action interdite | Rôles fixes, autorisation Backend sur chaque endpoint, tests croisés entre rôles et établissements, révocation immédiate et journal d'activité |
| La vue Cuisine devient un Dashboard de gestion miniaturisé | Projection dédiée, sans données financières, testée sur écran fixe et dans le bruit d'un service |
| Une modification de carte altère l'historique | Figer le libellé, les options et le prix dans les lignes de chaque commande ; les modifications futures ne réécrivent jamais une commande payée |
| Une publication de carte casse le service | Séparer la rupture immédiate des changements structurels, qui passent par un brouillon, une prévisualisation et une publication atomique |
| Un visuel généré trompe le client ou dépasse le budget prévu | Imposer une photo du plat réel, un choix explicite, un étiquetage visible, des candidats privés et un quota de génération par établissement et par période |
| L'à emporter perturbe le flux en cuisine aux heures de pointe | Les créneaux sont bornés en capacité, réglable par le restaurateur |
| Le multi-établissements complexifie le modèle de données tardivement | Le modèle distingue restaurateur et établissement depuis le contrat de la phase 1 ; la phase 4 ne fait qu'ouvrir l'interface |
| Surplasse devient une caisse par accumulation de petits besoins | Refuser l'enregistrement des paiements externes dans le socle, obtenir une qualification juridique écrite et respecter l'[ADR-0032](decisions/adr-0032-canal-prepaye-sans-caisse.md) |
| La personnalisation produit des cartes illisibles ou lentes | Presets bornés, contrastes et budgets de performance non désactivables, prévisualisation mobile avant publication |

### Exclusions explicites

- Pas de programme de fidélité ni de marketing : phase 5.
- Pas d'espèces, titres-restaurant, paiement sur terminal externe, addition ouverte ou paiement en fin de repas.
- Pas de gestion des stocks, réservations, planning, livraison ni intégration caisse bidirectionnelle.
- Pas de rôles entièrement configurables ni de constructeur de pages libre.

### Critère de sortie

Une cohorte de dix établissements exactement, appartenant à la cible, avec quatre restaurants à table, trois activités principalement au comptoir et trois principalement à emporter, exploite Surplasse pendant quatre semaines consécutives après une première semaine d'accompagnement. Au moins deux exploitants utilisent chacun deux établissements. Chaque établissement expose le canal pendant au moins huit services réels, dont deux périodes de pointe, et traite au moins cinquante commandes payées. Tout abandon après recrutement compte comme un échec.

Au moins huit établissements, dont trois sur quatre à table, deux sur trois au comptoir et deux sur trois à emporter, ouvrent, tiennent et rapprochent leurs services sans assistance quotidienne. Les équipes utilisent des membres nominatifs ou des postes appairés, jamais le compte du restaurateur partagé. Les rôles empêchent toute action interdite.

Sur la période, 100 % des commandes, paiements, remboursements, commissions, frais Stripe disponibles et versements sont rapprochés jusqu'au dépôt bancaire, avec au moins un dépôt effectivement observé par établissement. Seules les transactions postérieures à la dernière échéance de versement documentée peuvent rester en transit. Aucun écart inexpliqué ni aucun écart attribuable à Surplasse ne subsiste ; un incident externe ouvert reste documenté. Les échecs de versement et litiges sont visibles. Chaque établissement qualifie au moins un remboursement partiel de bout en bout sur une commande payée. Aucune commande payée n'est perdue, aucun double débit, mauvais montant, mauvaise table ou fuite d'autorisation n'est constaté. Au moins 95 % des commandes payées apparaissent dans la vue attendue en moins de 5 secondes. Chaque commande payée est acceptée ou remboursée avant le délai maximal configuré, chaque reprise après coupure rattrape les événements manqués et chaque perte de tous les réceptionnaires déclenche le scénario de sécurité sans commande abandonnée. Chaque pilote à emporter prouve au moins une remise de SMS « Prête » et un échec fournisseur injecté, visible et récupérable sans notification silencieusement perdue.

Au moins huit établissements publient seuls une modification réelle de carte, gèrent une rupture, régénèrent un QR code et exportent une carte papier à jour. L'export financier est importé ou rapproché sans retraitement manuel structurel par les comptables d'au moins trois pilotes. Aucun incident P0 ou P1, définis dans le protocole du socle professionnel, ne reste ouvert.

## Phase 5 : La relation

### Objectif

Le circuit court de la commande devient un circuit court de la relation. Le restaurant transforme des commandes anonymes en clients identifiés et fidèles, et Surplasse étend sa présence par les espaces à revendiquer.

### Livrables

- Avis clients après commande, affichés sur le mini-site.
- Pourboire proposé après le service sous la forme d'un paiement distinct, versé à l'établissement.
- Opt-in marketing : le client peut laisser son contact au restaurant, qui garde la propriété de sa base clients.
- Espaces pré-générés pour des établissements identifiés en ligne, avec parcours de revendication par le restaurateur.
- Impression thermique des tickets cuisine (ESC/POS), si la pré-cohorte ne l'a pas déjà promue en Must : l'ADR reste à trancher (matériel supporté, pont local ou impression réseau).
- Supports QR premium pour les tables (chevalets, stickers).
- **Vitrine Onboarding et acquisition SEO** : `surplasse.com` grandit en trois volets publics complémentaires :
  - une homepage qui présente Surplasse et conduit les restaurateurs vers le tunnel d'embarquement ;
  - une documentation publique destinée aux restaurateurs, qui explique le fonctionnement, les paiements et les tarifs, dont la commission Surplasse de 0 % pendant les 3 premiers mois puis 1 % par commande, hors frais Stripe (voir [les intégrations](architecture/integrations.md) et l'[ADR-0015](decisions/adr-0015-modele-commission.md)) ;
  - un blog d'articles utiles aux restaurateurs, destiné au référencement et au SEO global de `surplasse.com`. La production des articles sera automatisée une fois la vitrine réellement déployée.

### Risques et parades

| Risque | Parade |
|---|---|
| Les espaces pré-générés sont perçus comme du référencement forcé | Un espace non revendiqué reste sobre et factuel, se supprime sur simple demande, et la revendication est gratuite |
| L'opt-in marketing frôle les limites du RGPD | Consentement explicite, finalité claire, le restaurant est responsable de traitement : le cadre est documenté dans les pages opérations avant toute mise en production |
| Le matériel d'impression thermique est un gouffre de support | L'ADR tranche une liste courte de matériels supportés ; tout le reste est explicitement non supporté |

### Exclusions explicites

- Pas de marketplace, pas de mise en avant payante entre établissements : contraire au positionnement.
- Pas de programme de fidélité inter-restaurants.

### Critère de sortie

Un restaurant convertit des commandes en clients fidèles identifiés : des clients reviennent, laissent leur contact, et le restaurateur s'en sert.

## Comment cette roadmap évolue

Cette page est un document vivant, pas une promesse gravée.

- **Revue à chaque fin de phase** : le critère de sortie est évalué honnêtement, les enseignements de la phase révisent le contenu des suivantes.
- **Les changements passent par un commit sur cette page** : la roadmap n'existe nulle part ailleurs (pas de tableau parallèle, pas de fichier de suivi concurrent). Modifier la trajectoire, c'est modifier cette page.
- **Les décisions structurantes passent par un ADR** : si un changement de roadmap découle d'un choix d'architecture ou de produit engageant, il est consigné dans [les ADR](decisions/index.md) et cette page s'y réfère.

Le détail fonctionnel est maintenu dans [le catalogue des fonctionnalités](produit/fonctionnalites.md) : le catalogue donne la priorité MoSCoW de chaque fonctionnalité, cette page donne l'ordre des phases.
