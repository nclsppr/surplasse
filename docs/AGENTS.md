# AGENTS.md : conventions et terminologie canonique

Ce fichier est la source de vérité pour toute contribution à la documentation et au code de Surplasse. Il est exclu du build Retype (voir `retype.yml`). Toute page de documentation doit respecter la terminologie, la stack et le style définis ici. En cas de contradiction entre une page et ce fichier, ce fichier gagne, et la page doit être corrigée.

## Le produit en bref

Surplasse permet aux restaurants indépendants de créer leur propre canal de commande directe, sans projet informatique. À partir du nom de l'établissement, d'une photo de la carte et de quelques images, Surplasse génère un mini-site élégant, une carte numérique structurée, un système de commande et des paiements intégrés. Le client scanne un QR code à table, commande et paie depuis son téléphone, sans application ni compte. La commande arrive en temps réel côté restaurant.

Positionnement : Surplasse n'est pas une marketplace. Le restaurant garde son identité, ses prix, ses clients et sa relation client. Slogan : « Le circuit court de la commande. »

## Terminologie canonique

| Terme | Définition | À ne pas confondre avec |
|---|---|---|
| **Restaurateur** | Le professionnel qui gère un établissement sur Surplasse | « marchand », « commerçant », « utilisateur pro » |
| **Client** | Le convive qui consulte la carte et commande | « consommateur », « utilisateur final », « guest » |
| **Établissement** | Le restaurant en tant qu'entité (un restaurateur peut en avoir plusieurs) | « boutique », « point de vente » |
| **La carte** | Le menu du restaurant (catégories, produits, options, prix) | « le menu » est acceptable, « catalogue » non |
| **Produit** | Un plat, une boisson ou tout article commandable | « article », « item » |
| **Option** | Une variante ou un supplément d'un produit (cuisson, taille, extra) | « modifier », « add-on » |
| **Commande** | L'acte d'achat d'un client (sur place ou à emporter) | « panier » désigne l'état avant validation |
| **Mini-site** | La vitrine web publique générée pour un établissement | « site », « page » |
| **Espace** | L'espace pré-généré d'un établissement identifié en ligne, à revendiquer | « fiche », « listing » |
| **Revendication** | L'acte par lequel un restaurateur prend possession de son espace pré-généré | « claim » (réservé au code) |
| **Embarquement** | Le parcours de création d'un établissement (photo de la carte, génération, activation) | « onboarding » est acceptable dans le code |
| **Le contrat** | Le fichier OpenAPI, source de vérité de l'API | « le swagger », « la spec » |

## Les applications

Quatre applications, un backend, un contrat :

| Nom canonique | Répertoire cible | Production | Développement local | Rôle |
|---|---|---|---|---|
| **Onboarding** | `frontends/onboarding/` | `surplasse.com` | `surplasse.test` | Vitrine produit et tunnel d'embarquement des restaurateurs |
| **Commande** | `frontends/commande/` | `{slug}.surplasse.com` | `{slug}.surplasse.test` | Mini-site de l'établissement, carte numérique, commande et paiement client |
| **Dashboard** | `frontends/dashboard/` | `dashboard.surplasse.com` | `dashboard.surplasse.test` | Suivi des commandes en temps réel, gestion de la carte, métriques et analyse |
| **Backend** | `backend/` | `api.surplasse.com` | `api.surplasse.test` | API REST Quarkus, logique métier, persistance, intégrations |

Le contrat OpenAPI vit dans `api/openapi.yaml`. Il est la source de vérité : le backend l'implémente, les frontends consomment des clients TypeScript générés depuis lui.

Les domaines sont des données de configuration. `config/domains/production.env` et `config/domains/development.env` portent les valeurs publiques canoniques. La logique applicative ne code jamais le suffixe `.com` ou `.test`. Les sous-domaines `www`, `api`, `dashboard`, `docs`, `app`, `admin`, `local` et `mail` sont réservés et ne peuvent pas devenir un `slug` d'établissement. `app` et `admin` restent réservés sans désigner une application actuelle. Les cookies restaurateur sont toujours hôte uniquement sur l'API : `COOKIE_DOMAIN` reste vide, jamais `.surplasse.com` ni `.surplasse.test`.

