---
label: Glossaire
order: 70
icon: book
description: Définitions des termes métier et techniques du projet Surplasse, avec renvois vers les pages de référence.
---

# Glossaire

Ce glossaire rassemble tous les termes du projet : le vocabulaire métier canonique d'une part, les termes techniques récurrents d'autre part. La terminologie canonique fait loi dans la documentation, les interfaces et les échanges. La source de vérité est le fichier `docs/AGENTS.md` (exclu du site publié) ; cette page en est la déclinaison lisible et complétée.

## Comment lire ce glossaire

- La colonne « Type » distingue les termes **métier** (vocabulaire imposé du produit) des termes **techniques** (standards, outils, méthodes utilisés par le projet).
- Chaque définition est donnée dans le contexte Surplasse, pas dans l'absolu.
- La colonne « En savoir plus » renvoie vers la page qui traite le sujet en profondeur.
- Les termes sont classés par ordre alphabétique, chiffres en tête.

!!! info Terminologie imposée
Les termes métier ne sont pas des suggestions : une page, une interface ou un commit qui emploie un terme proscrit (voir le [tableau en fin de page](#termes-à-proscrire)) doit être corrigé. Quelques équivalents anglais restent tolérés dans le code, ils sont signalés dans les définitions.
!!!

## Les termes

| Terme | Type | Définition | En savoir plus |
|---|---|---|---|
| **3-D Secure** | Technique | Protocole d'authentification du porteur de carte lors d'un paiement en ligne (validation dans l'application bancaire). C'est le mécanisme le plus courant pour satisfaire la SCA ; Stripe le déclenche automatiquement quand la banque l'exige. | [Intégrations](architecture/integrations.md) |
| **ADR** | Technique | Architecture Decision Record : document court et numéroté qui consigne une décision structurante, son contexte, les options écartées et ses conséquences. Les ADR vivent sous `docs/decisions/` et priment sur toute autre page en cas de contradiction. | [Registre des ADR](decisions/index.md) |
| **Carte (la)** | Métier | Le menu du restaurant, structuré en catégories, produits, options et prix. Générée initialement par IA depuis une photo lors de l'embarquement, puis éditable dans le Dashboard. « Le menu » est acceptable, « catalogue » non. | [Fonctionnalités](produit/fonctionnalites.md) |
| **Client** | Métier | Le convive qui consulte la carte et commande, sur place ou à emporter. Il n'installe aucune application et ne crée jamais de compte. | [Personas](produit/personas.md) |
| **Commande** | Métier | L'acte d'achat d'un client, sur place ou à emporter. Avant validation et paiement, on parle de panier. La commande suit une machine à états et arrive en temps réel dans le Dashboard. | [Parcours de commande](produit/parcours/commande-client.md) |
| **Contract-first** | Technique | Démarche de conception où le contrat OpenAPI est écrit et validé avant toute implémentation. Le backend implémente des interfaces Java générées depuis le contrat, les frontends consomment des clients TypeScript générés depuis le même fichier. | [API](architecture/api.md) |
| **Contrat (le)** | Métier | Le fichier `api/openapi.yaml`, source de vérité de l'API Surplasse. Toute évolution de l'API commence par une modification du contrat. Ne pas dire « le swagger » ni « la spec ». | [API](architecture/api.md) |
| **Dev Services** | Technique | Fonctionnalité de Quarkus qui démarre automatiquement les dépendances requises (PostgreSQL notamment) dans des conteneurs jetables au lancement en mode dev ou test, sans configuration préalable. | [Démarrer](developpement/index.md) |
| **Embarquement** | Métier | Le parcours de création d'un établissement : nom, photo de la carte, génération du mini-site et de la carte numérique, activation. Porté par l'application Onboarding ; « onboarding » est acceptable dans le code. | [Parcours d'embarquement](produit/parcours/onboarding-restaurateur.md) |
| **ESC/POS** | Technique | Jeu de commandes standard des imprimantes thermiques de point de vente. Pressenti pour l'impression optionnelle des tickets cuisine ; le choix du matériel et du protocole reste à trancher dans un ADR. | [Intégrations](architecture/integrations.md) |
| **Espace** | Métier | L'espace pré-généré d'un établissement identifié en ligne par Surplasse, en attente d'être revendiqué par son restaurateur. Ne pas dire « fiche » ni « listing ». | [Parcours de revendication](produit/parcours/onboarding-restaurateur.md) |
| **Établissement** | Métier | Le restaurant en tant qu'entité : identité, slug, carte, commandes. Un restaurateur peut en gérer plusieurs. Ne pas dire « boutique » ni « point de vente ». | [Données](architecture/donnees.md) |
| **Machine à états** | Technique | Modélisation du cycle de vie d'une entité par un ensemble fini d'états et de transitions autorisées. Dans Surplasse, la commande suit une machine à états, de sa création à son service ou son annulation ; les états exacts sont définis dans le modèle de données. | [Données](architecture/donnees.md) |
| **Magic link** | Technique | Lien de connexion à usage unique et à durée limitée, envoyé par email. C'est l'authentification du restaurateur pour le MVP : pas de mot de passe. Le client, lui, n'a jamais de compte. | [Sécurité](architecture/securite.md) |
| **Mini-site** | Métier | La vitrine web publique générée pour un établissement, servie sur `{slug}.surplasse.com` par l'application Commande : présentation, carte numérique, commande et paiement. Ne pas dire « site » ni « page ». | [Frontends](architecture/frontends.md) |
| **Monolithe modulaire** | Technique | Style d'architecture : un seul artefact déployé, découpé en modules internes aux frontières explicites. C'est l'approche retenue pour le backend Quarkus (Maven multi-modules), qui privilégie la simplicité opérationnelle sans sacrifier la structure. | [Vue d'ensemble](architecture/index.md) |
| **MoSCoW** | Technique | Méthode de priorisation qui classe chaque exigence en Must have, Should have, Could have ou Won't have. Utilisée dans la page des fonctionnalités pour délimiter le périmètre du MVP. | [Fonctionnalités](produit/fonctionnalites.md) |
| **MSW** | Technique | Mock Service Worker : bibliothèque JavaScript qui intercepte les requêtes réseau du navigateur ou de Node pour servir des réponses simulées, cohérentes avec le contrat. Utilisée pour développer et tester les frontends sans backend. | [Tests](developpement/tests.md) |
| **MVP** | Technique | Minimum Viable Product : le plus petit périmètre du produit qui apporte de la valeur en conditions réelles. Son contenu est arbitré en MoSCoW dans la page des fonctionnalités ; la roadmap en séquence la construction. | [Fonctionnalités](produit/fonctionnalites.md) |
| **Option** | Métier | Une variante ou un supplément d'un produit : cuisson, taille, extra. Choisie par le client au moment d'ajouter le produit à son panier. Ne pas dire « modifier » ni « add-on ». | [Données](architecture/donnees.md) |
| **Problem Details** | Technique | Format normalisé de réponse d'erreur HTTP défini par la RFC 9457 (anciennement RFC 7807). Toutes les erreurs de l'API le suivent : un type, un titre, un détail exploitable par les frontends. | [API](architecture/api.md) |
| **Produit** | Métier | Un plat, une boisson ou tout article commandable de la carte, avec ses options et son prix. Ne pas dire « article » ni « item ». | [Données](architecture/donnees.md) |
| **PSP** | Technique | Payment Service Provider, prestataire de services de paiement : l'acteur qui traite les paiements par carte pour le compte de la plateforme. Stripe est le PSP retenu par Surplasse. | [Intégrations](architecture/integrations.md) |
| **QR code** | Technique | Code-barres bidimensionnel imprimé à table ou sur le comptoir. Le client le scanne pour ouvrir le mini-site de l'établissement et commander ; c'est le point d'entrée physique du parcours de commande. | [Parcours de commande](produit/parcours/commande-client.md) |
| **Restaurateur** | Métier | Le professionnel qui gère un ou plusieurs établissements sur Surplasse. Il revendique ou crée son espace, ajuste sa carte et suit ses commandes depuis le Dashboard. Ne pas dire « marchand », « commerçant » ni « utilisateur pro ». | [Personas](produit/personas.md) |
| **Revendication** | Métier | L'acte par lequel un restaurateur prouve sa légitimité et prend possession de l'espace pré-généré de son établissement. « Claim » est réservé au code. | [Parcours de revendication](produit/parcours/onboarding-restaurateur.md) |
| **RGPD** | Technique | Règlement général sur la protection des données (règlement UE 2016/679). Encadre le traitement des données personnelles du projet : emails des restaurateurs, données liées aux commandes des clients. | [RGPD](operations/rgpd.md) |
| **SCA** | Technique | Strong Customer Authentication : obligation européenne (directive DSP2) d'authentifier fortement le payeur lors d'un paiement en ligne. Gérée par Stripe, en pratique le plus souvent via 3-D Secure. | [Intégrations](architecture/integrations.md) |
| **Slug** | Technique | Identifiant textuel court, unique et lisible d'un établissement, utilisé comme sous-domaine du mini-site (`{slug}.surplasse.com`). En minuscules, sans espaces ni accents. | [Frontends](architecture/frontends.md) |
| **Soft delete** | Technique | Suppression logique : l'enregistrement est marqué comme supprimé et exclu des lectures courantes, mais conservé en base pour l'historique et les obligations comptables. | [Données](architecture/donnees.md) |
| **SSE** | Technique | Server-Sent Events : canal HTTP unidirectionnel par lequel le serveur pousse des événements vers le navigateur. Utilisé pour afficher les commandes en temps réel dans le Dashboard. WebSockets est envisagé plus tard si un canal bidirectionnel devient nécessaire. | [Backend](architecture/backend.md) |
| **Stripe Connect** | Technique | Offre de Stripe conçue pour les plateformes : chaque établissement dispose d'un compte connecté Accounts v2 qui reçoit les fonds de ses commandes, Surplasse orchestrant le paiement. La configuration marchand, les charges directes et l'embarquement par composants intégrés sont actés dans l'[ADR-0020](decisions/adr-0020-accounts-v2-onboarding-embarque.md). La commission Surplasse est de 0 % pendant les 3 premiers mois, puis de 1 %, hors frais Stripe, conformément à l'[ADR-0015](decisions/adr-0015-modele-commission.md). | [Intégrations](architecture/integrations.md) |
| **Testcontainers** | Technique | Bibliothèque Java qui pilote des conteneurs Docker éphémères pendant les tests d'intégration, pour tester contre un vrai PostgreSQL plutôt qu'une base simulée. C'est le moteur des Dev Services de Quarkus en mode test. | [Tests](developpement/tests.md) |

## Termes à proscrire

Rappel des équivalences imposées par la terminologie canonique. La colonne de gauche liste les termes à ne pas employer dans la documentation et les interfaces.

| À proscrire | Terme canonique | Tolérance |
|---|---|---|
| « marchand », « commerçant », « utilisateur pro » | Restaurateur | Aucune |
| « consommateur », « utilisateur final », « guest » | Client | Aucune |
| « boutique », « point de vente » | Établissement | Aucune |
| « catalogue » | La carte | « Le menu » est acceptable |
| « article », « item » | Produit | Aucune |
| « modifier », « add-on » | Option | Aucune |
| « panier » pour une commande validée | Commande | « Panier » désigne uniquement l'état avant validation |
| « site », « page » | Mini-site | Aucune |
| « fiche », « listing » | Espace | Aucune |
| « claim » | Revendication | « claim » est réservé au code |
| « onboarding » | Embarquement | « onboarding » est acceptable dans le code ; Onboarding reste le nom de l'application |
| « le swagger », « la spec » | Le contrat | Aucune |

## Faire vivre le glossaire

Un terme nouveau qui s'installe dans le projet suit ce chemin :

1. S'il s'agit d'un terme métier, il est d'abord ajouté à la terminologie canonique de `docs/AGENTS.md`, puis reporté ici.
2. S'il découle d'une décision structurante (choix d'un outil, d'un protocole, d'un montage), l'[ADR](decisions/index.md) correspondant est la référence et le glossaire s'y aligne.
3. Dans tous les cas, l'entrée renvoie vers la page qui traite le sujet : le glossaire définit, il ne développe pas.

Pour la vision d'ensemble du produit et de son vocabulaire en situation, commencer par la [vision](produit/vision.md) et les trois parcours : [commande](produit/parcours/commande-client.md), [embarquement](produit/parcours/onboarding-restaurateur.md), [revendication](produit/parcours/onboarding-restaurateur.md).
