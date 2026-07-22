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
| 4 | Piloter | Donner au restaurateur les moyens de suivre et gérer son activité | Pendant quatre semaines, un restaurateur consulte ses métriques et met sa carte à jour sans aide |
| 5 | La relation | Transformer les commandes en relation client durable | Un restaurant convertit des commandes en clients fidèles identifiés |

Les fonctionnalités visées par chaque phase sont détaillées dans [le catalogue des fonctionnalités](produit/fonctionnalites.md). Les choix structurants pris en chemin sont consignés dans [les ADR](decisions/index.md).

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

Un restaurateur inconnu de l'équipe s'embarque seul en moins de 30 minutes : photo de la carte, relecture, génération réussie de candidats pour au moins un plat photographié, comparaison puis choix explicite entre photo fournie, rendu généré ou aucune image, génération du mini-site et activation Stripe, sans intervention humaine de Surplasse et sans publication automatique d'un candidat IA.

## Phase 4 : Piloter

### Objectif

Le restaurateur ne subit plus son activité, il la pilote. Le Dashboard devient l'outil de travail quotidien : historique, métriques, gestion complète de la carte, et l'ouverture de l'à emporter élargit le canal au-delà de la salle.

### Livrables

- Dashboard complet : historique des commandes, recherche, filtres.
- Vue du service en cours : chiffre d'affaires, nombre de commandes et temps moyen de préparation, mis à jour en temps réel.
- Analyse par jour, semaine ou mois, avec comparaison à la période précédente : chiffre d'affaires, nombre de commandes, panier moyen, produits classés par quantités et par chiffre d'affaires, heures de pointe, répartition par service et répartition entre sur place et à emporter lorsque ce canal est actif.
- Gestion autonome de la carte depuis le Dashboard : création, édition, archivage et réorganisation des catégories, produits et options, changement de prix, horaires et disponibilités, sans intervention de Surplasse.
- Gestion des visuels produit : téléverser, recadrer, remplacer ou retirer une photo, puis demander depuis cette photo des rendus IA candidats, les comparer et choisir explicitement la photo originale, un rendu généré ou aucune image. L'image publiée reste en place jusqu'au choix, conformément à l'[ADR-0025](decisions/adr-0025-visuels-plats-a-la-demande.md).
- Multi-établissements : un restaurateur gère plusieurs établissements depuis le même compte.
- À emporter avec créneaux : le client commande à l'avance et choisit un créneau de retrait.

### Risques et parades

| Risque | Parade |
|---|---|
| Des métriques que personne ne regarde | Partir des questions que les restaurateurs pilotes posent réellement, pas d'un catalogue de graphiques |
| Des chiffres difficiles à croire | Définir chaque indicateur une seule fois, le calculer dans le fuseau de l'établissement et le rapprocher de l'historique des commandes et paiements |
| Une modification de carte altère l'historique | Figer le libellé, les options et le prix dans les lignes de chaque commande ; les modifications futures ne réécrivent jamais une commande payée |
| Un visuel généré trompe le client ou dépasse le budget prévu | Imposer une photo du plat réel, un choix explicite, un étiquetage visible, des candidats privés et un quota de génération par établissement et par période |
| L'à emporter perturbe le flux en cuisine aux heures de pointe | Les créneaux sont bornés en capacité, réglable par le restaurateur |
| Le multi-établissements complexifie le modèle de données tardivement | Le modèle distingue restaurateur et établissement depuis le contrat de la phase 1 ; la phase 4 ne fait qu'ouvrir l'interface |

### Exclusions explicites

- Pas de programme de fidélité ni de marketing : phase 5.
- Pas de gestion des stocks ni d'intégration caisse.

### Critère de sortie

Pendant quatre semaines consécutives, un restaurateur consulte chaque semaine des métriques rapprochées de l'historique des commandes et paiements. Sur la même période, il publie sans intervention de Surplasse au moins une modification réelle de produit et un changement de visuel, puis mène un cycle complet de génération récurrente : demande, résultat réussi, comparaison et décision explicite.

## Phase 5 : La relation

### Objectif

Le circuit court de la commande devient un circuit court de la relation. Le restaurant transforme des commandes anonymes en clients identifiés et fidèles, et Surplasse étend sa présence par les espaces à revendiquer.

### Livrables

- Avis clients après commande, affichés sur le mini-site.
- Pourboires à l'addition, versés à l'établissement.
- Opt-in marketing : le client peut laisser son contact au restaurant, qui garde la propriété de sa base clients.
- Espaces pré-générés pour des établissements identifiés en ligne, avec parcours de revendication par le restaurateur.
- Impression thermique des tickets cuisine (ESC/POS) : l'ADR reste à trancher (matériel supporté, pont local ou impression réseau).
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