**Règle non négociable pour les URL locales :** toute URL applicative ouverte par un navigateur, affichée à un utilisateur, injectée dans un frontend, utilisée comme origine CORS, cible de redirection, base de test de bout en bout ou lien de cockpit vient du profil central et utilise HTTPS sous `surplasse.test`. `localhost`, `127.0.0.1` et `::1` sont interdits dans ces rôles. Le loopback reste autorisé uniquement comme adresse d'écoute privée d'un processus, cible interne d'un reverse proxy, sonde technique sans navigation, accès SMTP, accès base de données ou connexion de débogage. Une QA navigateur locale utilise toujours le domaine canonique derrière Caddy. Le passage en production consiste à sélectionner `config/domains/production.env`, jamais à remplacer des littéraux dispersés.

## Stack de référence

| Couche | Choix | Version de référence | Notes |
|---|---|---|---|
| Backend | Quarkus | 3.x (dernière LTS) | Java 21 (LTS), Maven multi-modules |
| ORM | Hibernate ORM avec Panache | livré par Quarkus | Repository pattern |
| Base de données | PostgreSQL | 17 | Une seule base, schémas par domaine si besoin |
| Migrations | Flyway | livré par Quarkus | Migrations versionnées, jamais de DDL manuel |
| Stockage objet | MinIO | dernière stable | Compatible S3 ; photos de cartes et visuels de plats, derrière une interface du backend |
| Temps réel | SSE (Server-Sent Events) | natif Quarkus | WebSockets envisagé plus tard si besoin bidirectionnel |
| Frontends | React | 19 | TypeScript strict, Vite, un package partagé `frontends/shared/` |
| État serveur | TanStack Query | 5 | Pas de Redux |
| Contrat | OpenAPI | 3.1 | Contract-first, générateurs de clients TS et d'interfaces Java |
| Paiement | Stripe | API courante | CB, Apple Pay, Google Pay ; PayPal en roadmap |
| Auth restaurateur | Magic link par email, session JWT en cookie HttpOnly | MVP | Le client final n'a jamais de compte |
| IA | API OpenAI (derrière interface) | modèles courants | Extraction de carte et données publiques (vision) ; génération de visuels de plats à l'embarquement |
| Impression | Imprimante thermique ESC/POS | à trancher (ADR) | Tickets cuisine optionnels |
| Docs | Retype | 4.6+ | Ce site ; déployé sur GitHub Pages |
| Reverse proxy | Caddy | 2.x | Local avec mkcert ; production cible avec TLS wildcard par défi DNS-01 ; routage par nom d'hôte |
| OS de production | Ubuntu | dernière LTS | Le VPS ; en cas de divergence de comportement entre systèmes, Ubuntu fait foi |
| CI/CD | GitHub Actions | | Déploiement cible : VPS avec Docker Compose |
| Node | 24 | via nvm | Pour l'outillage frontend et docs |

Toute décision structurante est consignée dans un ADR sous `docs/decisions/`. Si une page contredit un ADR, l'ADR gagne.

## Langue du code

**Règle non négociable : tout le code est en anglais.** Cela couvre les noms de classes, d'interfaces, de packages, de modules, de méthodes, de variables, les colonnes et tables SQL, les valeurs d'enum, les `operationId` et chemins d'API, les identifiants CSS et de composants, les messages de log, et **les commentaires**. La **documentation**, elle, reste en **français**.

Conséquence pour cette documentation : la prose est en français, mais tout extrait de code, identifiant, chemin de package, nom de colonne ou valeur technique cité dans la doc est en anglais. On peut gloser un identifiant en français dans la prose (« la commande, `Order`, ... »), jamais l'inverse. Aucune page ne doit présenter un identifiant français (`IntrouvableException`, `com.surplasse.commande`, `prenom_client`, statut `payée` comme valeur stockée).

### Lexique canonique français vers anglais

Ce lexique fait foi. Tout identifiant de code dans la doc s'y conforme, pour que toutes les pages emploient les mêmes noms.

Domaines et modules Maven (packages `com.surplasse.<module>`) :

| Domaine (prose FR) | Module / package |
|---|---|
| catalogue | `catalog` |
| commande | `order` |
| paiement | `payment` |
| identité | `identity` |
| engagement | `engagement` |
| génération | `generation` |
| commun (socle) | `common` |
| contrat (généré) | `contract` |
| assemblage | `application` |

Entités (noms de classes et, entre parenthèses, table SQL en `snake_case`) :

