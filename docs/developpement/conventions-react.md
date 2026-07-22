---
label: Conventions React
order: 30
icon: code
description: Conventions de code des frontends React de Surplasse, structure par feature, TypeScript strict, TanStack Query, styles et accessibilité.
---

# Conventions React

Cette page fixe les conventions de code communes aux trois frontends React (Onboarding, Commande, Dashboard) et au package partagé `frontends/shared/`. Elle complète la [vue d'ensemble des frontends](../architecture/frontends.md) et s'appuie sur [le contrat OpenAPI](../architecture/api.md), source de vérité des types d'API.

Ces conventions s'appliquent au code front depuis la phase 1 (`frontends/shared/` et le front Commande). Les points explicitement signalés comme « à trancher » feront l'objet d'un ADR sous `docs/decisions/` au moment de leur première mise en pratique. La liaison du package partagé est actée par l'[ADR-0014](../decisions/adr-0014-liaison-shared.md). La détection de code mort passe par ESLint (`@typescript-eslint/no-unused-vars`), pas par `tsc` : le client généré en est ainsi exempté sans affaiblir le code écrit main.

## Structure de dossiers par feature

Chaque frontend organise son code par fonctionnalité métier, pas par type technique. Un dossier `features/` regroupe les features, chacune autonome : ses composants, ses hooks, son point d'entrée. Exemple pour le front Commande :

```
frontends/commande/
├── src/
│   ├── features/
│   │   ├── menu/                   # Consultation de la carte
│   │   │   ├── MenuPage.tsx        # Point d'entrée de la feature
│   │   │   ├── components/
│   │   │   │   ├── CategorySection.tsx
│   │   │   │   ├── ProductCard.tsx
│   │   │   │   └── OptionsPicker.tsx
│   │   │   └── hooks/
│   │   │       └── useMenu.ts
│   │   ├── cart/                   # Constitution du panier
│   │   │   ├── CartDrawer.tsx      # Point d'entrée de la feature
│   │   │   ├── components/
│   │   │   │   ├── CartLine.tsx
│   │   │   │   └── CartSummary.tsx
│   │   │   └── hooks/
│   │   │       └── useCart.ts
│   │   ├── payment/                # Paiement Stripe
│   │   │   ├── PaymentPage.tsx     # Point d'entrée de la feature
│   │   │   ├── components/
│   │   │   │   └── PaymentForm.tsx
│   │   │   └── hooks/
│   │   │       └── usePayment.ts
│   │   └── tracking/               # Suivi de la commande
│   │       ├── TrackingPage.tsx    # Point d'entrée de la feature
│   │       ├── components/
│   │       │   └── OrderStatus.tsx
│   │       └── hooks/
│   │           └── useOrderTracking.ts
│   ├── app/                        # Routage, providers, layout global
│   └── main.tsx
```

Règles de dépendance : une feature peut importer depuis `shared/` et depuis `app/`, jamais depuis une autre feature. Si deux features ont besoin du même code, ce code monte dans `shared/` (s'il sert plusieurs applications) ou dans un dossier commun de l'application (s'il ne sert que celle-ci).

### Ce qui va dans `frontends/shared/`

| Contenu | Exemple |
|---|---|
| Le client API généré depuis le contrat | types et fonctions d'appel typées |
| Le design system | composants d'interface génériques (bouton, champ, modale), tokens |
| Les utilitaires transverses | formatage des prix et dates, helpers i18n |
| La configuration TanStack Query partagée | client par défaut, conventions de clés |

### Ce qui n'y va pas

| Contenu | Où il vit |
|---|---|
| Logique métier d'une application | dans les hooks de la feature concernée |
| Composants liés à un parcours précis | dans la feature concernée |
| État d'écran ou de formulaire | dans la feature concernée |
| Code utilisé par une seule application | dans cette application |

`shared/` n'est pas un fourre-tout : un module n'y entre que lorsqu'au moins deux applications l'utilisent réellement, ou qu'il fait partie du design system par nature.

## TypeScript strict

Les trois frontends et `shared/` compilent en mode `strict` (toutes les options strictes de TypeScript activées). Deux règles complètent ce socle :

- **Pas de `any`, pas de non-null assertion (`!`)** sans un commentaire adjacent qui justifie l'exception. Une exception non justifiée est refusée en revue.
- **Les types d'API viennent exclusivement des types générés depuis [le contrat](../architecture/api.md).** Redéfinir manuellement un type d'API (une `Order`, un `Product`, une réponse d'endpoint) est interdit : la redéfinition dérive silencieusement du contrat et masque les ruptures. Les types applicatifs (état d'un écran, props d'un composant) peuvent dériver des types générés (`Pick`, `Omit`, extension), jamais les recopier.

!!! warning Un seul point d'entrée pour les types d'API
Si un type généré ne convient pas (champ manquant, forme inadaptée), la correction se fait dans le contrat OpenAPI, puis les clients sont régénérés. Jamais dans le code front.
!!!

## Composants

| Règle | Détail |
|---|---|
| Fonctions uniquement | Pas de composant classe. |
| Nommage | PascalCase, le nom du fichier égale le nom du composant (`ProductCard.tsx`). |
| Un composant exporté par fichier | Les sous-composants privés non exportés sont tolérés s'ils restent petits. |
| Props typées explicitement | Un type `Props` déclaré par composant, pas de `React.FC`. |
| Pas de logique métier | Un composant affiche et délègue. |

La logique métier (calcul du total du panier, règles de disponibilité d'un produit, agrégation de métriques) vit dans des hooks ou dans des fonctions pures, testables sans rendu React. Un composant qui dépasse l'affichage et l'orchestration d'événements doit être découpé : la logique part dans un hook de la feature, ou dans une fonction pure si elle n'a pas besoin de React.

Ce découpage rend la logique testable avec des tests unitaires rapides (voir les conventions de test dans le dossier `developpement/`), et garde les composants courts et lisibles.

## TanStack Query

TanStack Query 5 gère tout l'état serveur des trois applications. Aucun appel réseau ne passe en dehors d'elle et du client généré.

### Clés de requête

Les clés sont des tableaux hiérarchiques, du plus général au plus spécifique, une hiérarchie par ressource. La racine est le nom de la ressource au singulier, en anglais (aligné sur les identifiants du contrat) :

```
['menu', establishmentId]                     # la carte d'un établissement
['order', 'list', establishmentId]            # les commandes d'un établissement
['order', 'detail', orderId]                  # une commande précise
['establishment', establishmentId]            # un établissement
['metrics', establishmentId, { period }]      # métriques avec paramètres
```

Cette hiérarchie permet l'invalidation par préfixe : invalider `['order']` rafraîchit toutes les requêtes de commandes, invalider `['order', 'detail', orderId]` ne touche qu'une commande. Les fabriques de clés sont centralisées dans `shared/` pour éviter les clés construites à la main et divergentes.

### Invalidation après mutation

Toute mutation invalide les clés des données qu'elle a modifiées, dans son `onSuccess`. Exemple : la mutation qui change le statut d'une commande côté Dashboard invalide `['order', 'detail', orderId]` et `['order', 'list', establishmentId]`. Une mutation sans invalidation est un bug : l'interface afficherait des données périmées.

### États de chargement et d'erreur

Chaque requête gère explicitement ses trois états : chargement, erreur, succès. Un écran qui ignore l'échec d'une requête est refusé en revue. Concrètement :

- l'état de chargement affiche un squelette ou un indicateur, jamais un écran vide ;
- l'état d'erreur affiche un message compréhensible et, quand l'action est rejouable, un bouton de nouvelle tentative ;
- les erreurs de mutation (paiement refusé, validation échouée) remontent à l'utilisateur, jamais silencieusement dans la console.

### SSE et cache Query

Côté Dashboard, le flux SSE du backend (nouvelles commandes, changements de statut) alimente directement le cache Query : à la réception d'un événement, le code met à jour les données en cache (`setQueryData`) ou invalide la clé concernée. Les composants du Dashboard ne consomment jamais le flux SSE directement : ils lisent le cache Query comme pour n'importe quelle donnée, et le temps réel reste un détail d'implémentation du hook qui gère la connexion SSE. Le détail du flux est décrit dans la [page frontends](../architecture/frontends.md).

## Résolution de l'établissement (front Commande)

Le front Commande sert un établissement à la fois. Le slug est résolu une fois au démarrage, dans `app/` (fonction `resolveEstablishmentSlug`) :

- **En production**, le slug est le sous-domaine direct du mini-site (`{slug}.surplasse.com`).
- **En développement**, la même résolution s'applique sur `{slug}.surplasse.test`. Les deux suffixes viennent du profil `APP_BASE_DOMAIN`, sans hypothèse sur `.com`.
- Les noms `www`, `api`, `dashboard`, `docs`, `app`, `admin`, `local`, `mail` et `reports`, ainsi que les hôtes hors plateforme ou imbriqués, ne sont jamais traités comme des établissements.
- Commande refuse tout hostname qui n'est pas un sous-domaine établissement direct du domaine configuré. Aucun slug de repli ne permet un diagnostic par port Vite.

## Formulaires

Les besoins en formulaires sont contrastés : le front Commande n'a presque que le paiement (largement délégué aux composants Stripe), l'Onboarding a le tunnel d'embarquement, le Dashboard a l'édition de la carte.

!!! info À trancher à la première vraie feature
Le choix entre état local React et react-hook-form n'est pas arrêté. Il sera tranché lors de la première feature comportant un vrai formulaire (probablement le tunnel d'embarquement) et consigné dans un ADR. D'ici là, aucune page ne doit présumer de l'un ou de l'autre.
!!!

Quelle que soit la solution retenue, la validation côté client est le miroir de celle du contrat : mêmes champs obligatoires, mêmes formats, mêmes bornes. Le contrat reste l'autorité, la validation client n'est qu'un confort d'interface (retour immédiat) et ne remplace jamais la validation backend.

## Styles

Le choix acté ([ADR-0012](../decisions/adr-0012-tailwind-shadcn.md)) : **Tailwind CSS et shadcn/ui**, alimentés par les tokens du [design system](../architecture/design-system.md) dans `shared/` sous forme de variables CSS. Les composants sont reconstruits sur shadcn (Radix) au look Bistro premium, en prenant les composants et UI kits Claude Design comme référence. Les variables CSS portent notamment le thème par établissement du front Commande (couleurs et typographie propres à chaque mini-site), appliqué à l'exécution sans recompilation.

Ce qui est ferme :

- pas de styled-components ;
- pas de CSS-in-JS à l'exécution (styles calculés en JavaScript au rendu), quel que soit l'outil.

Ces approches ajoutent un coût à l'exécution et une dépendance forte, incompatibles avec l'objectif de légèreté du front Commande (voir la [page frontends](../architecture/frontends.md)).

## Accessibilité minimale exigée

Ces exigences sont bloquantes dès le premier composant, pas un chantier reporté :

| Exigence | Détail |
|---|---|
| Cibles tactiles | 44 x 44 px minimum sur le front Commande (usage au téléphone, à table). |
| Contrastes | Ratio conforme WCAG AA, y compris avec les thèmes par établissement (le contraste est vérifié pour chaque thème généré). |
| Navigation clavier | Le Dashboard est entièrement utilisable au clavier : ordre de focus logique, focus visible, aucune action accessible uniquement à la souris. |
| Alternatives textuelles | Chaque photo de produit a un texte alternatif (le nom du produit par défaut, généré avec la carte). |

## i18n

Les chaînes de l'interface sont externalisées dès le premier composant : aucune chaîne visible par l'utilisateur en dur dans le JSX. Le français est la langue par défaut et la seule langue du MVP. Externaliser dès le départ coûte peu et évite une migration douloureuse le jour où le front Commande devra servir des clients non francophones (touristes scannant un QR code). L'outil d'i18n (bibliothèque, format des fichiers de traduction) reste à trancher, avec le même mécanisme d'ADR que les autres choix différés.

## Interdits

| Interdit | Raison |
|---|---|
| Redux (et tout store global d'état serveur) | TanStack Query couvre l'état serveur ; l'état local suffit au reste. Un store global ajoute de l'indirection sans besoin identifié. |
| `fetch` ou client HTTP manuel hors client généré | Contourne le contrat : types non garantis, endpoints non vérifiés, dérive silencieuse. |
| Logique métier dans les composants | Intestable sans rendu, dupliquée entre écrans, composants illisibles. |
| `any` et non-null assertion sans justification | Désactive localement le typage : les erreurs réapparaissent à l'exécution, chez le client. |
| styled-components et CSS-in-JS à l'exécution | Coût à l'exécution, poids du bundle, incompatible avec l'exigence de légèreté du front Commande. |

En cas de doute sur un cas limite, la question se règle en discussion puis, si la réponse est structurante, dans un ADR : jamais par une exception silencieuse dans le code.
