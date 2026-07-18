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
| 4 | Piloter | Donner au restaurateur les moyens de suivre et gérer son activité | Un restaurateur consulte ses métriques chaque semaine sans qu'on le lui demande |
| 5 | La relation | Transformer les commandes en relation client durable | Un restaurant convertit des commandes en clients fidèles identifiés |

Les fonctionnalités visées par chaque phase sont détaillées dans [le catalogue des fonctionnalités](produit/fonctionnalites.md). Les choix structurants pris en chemin sont consignés dans [les ADR](decisions/index.md).

## Phase 0 : Fondations

**Période indicative : juillet 2026. Statut : en cours.**

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

- Aucun code applicatif : ni backend, ni frontends, ni contrat OpenAPI.
- Aucune maquette graphique ni charte visuelle définitive.

### Critère de sortie

La documentation est publiée, couvre l'ensemble de l'arborescence prévue, et sert effectivement de référence : toute question sur le produit ou l'architecture trouve sa réponse dans une page.

## Phase 1 : Le contrat et les squelettes

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

### Objectif

Le vrai MVP. Un établissement pilote, une carte saisie à la main, des clients réels qui scannent le QR code à table, commandent et paient. Le restaurateur voit les commandes arriver et les accepte. Tout le reste du produit existe pour rendre ce moment possible.

!!! info Pourquoi une carte saisie à la main
L'extraction par IA arrive en phase 3. En phase 2, la carte du pilote est saisie manuellement (par l'équipe, directement en base ou via un outil interne minimal) : le sujet de cette phase est le flux de commande et de paiement, pas l'embarquement.
!!!

### Livrables

- Carte complète de l'établissement pilote, saisie à la main.
- Commande sur place par QR code : scan à table, panier, validation, numéro de table.
- Paiement Stripe intégré au front Commande : en mode test d'abord, puis en live pour le service pilote.
- Dashboard minimal : flux SSE des commandes entrantes, acceptation des commandes, authentification du restaurateur par magic link.
- Boucle de retour avec le restaurateur pilote : observations de service, irritants, demandes.

### Risques et parades

| Risque | Parade |
|---|---|
| Le produit casse en plein service et brûle la confiance du pilote | Répéter le service à blanc en conditions réelles avant le premier service payant ; prévoir un repli papier assumé |
| Le paiement en live expose à des obligations réglementaires mal anticipées | Rester en mode test jusqu'à validation du parcours ; passer en live sur un périmètre minimal avec Stripe comme garde-fou |
| Le réseau du restaurant est mauvais et le temps réel ne suit pas | Tester le SSE en conditions dégradées ; le Dashboard doit survivre à une reconnexion sans perdre de commande |
| Le pilote demande des fonctionnalités hors périmètre | Tout noter, ne rien promettre : les demandes nourrissent les phases 4 et 5 |

### Exclusions explicites

- Pas d'extraction IA ni de génération de mini-site : phase 3.
- Pas d'à emporter : la commande est sur place uniquement.
- Pas de gestion de carte dans le Dashboard : les corrections passent par l'équipe.
- Pas de multi-établissements.

### Critère de sortie

Un service du midi réel est géré via Surplasse dans un restaurant pilote : de vrais clients commandent et paient depuis leur téléphone, le restaurateur travaille avec le Dashboard, et le service se termine sans repli sur le papier.

## Phase 3 : L'embarquement magique

### Objectif

Faire disparaître le coût d'entrée. Un restaurateur photographie sa carte, Surplasse en extrait la structure par IA, génère le mini-site avec un thème, et le tunnel d'embarquement l'amène jusqu'à l'activation des paiements. C'est la promesse fondatrice du produit : un canal de commande directe sans projet informatique.

### Livrables

- Extraction IA de la carte depuis une photo (API Claude, vision) : catégories, produits, options, prix, avec écran de relecture et correction avant publication.
- Génération du mini-site de l'établissement avec choix d'un thème.
- Stripe Connect Express en production : chaque établissement encaisse sur son propre compte.
- Tunnel d'embarquement complet dans le front Onboarding : de la photo de la carte à la première commande encaissable.

### Risques et parades

| Risque | Parade |
|---|---|
| L'extraction IA se trompe et publie des prix faux | La relecture par le restaurateur est une étape bloquante du tunnel ; rien n'est publié sans validation explicite |
| Les cartes réelles (manuscrites, plastifiées, mal éclairées) résistent à l'extraction | Constituer un jeu de photos de cartes réelles variées et mesurer le taux d'extraction correcte avant d'ouvrir le tunnel |
| Le KYC de Stripe Connect Express bloque des restaurateurs en cours de tunnel | Placer l'activation Stripe en fin de tunnel, permettre de finir l'embarquement et d'y revenir ; documenter les pièces attendues |
| Le tunnel est magique en démonstration et frustrant en vrai | Le critère de sortie impose un test avec un restaurateur inconnu de l'équipe, sans assistance |

### Exclusions explicites

- Pas d'enrichissement automatique depuis les données publiques ni d'espaces pré-générés à revendiquer : la revendication arrive en phase 5.
- Pas de personnalisation avancée du mini-site au-delà du choix de thème.

### Critère de sortie

Un restaurateur inconnu de l'équipe s'embarque seul en moins de 30 minutes : photo de la carte, relecture, génération du mini-site, activation Stripe, sans intervention humaine de Surplasse.

## Phase 4 : Piloter

### Objectif

Le restaurateur ne subit plus son activité, il la pilote. Le Dashboard devient l'outil de travail quotidien : historique, métriques, gestion complète de la carte, et l'ouverture de l'à emporter élargit le canal au-delà de la salle.

### Livrables

- Dashboard complet : historique des commandes, recherche, filtres.
- Métriques : chiffre d'affaires, produits les plus commandés, répartition par service, tendances.
- Gestion de carte avancée depuis le Dashboard : édition des produits et options, disponibilité en temps réel, réorganisation des catégories.
- Multi-établissements : un restaurateur gère plusieurs établissements depuis le même compte.
- À emporter avec créneaux : le client commande à l'avance et choisit un créneau de retrait.

### Risques et parades

| Risque | Parade |
|---|---|
| Des métriques que personne ne regarde | Partir des questions que les restaurateurs pilotes posent réellement, pas d'un catalogue de graphiques |
| L'à emporter perturbe le flux en cuisine aux heures de pointe | Les créneaux sont bornés en capacité, réglable par le restaurateur |
| Le multi-établissements complexifie le modèle de données tardivement | Le modèle distingue restaurateur et établissement depuis le contrat de la phase 1 ; la phase 4 ne fait qu'ouvrir l'interface |

### Exclusions explicites

- Pas de programme de fidélité ni de marketing : phase 5.
- Pas de gestion des stocks ni d'intégration caisse.

### Critère de sortie

Un restaurateur consulte ses métriques chaque semaine sans qu'on le lui demande : le Dashboard a prouvé qu'il répond à de vraies questions.

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