| Entité (prose FR) | Classe (table SQL) |
|---|---|
| restaurateur | `Restaurateur` (`restaurateur`) |
| client | `Customer` (`customer`) |
| établissement | `Establishment` (`establishment`) |
| espace pré-généré | `Space` (`space`) |
| carte | `Menu` (`menu`) |
| catégorie | `Category` (`category`) |
| produit | `Product` (`product`) |
| option | `Option` (`option`) |
| groupe d'options | `OptionGroup` (`option_group`) |
| table (support QR) | `TableQr` (`table_qr`) |
| session de table | `TableSession` (`table_session`) |
| commande | `Order` (`order`) |
| ligne de commande | `OrderLine` (`order_line`) |
| événement de commande diffusé | `OrderEvent` (`order_event`) |
| paiement | `Payment` (`payment`) |
| événement webhook traité | `StripeWebhookEvent` (`stripe_webhook_event`) |
| session de magic link | `MagicLinkSession` (`magic_link_session`) |
| contact client | `CustomerContact` (`customer_contact`) |
| avis | `Review` (`review`) |
| pourboire | `Tip` (`tip`) |
| consentement marketing | `MarketingConsent` (`marketing_consent`) |
| job d'extraction | `ExtractionJob` (`extraction_job`) |
| média (image stockée) | `MediaAsset` (`media_asset`) |

Valeurs d'enum (stockées en base, donc en anglais) :

| Enum | Valeurs |
|---|---|
| Statut de commande (`Order.status`) | `pending_payment`, `paid`, `accepted`, `preparing`, `ready`, `served`, `picked_up`, `cancelled`, `refunded` |
| Type de commande (`Order.type`) | `on_site`, `takeaway` |
| Statut de carte (`Menu.status`) | `draft`, `published` |
| Cycle de vie d'un espace (`Space.status`) | `pregenerated`, `claiming`, `claimed` |
| Cycle de vie d'un établissement (`Establishment.status`) | `configuring`, `active`, `suspended` |
| État opérationnel de prise de commandes (`Establishment.orderIntakeStatus`) | `open`, `paused` |
| Statut d'un job (`ExtractionJob.status`) | `pending`, `running`, `succeeded`, `failed` |
| Source d'un média (`MediaAsset.source`) | `uploaded`, `generated` |
| Nature d'un média (`MediaAsset.kind`) | `dish`, `place`, `logo`, `menu_scan` |
| Statut d'un média (`MediaAsset.status`) | `proposed`, `selected`, `archived` |

Exceptions métier (dans `common`) :

| Cas (prose FR) | Classe | Statut HTTP |
|---|---|---|
| ressource inconnue | `NotFoundException` | 404 |
| non authentifié | `UnauthenticatedException` | 401 |
| accès hors périmètre établissement | `AccessDeniedException` | 404 (jamais 403) |
| conflit d'état | `ConflictException` | 409 |
| règle métier violée | `BusinessRuleException` | 422 |
| paiement refusé | `PaymentFailedException` | 422 |
| dépendance externe indisponible | `DependencyUnavailableException` | 503 |

Événements de domaine (au passé, dans `common`) : `OrderPaid`, `OrderAccepted`, `ProductOutOfStock`. Dossiers de feature React : `menu`, `cart`, `payment`, `tracking`, `onboarding`, `dashboard`. Les noms de tests sont en anglais (`methodName_condition_expectedResult` en Java, `describe`/`it` en anglais côté Vitest).

## Décisions canoniques transverses

Ces décisions sont partagées par plusieurs pages. Toute page qui les évoque doit employer exactement ce vocabulaire et ce modèle. La page de référence détaillée est indiquée entre parenthèses.

### Machine à états de la commande (référence : `architecture/donnees.md`)

Les valeurs stockées du statut (`Order.status`) sont en anglais ; leur glose française sert à la prose :

```
pending_payment  ->  paid  ->  accepted  ->  preparing  ->  ready  ->  served (sur place) | picked_up (à emporter)
```

Glose : `pending_payment` (en attente de paiement), `paid` (payée), `accepted` (acceptée), `preparing` (en préparation), `ready` (prête), `served` (servie), `picked_up` (retirée). Statuts terminaux de sortie : `cancelled` (abandon ou expiration avant paiement, ou refus du restaurateur avant acceptation) et `refunded` (après paiement). Valeurs proscrites, à ne jamais employer comme statut : `received`/« reçue », `draft`/« brouillon », `retrieved`/« récupérée », « Nouvelle », « Refusée », « validée ». Le passage à `paid` n'est déclenché que par le webhook Stripe signé, jamais par le retour navigateur du client. Les libellés affichés au restaurateur dans le Dashboard peuvent être plus parlants (« Nouvelle commande » pour `paid`), mais ils restent rattachés explicitement au statut canonique.

