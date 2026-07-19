---
label: Frontends
order: 20
icon: browser
description: Le socle React commun, le package partagé et les spécificités des trois applications Onboarding, Commande et Dashboard.
---

# Frontends

Surplasse expose trois applications web distinctes : **Onboarding** (vitrine et embarquement des restaurateurs), **Commande** (mini-site et commande client) et **Dashboard** (pilotage temps réel côté restaurant). Elles partagent un socle technique unique et un package commun, mais restent trois applications séparées, déployées indépendamment, chacune optimisée pour son public et son contexte d'usage. Cette page décrit la cible de référence : aucun code applicatif n'existe encore.

Le choix de trois applications React distinctes plutôt qu'une application unique ou qu'un framework SSR est motivé dans [l'ADR 0004](../decisions/adr-0004-trois-frontends-react.md).

## Le socle commun

Les trois applications reposent sur la même fondation, sans exception :

| Brique | Choix | Rôle |
|---|---|---|
| Framework | React 19 | Composants fonction, hooks, Suspense |
| Langage | TypeScript strict | `strict: true`, pas de `any` implicite |
| Build | Vite | Dev server, build de production, code splitting |
| État serveur | TanStack Query 5 | Cache, invalidation, mutations, retry |
| Routage | React Router | Routage client, lazy loading par route |
| i18n | Prêt dès le départ | Aucune chaîne en dur dans les composants |

TanStack Query porte tout l'état serveur : données de la carte, commandes, métriques. L'état local restant (panier en cours, formulaires, préférences d'interface) reste dans React (`useState`, `useReducer`, contexte). Il n'y a pas de store global : Redux est volontairement exclu (voir [ce qui est exclu](#ce-qui-est-volontairement-exclu)).

L'internationalisation est câblée dès la première ligne : toutes les chaînes visibles passent par le mécanisme i18n, même si le français est la seule langue au lancement. Ce choix coûte peu au départ et évite une migration massive plus tard. La bibliothèque i18n précise reste à trancher (elle sera fixée dans [les conventions React](../developpement/conventions-react.md)).

Les conventions de code détaillées (nommage, hooks, tests de composants, lint) sont documentées dans [Conventions React](../developpement/conventions-react.md).

### Le package partagé `frontends/shared/`

Tout ce qui est commun aux trois applications vit dans `frontends/shared/`, consommé comme un package du workspace. Structure cible :

```
frontends/shared/
├── src/
│   ├── design-system/     # Composants UI de base, tokens, thème (voir docs design system)
│   │   ├── tokens/        # Couleurs, typographie, espacements (variables CSS)
│   │   ├── fonts/         # Polices auto-hébergées (Archivo, Space Mono, Parisienne)
│   │   └── components/    # Button, Input, Card, Modal, Toast...
│   ├── api/               # Client TypeScript GÉNÉRÉ depuis le contrat
│   │   ├── client/        # Fonctions d'appel typées (générées, jamais éditées)
│   │   └── types/         # Types des ressources (générés, jamais édités)
│   ├── utils/             # Formatage prix, dates, slug, validation légère
│   └── types/             # Types transverses non issus du contrat
└── package.json
```

Le client API est généré depuis [le contrat OpenAPI](api.md) (`api/openapi.yaml`) à chaque évolution de celui-ci. Les fichiers générés ne sont jamais modifiés à la main : toute correction passe par le contrat, puis par une régénération. Les hooks TanStack Query qui enveloppent ce client vivent dans chaque application (au plus près des features qui les consomment), pas dans `shared/`.

!!! warning Règle d'or de `shared/`
Aucune logique métier serveur n'est dupliquée dans `shared/` ni dans aucun frontend. Le calcul d'un total de commande, la validation des règles d'une option, la disponibilité d'un produit : tout cela appartient au backend, seul juge. Les frontends affichent ce que l'API retourne et se limitent à de la validation de confort (champ vide, format d'email) qui ne fait jamais autorité.
!!!

## Les trois applications en un tableau

| | **Commande** | **Dashboard** | **Onboarding** |
|---|---|---|---|
| Domaine | `{slug}.surplasse.com` | `dashboard.surplasse.com` | `surplasse.com` |
| Public | Le client à table ou en mobilité | Le restaurateur et son équipe | Le restaurateur prospect |
| Cible d'appareil | Mobile d'abord, exclusivement pensé téléphone | Desktop et tablette d'abord | Desktop et mobile à parité |
| Exigence de performance | Critique : budget strict, réseau mobile supposé | Confortable : réseau du restaurant, session longue | Standard : bonne première impression |
| Mode de rendu | SPA, avec pré-rendu léger des pages vitrine (à confirmer par ADR) | SPA pure, derrière authentification | SPA, pré-rendu des pages marketing envisagé |
| Temps réel | Oui : flux SSE de suivi de la commande ([ADR-0006](../decisions/adr-0006-sse.md)) ; polling en repli si le flux ne s'établit pas | Oui : flux SSE des commandes entrantes | Non |
| Authentification | Aucune : le client n'a jamais de compte | Magic link par email | Magic link en fin de tunnel |

## Commande : l'application critique

Commande est l'application qui porte le produit. C'est elle que voit le client final, sur son téléphone, souvent en 4G, parfois avec une main occupée par un menu papier. Chaque choix technique de cette application découle d'une contrainte : **la carte doit être interactive en moins de 2 secondes sur une connexion 4G**.

### Budget de performance

| Métrique | Cible | Mesure |
|---|---|---|
| Carte interactive (TTI sur la page carte) | < 2 s en 4G | Lighthouse, profil « Slow 4G » |
| Budget JavaScript initial | À définir et à documenter ici | Taille du bundle d'entrée, gzippé |
| Largest Contentful Paint | < 1,5 s en 4G | Lighthouse |
| Images de produits | Formats modernes, lazy loading, tailles servies adaptées | Audit au build |

!!! warning Budget JS initial : à chiffrer
La valeur exacte du budget JavaScript initial reste à définir (ordre de grandeur visé : quelques dizaines de kilooctets gzippés pour le bundle d'entrée). Elle sera fixée après les premiers prototypes, documentée dans ce tableau et vérifiée en CI : un dépassement fait échouer le build.
!!!

Conséquences concrètes : code splitting agressif par route (la page de paiement ne se charge pas avant que le panier existe), aucune dépendance lourde dans le chemin critique, polices système ou une seule police au chargement contrôlé.

### Thème par établissement

Chaque mini-site porte l'identité de son établissement : c'est le cœur du positionnement (le restaurant garde son identité, Surplasse s'efface). Les couleurs et éléments d'identité sont extraits lors de l'embarquement (analyse des photos et des données publiques par l'API OpenAI, voir [les intégrations](integrations.md)) et stockés côté backend comme configuration de l'établissement.

Au chargement, l'application récupère cette configuration et l'injecte sous forme de variables CSS :

```
:root {
  --brand-primary: #7a3b2e;      /* extraite à l'embarquement */
  --brand-surface: #faf6f1;
  --brand-accent:  #c9a227;
  --brand-radius:  8px;
}
```

Les composants du design system consomment exclusivement ces variables. Un seul bundle sert donc tous les établissements : le thème est de la donnée, pas du code. Le restaurateur peut ajuster ces valeurs depuis le Dashboard. L'identité de base (logo, polices, palette) est fixée dans [le design system](design-system.md).

### Résolution du slug par sous-domaine

Chaque établissement est servi sur `{slug}.surplasse.com`. Une entrée DNS wildcard (`*.surplasse.com`) dirige tous les sous-domaines vers la même instance de l'application Commande. Au démarrage, l'application lit le `hostname`, en extrait le slug et interroge l'API pour résoudre l'établissement :

```
  client                    DNS                    Commande (SPA)
    |                        |                          |
    |  chez-luigi.surplasse.com                         |
    |----------------------->|  *.surplasse.com         |
    |                        |------------------------->|
    |                        |                          |  slug = "chez-luigi"
    |                        |                          |
    |                        |            GET /etablissements/by-slug/chez-luigi
    |                        |                          |------------> backend
    |                        |                          |<------------ config,
    |                        |                          |   thème, carte
```

Un slug inconnu affiche une page neutre Surplasse (pas d'erreur brute). Le certificat TLS wildcard et la configuration du reverse proxy sont décrits côté [infrastructure](../operations/environnements.md).

### SEO du mini-site

Le mini-site est aussi la vitrine web de l'établissement : il doit être trouvable sur « chez luigi + ville ». Or une SPA pure sert un HTML vide aux robots. L'option de référence est la suivante : **SPA avec pré-rendu léger des pages vitrine** (accueil de l'établissement, carte en lecture seule, informations pratiques), généré au build ou à la volée avec mise en cache, pendant que le parcours de commande lui-même reste une SPA classique (il n'a aucun besoin SEO, on y accède par QR code).

!!! info Décision ouverte
Le mécanisme exact de pré-rendu (pré-rendu au build par établissement, rendu à la demande mis en cache, ou balises meta dynamiques seules dans un premier temps) fera l'objet d'un ADR dédié dans [les décisions](../decisions/index.md). Le principe est acquis, la mécanique reste à trancher.
!!!

## Dashboard : le poste de pilotage

Le Dashboard vit sur le comptoir ou en cuisine, souvent sur une tablette posée près de la caisse, parfois sur le PC du bureau. Il est pensé **desktop et tablette d'abord** : densité d'information, zones tactiles généreuses pour la tablette, sessions ouvertes des heures durant.

Ses traits distinctifs :

- **Flux SSE des commandes** : le Dashboard maintient une connexion Server-Sent Events vers le backend (voir [l'API](api.md)) pour recevoir chaque nouvelle commande sans polling. La reconnexion est automatique avec repli exponentiel, et chaque reconnexion déclenche une resynchronisation via TanStack Query pour rattraper les événements manqués. L'état de la connexion est visible en permanence dans l'interface : un service en plein rush doit savoir s'il est à jour.
- **Notifications sonores** : une nouvelle commande émet un signal sonore, activable et réglable par le restaurateur. Le son est un canal de premier ordre en cuisine, pas un gadget.
- **Data-viz sobre** : les métriques (chiffre d'affaires, volume de commandes, produits les plus vendus) sont présentées avec des graphiques simples et lisibles, sans bibliothèque de charting lourde ni animation décorative. Les chiffres priment sur le spectacle.

Le détail fonctionnel des écrans est décrit dans [le parcours restaurateur](../produit/parcours/dashboard-restaurateur.md).

## Onboarding : la porte d'entrée

Onboarding est le site public de Surplasse sur `surplasse.com`. Il joue quatre rôles complémentaires :

1. **La homepage** : elle porte le manifeste produit (« Le circuit court de la commande »), démontre le produit, présente le positionnement et les tarifs, puis conduit le restaurateur vers l'embarquement. C'est la seule surface où le ton marketing est assumé.
2. **Le tunnel d'embarquement** : le parcours qui transforme un visiteur en restaurateur actif. Nom de l'établissement, téléversement de la photo de la carte et de quelques images, génération du mini-site, activation par magic link. Le téléversement de photos est soigné (compression côté client avant envoi, reprise en cas de coupure, aperçu immédiat) car c'est le moment de vérité du produit. Le tunnel gère aussi la revendication d'un espace pré-généré quand l'établissement a été identifié en amont.
3. **La documentation publique destinée aux restaurateurs** : elle explique le fonctionnement, les paiements, la commission Surplasse et les frais Stripe dans un langage accessible avant l'activation.
4. **Le blog** : il publie des articles utiles aux restaurateurs et porte la stratégie de contenu, de référencement et de SEO global de `surplasse.com`.

Le détail pas à pas du tunnel vit dans [le parcours d'embarquement](../produit/parcours/onboarding-restaurateur.md). Le séquencement de la documentation publique et du blog est fixé dans la [roadmap](../roadmap.md).

## Structure de dossiers par application

Chaque application est découpée **par feature, pas par type technique** : on ne range pas tous les hooks ensemble et tous les composants ailleurs, on regroupe tout ce qui concerne une fonctionnalité au même endroit. Exemple avec Commande :

```
frontends/commande/
├── src/
│   ├── app/                    # Racine : providers, router, layout global
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx       # QueryClient, thème, i18n
│   ├── features/
│   │   ├── carte/              # Affichage de la carte, catégories, produits
│   │   │   ├── components/
│   │   │   ├── hooks/          # useCarte() : enveloppe TanStack Query
│   │   │   └── index.ts        # API publique de la feature
│   │   ├── panier/             # Panier, options, quantités
│   │   ├── paiement/           # Tunnel Stripe (chargé en lazy)
│   │   └── suivi/              # Statut de la commande après paiement
│   ├── theme/                  # Injection des variables CSS de l'établissement
│   └── i18n/                   # Configuration et catalogues de traduction
├── index.html
├── vite.config.ts
└── package.json
```

Règles associées :

- Une feature n'importe jamais les fichiers internes d'une autre feature : uniquement son `index.ts`.
- Ce qui sert à deux features ou plus remonte : dans `app/` s'il est propre à l'application, dans `shared/` s'il est propre à Surplasse.
- Les hooks d'accès aux données vivent dans la feature qui les possède et enveloppent le client généré de `shared/api/`.

Dashboard et Onboarding suivent la même structure avec leurs propres features (`commandes/`, `carte-gestion/`, `metriques/` pour l'un ; `vitrine/`, `embarquement/`, `revendication/` pour l'autre).

## Ce qui est volontairement exclu

| Exclu | Pourquoi |
|---|---|
| Redux (et tout store global) | TanStack Query couvre l'état serveur, React suffit pour le reste ; un store global ajouterait de l'indirection sans besoin identifié |
| styled-components (et le CSS-in-JS runtime) | Coût JavaScript à l'exécution incompatible avec le budget de Commande ; le design system repose sur des variables CSS et des classes |
| SSR lourd type Next.js | Trois SPA ciblées et un pré-rendu léger là où le SEO l'exige suffisent ; un framework SSR complet ajouterait une infrastructure de rendu serveur que rien ne justifie |

La motivation complète de ces exclusions, et du choix de trois applications distinctes, est consignée dans [l'ADR 0004 : trois frontends React](../decisions/adr-0004-trois-frontends-react.md). Si un besoin futur remet ces choix en cause (par exemple un SEO qui exigerait un vrai rendu serveur), la révision passera par un nouvel ADR, pas par une exception silencieuse.