### Cycle de vie du panier et de la commande

Le panier est un état **purement côté client** (application Commande). Aucune commande n'existe en base tant que le panier n'est pas validé. À la validation, le Backend crée la commande directement au statut `en attente de paiement`. Il n'y a pas d'état « brouillon » de commande en base.

### Prise de commandes (référence : `decisions/adr-0020-accounts-v2-onboarding-embarque.md`)

La prise de commandes est un état opérationnel distinct du cycle de vie `Establishment.status`. `Establishment.orderIntakeStatus` vaut `open` ou `paused`. La disponibilité effective `acceptingOrders` exige en plus un établissement `active`, une carte publiée, une table active et un compte Stripe Connect encaissable. La pause ferme les nouvelles sessions de table, commandes et sessions de paiement, mais laisse accessibles la carte, les commandes existantes, leur suivi, les flux SSE et les webhooks Stripe. Une capacité Accounts v2 `card_payments` différente de `active` force la pause ; son retour ne rouvre jamais automatiquement la prise de commandes.

### Domaines métier (référence : `architecture/backend.md`)

Six domaines, alignés sur les modules Maven : `catalogue`, `commande`, `paiement`, `identite`, `engagement`, `generation`. Le paiement est un domaine à part entière (pas un sous-ensemble de la commande). Les espaces pré-générés et la revendication relèvent du domaine `engagement`.

### Authentification et temps réel (référence : `architecture/securite.md`)

La session du restaurateur est un **JWT court porté par un cookie hôte uniquement émis par `api.surplasse.com`, `HttpOnly`, `Secure` en production, `SameSite=Lax`, `Path=/`**, posé après l'échange du magic link. Le lien transporte son jeton à usage unique dans le fragment `#token=...`, que le Dashboard retire avant l'échange par POST. Un second cookie hôte uniquement porte le refresh token opaque, rotatif et haché en base. Le Dashboard appelle `api.surplasse.com` avec `credentials: "include"` et le flux SSE utilise `withCredentials: true` : aucun en-tête `Authorization` n'est nécessaire. Ne jamais définir `Domain=.surplasse.com`, qui exposerait inutilement les cookies aux mini-sites, ni décrire l'authentification restaurateur comme un `Bearer` en en-tête. Le client final, lui, reçoit un jeton de session anonyme opaque lié à l'établissement et à la table.

### Séquencement (référence : `roadmap.md`)

La roadmap est la source unique de l'ordre de livraison (les phases). La priorisation MoSCoW de `produit/fonctionnalites.md` exprime l'importance intrinsèque des fonctionnalités pour le produit cible, pas un calendrier. Le premier MVP réellement livrable correspond à la **phase 2** de la roadmap (commander et payer). L'extraction IA de la carte, la génération du mini-site, l'édition de carte au Dashboard et l'historique arrivent après (phases 3 et 4) ; les espaces à revendiquer relèvent de la phase 5. Aucune page ne doit présenter ces éléments comme faisant partie du premier MVP.

### Fournisseur IA

L'IA (extraction de carte et de données publiques par vision, et génération de visuels de plats) passe par l'**API OpenAI**, validée par un test d'amorçage. Elle est toujours placée derrière une interface du domaine `generation` (par exemple `MenuExtractor`, `DishImageGenerator`) pour rester interchangeable. Voir `decisions/adr-0010-fournisseur-ia.md`. Ne jamais transmettre de données de client final à l'IA (une carte de restaurant est une donnée professionnelle).

### Visuels de plats générés (référence : `decisions/adr-0011-visuels-plats.md`)

La génération de visuels de plats est **dans le périmètre**, sous conditions strictes :

- **Sources maîtrisées uniquement.** Les images générées partent des photos fournies à l'embarquement par le restaurateur (ou la personne qui l'embarque), jamais de photos de tiers (touristes, plateformes) : ces dernières posent un problème de droits.
- **Choix du restaurateur, produit par produit.** À la configuration de la carte, chaque produit peut porter soit une photo téléversée, soit un visuel proposé par Surplasse, soit aucune image. Le restaurateur décide ; rien de généré n'est publié sans son choix explicite.
- **Fidélité.** Un visuel n'illustre qu'un plat réellement servi (il part d'une photo de ce plat) ; il ne l'invente pas et ne crée pas une attente que la cuisine ne tiendra pas. Il est présenté comme une suggestion de présentation, jamais comme la photo littérale de l'assiette servie.

Distinguer toujours l'**harmonisation** (recadrage, exposition, miniatures des photos existantes, traitement d'image serveur classique) de la **génération** (nouveau visuel produit par l'IA à partir des photos fournies).

### Casse des entités métier

En prose, les entités métier s'écrivent en minuscule : la commande, un produit, une option, un établissement, la carte. La capitale initiale est réservée aux quatre applications (Onboarding, Commande, Dashboard, Backend) et au terme « le contrat ». Dans les tableaux d'attributs, les diagrammes et le code, les noms d'entités gardent leur casse d'identifiant (`Commande`, `Produit`, `Paiement`).

## Arborescence cible du monorepo

```
surplasse/
├── docs/                    # Documentation Retype (ce site)
├── brand/                   # Charte graphique : tokens, polices, composants, QR
├── api/
│   └── openapi.yaml         # Le contrat, source de vérité de l'API
├── backend/                 # Quarkus (Maven multi-modules)
├── frontends/
│   ├── shared/              # Design system, client API généré, utilitaires
│   ├── onboarding/          # surplasse.com
│   ├── commande/            # {slug}.surplasse.com
│   └── dashboard/           # dashboard.surplasse.com
├── infra/                   # Docker Compose, configuration VPS
└── .github/workflows/       # CI/CD
```

Aujourd'hui existent `docs/`, `brand/`, la préfiguration statique de l'Onboarding, le contrat `api/openapi.yaml` (lint Spectral, chaîne de génération, ADR-0013), le Backend (`common`, `contract`, `catalog`, `order`, `payment`, `identity`, `application`), le package `frontends/shared/`, Commande, le Dashboard minimal et l'infrastructure de domaines locaux sous `infra/local/`. Le paiement local persiste les intentions idempotentes, sérialise les créations concurrentes par une réservation courte, cloisonne toute reprise par session de table et valide dans une même transaction le webhook Stripe, le paiement, la commande et son événement de suivi. Le chemin logiciel Connect fige le compte et la commission sur le paiement, crée une charge directe dans ce compte, initialise Stripe.js dans le même contexte et rapproche le webhook par compte, Payment Intent et mode. La plateforme de test est inscrite à Connect. Le nouveau compte pilote Accounts v2 utilise `dashboard=none` et le composant `account_onboarding` se rend dans une page Surplasse locale, mais ses capacités restent restreintes tant que le titulaire n'a pas terminé l'embarquement. Le Backend relit ses capacités avant chaque paiement et sépare les événements snapshot de paiement des événements fins Accounts v2. Le contrôle opérationnel de prise de commandes est persistant, fermé par défaut et distinct du cycle de vie de l'établissement ; il sérialise la pause avec les nouvelles admissions tout en préservant le suivi, le Dashboard et les webhooks. Le Dashboard couvre la connexion par magic link, la restauration de session, la sélection d'un établissement autorisé, la liste REST des commandes opérationnelles, leur avancement jusqu'au service ou au retrait et leur actualisation par un flux SSE authentifié par établissement. Le cockpit local sous `scripts/dev-cockpit/` est un outil de développement seulement, absent de la production. Le reste est créé au fil de la roadmap.

## Exécution multi-plateformes

Le développement est supporté sur macOS, Windows et Linux. Sous Windows, la référence est WSL2 avec Ubuntu : on y suit les instructions Linux, le développement natif hors WSL2 n'est pas supporté. La production tourne sous Ubuntu LTS sur le VPS : en cas de comportement divergent entre systèmes, Ubuntu fait foi.

**Règle : tout ajout d'un module frontend, d'un module backend, d'un package ou d'un logiciel tiers (PostgreSQL, MinIO, Caddy, ...) s'accompagne, dans le même commit, de sa documentation d'exécution.** Cette documentation précise obligatoirement :

- son rôle et son état réel, disponible ou seulement prévu ;
- sa catégorie d'exécution : développement seulement, build ou CI, ou service de production ;
- sa version de référence ou son image de conteneur épinglée, ses dépendances et ses données ou volumes persistants ;
- ses prérequis, son installation, sa configuration et ses variables, sa commande de lancement, son URL ou son port et sa commande de vérification sur macOS, Windows (WSL2) et Linux ;
- sa destination en production. Un composant absent de la production est explicitement marqué comme tel. Un service de production documente son déploiement, son démarrage, son redémarrage et son contrôle de santé sous Ubuntu LTS ;
- son mode d'arrêt et, s'il conserve des données, sa sauvegarde et sa restauration.

Un module bibliothèque qui ne se lance pas seul le dit explicitement et fournit sa commande de test ou de vérification. Côté développement, la référence vit dans `docs/developpement/index.md`. Côté production, l'équivalent vit dans `docs/operations/`. Une documentation au futur ne suffit plus dès que le composant entre réellement dans le dépôt.

Tout nouveau processus local de longue durée est ajouté au registre du cockpit de développement dans le même commit, avec son URL, son port, sa sonde, sa commande fixe et sa politique d'arrêt. Un module bibliothèque ou un outil interactif qui ne peut pas être piloté de façon sûre est affiché comme dépendance ou documenté comme manuel, jamais transformé en commande arbitraire depuis le navigateur.

## Arborescence de la documentation

```
docs/
├── README.md                        # Accueil : carte de la documentation
├── produit/                         # Vision, personas, fonctionnalités, parcours
│   └── parcours/                    # Les trois parcours détaillés
├── architecture/                    # Vue d'ensemble, frontends, backend, API, données, intégrations, sécurité
├── developpement/                   # Setup, conventions React/Quarkus/API, git, tests, CI/CD
├── operations/                      # Environnements, observabilité, RGPD
├── decisions/                       # ADR numérotés (adr-NNNN-titre.md)
├── roadmap.md
├── glossaire.md
└── AGENTS.md                        # Ce fichier (exclu du build)
```

## Style rédactionnel

- **Langue : français.** Les identifiants de code, noms de fichiers et termes techniques consacrés restent en anglais (`contract-first`, `magic link`, `slug`).
- **Jamais de cadratin ni de demi-cadratin** (les tirets longs). Utiliser deux-points, virgules, parenthèses ou une nouvelle phrase.
- Guillemets français « avec espaces » pour les citations et les libellés d'interface.
- Ton sobre, précis, direct. Pas d'emphase marketing dans la documentation technique (la page vision est la seule exception, elle assume le ton produit).
- Phrases courtes. Une idée par paragraphe. Tableaux pour les faits énumérables, prose pour les explications.
- Dates en toutes lettres ou au format AAAA-MM-JJ. Jamais de date relative (« récemment », « bientôt »).

## Conventions Retype

- Front matter YAML en tête de chaque page : `label` (titre court pour la sidebar), `order` (entier, tri croissant), `icon` (nom Octicon, optionnel), `description` (une phrase, pour le SEO).
- Chaque dossier a un `index.yml` (`label`, `order`, `expanded`) et, s'il a un contenu propre, un `index.md`.
- Liens internes en chemins relatifs vers les fichiers `.md` (`../architecture/api.md`).
- Composants Retype autorisés : callouts (`!!! info`, `!!! warning`), onglets (`+++`), accordéons (`==-`), badges. Ne pas en abuser : un callout par section maximum.
- Diagrammes en ASCII dans des blocs de code (Retype ne rend pas mermaid). Les garder simples et alignés.
- Pas d'images tant qu'il n'y a pas de produit à montrer.

## Workflow git

- **Branche unique `main`, pas de PR** : on committe et on pousse directement, le plus souvent possible (une unité de travail vérifiée = un commit poussé).
- Messages de commit en français, impératif, préfixés par le périmètre : `docs:`, `api:`, `backend:`, `front(commande):`, `infra:`, `ci:`.
- Le build docs doit passer avant tout push touchant `docs/` : `npm run docs:build`.
- **Démo GitHub Pages obligatoire pour toute évolution UI.** Toute modification de `brand/**` ou `frontends/**` doit être validée localement, committée et poussée sur `main` dans la même unité de travail. Le travail n'est terminé que lorsque les workflows `Frontends` et `Pages` ont réussi pour le SHA poussé et que la démo publique a été contrôlée visuellement en vue mobile et bureau, y compris le dernier écran du parcours. Un échec de validation, de déploiement ou un écart visuel est corrigé et redéployé avant de poursuivre la roadmap.

## Build et prévisualisation des docs

```bash
npm install          # une fois
npm run docs:build   # build de vérification (sortie dans docs-site/)
npm run docs:watch   # serveur local avec rechargement
```

Le déploiement est automatique : chaque push sur `main` publie le site (documentation, landing statique, tunnel avec aperçu du Dashboard et assets de marque) sur GitHub Pages via `.github/workflows/pages.yml`.
