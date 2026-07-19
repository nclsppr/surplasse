---
label: "ADR-0004 : trois frontends React"
order: 40
icon: law
description: "Pourquoi Surplasse retient trois applications React séparées (Onboarding, Commande, Dashboard) avec un package partagé, plutôt qu'une application unique ou un framework SSR."
---

# ADR-0004 : trois applications React séparées

## Statut

Accepté, 2026-07-18.

## Contexte

Surplasse expose trois interfaces web à des publics qui n'ont presque rien en commun. Chacune a son domaine, son audience et son budget de performance propre :

| Application | Domaine | Public | Contexte d'usage | Budget de performance |
|---|---|---|---|---|
| **Onboarding** | `surplasse.com` | Restaurateur prospect | Découverte du produit, revendication d'un espace, embarquement | Modéré : page vitrine soignée, tunnel guidé |
| **Commande** | `{slug}.surplasse.com` | Client attablé | Scan d'un QR code, mobile, réseau cellulaire moyen, première visite sans cache | Strict : chaque kilo-octet compte, le premier rendu doit être quasi instantané |
| **Dashboard** | `dashboard.surplasse.com` | Restaurateur au quotidien | Tablette ou poste fixe en salle, sessions longues, temps réel | Souple : la richesse fonctionnelle prime sur le poids initial |

Le front Commande est le cas critique : un client qui scanne un QR code n'a ni application installée, ni cache, ni patience. Il doit voir la carte en une ou deux secondes sur un téléphone quelconque. À l'opposé, le Dashboard est un outil de travail chargé une fois par service, qui peut embarquer des graphiques, des tableaux et un flux temps réel (voir [ADR-0006 : SSE pour le temps réel](adr-0006-sse.md)).

Les rythmes de livraison divergent aussi. Le Dashboard évoluera vite (nouvelles métriques, gestion de la carte, réglages). Le front Commande doit au contraire rester stable : il est en production chez tous les établissements à la fois, et une régression y touche immédiatement des clients attablés. L'Onboarding vit à un troisième rythme, celui du marketing et du tunnel d'embarquement. Coupler ces trois rythmes dans une seule livraison créerait des frictions permanentes.

S'ajoute une contrainte d'exploitation : la cible de déploiement est un VPS avec Docker Compose derrière un reverse proxy (voir [la vue d'ensemble de l'architecture](../architecture/index.md)). L'équipe est réduite et ne souhaite pas opérer de serveur applicatif Node en production : chaque processus serveur supplémentaire est un service à superviser, à redémarrer et à mettre à jour.

Enfin, un point commun réel existe entre les trois fronts et ne doit pas être perdu : la même identité visuelle, le même client d'API généré depuis [le contrat](../architecture/api.md), les mêmes utilitaires (formats de prix, dates). La solution retenue doit organiser ce partage sans recréer le couplage qu'elle cherche à éviter.

La question à trancher : une application unique qui sert les trois publics, plusieurs applications séparées, ou un framework SSR intégré ?

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Trois SPA Vite avec package partagé `frontends/shared/`** | Bundles séparés, chaque front tient son propre budget de performance ; déploiements indépendants ; fronts statiques, aucun serveur Node à opérer ; outillage Vite simple et rapide ; frontières de code alignées sur les frontières de produit | Trois builds et trois pipelines à maintenir ; le partage de code exige une discipline autour de `shared/` ; le SEO du mini-site n'est pas résolu par défaut |
| **Une seule application multi-domaines** | Une seule base de code, un seul build, partage de code trivial ; une seule entrée dans la CI | Le bundle commun grossit au rythme du Dashboard et pénalise Commande, le budget strict devient intenable ; toute livraison couple les trois produits ; routage par domaine et par contexte complexe ; le code des trois publics s'entremêle |
| **Next.js ou Remix en SSR** | SEO natif pour le mini-site ; premier rendu serveur rapide ; framework intégré (routage, données) | Un serveur Node à opérer, superviser et mettre à jour sur le VPS ; complexité d'exploitation sans rapport avec la taille de l'équipe ; couplage fort au framework ; le SSR n'apporte rien au Dashboard ni au tunnel d'embarquement, qui sont des parcours applicatifs |

L'application unique échoue sur le critère décisif : le budget de performance de Commande. Aucune discipline de code splitting ne protège durablement un bundle commun quand le Dashboard accumule des graphiques et des tableaux ; la seule protection fiable est structurelle, des builds séparés.

L'option SSR échoue sur le critère d'exploitation. Son seul apport réel pour Surplasse est le SEO du mini-site, un besoin localisé sur quelques pages publiques de Commande. Adopter un serveur applicatif Node pour l'ensemble des trois fronts afin de résoudre ce besoin localisé serait disproportionné : le pré-rendu léger le couvre à coût d'exploitation nul.

Les trois SPA séparées ont un coût réel (trois builds, discipline de partage), mais ce coût est du travail d'outillage ponctuel, pas de la complexité d'exploitation permanente. C'est l'arbitrage retenu.

## Décision

Surplasse retient **trois applications React 19 séparées, construites avec Vite en TypeScript strict**, une par produit : Onboarding, Commande et Dashboard. Elles vivent dans le monorepo sous `frontends/` et partagent un unique package `frontends/shared/`.

```
surplasse.com           {slug}.surplasse.com      dashboard.surplasse.com
      |                          |                          |
+--------------+         +--------------+          +--------------+
|  Onboarding  |         |   Commande   |          |   Dashboard  |
|   SPA Vite   |         |   SPA Vite   |          |   SPA Vite   |
+--------------+         +--------------+          +--------------+
        \                        |                        /
         \                +---------------+              /
          +-------------- |    shared/    | ------------+
                          +---------------+
                          design system,
                          client TypeScript genere
                          depuis le contrat,
                          utilitaires
                                 |
                     api.surplasse.com (backend Quarkus)
```

### Le package partagé

Le package `shared/` contient trois choses, et seulement trois :

| Contenu | Rôle | Source |
|---|---|---|
| Design system | Composants d'interface, jetons de style, cohérence visuelle des trois fronts | Conçu dans le monorepo |
| Client d'API | Types et fonctions d'appel TypeScript | Généré depuis [le contrat](../architecture/api.md), jamais écrit à la main |
| Utilitaires | Formats de prix et de dates, validation, i18n | Conçu dans le monorepo |

Deux règles de dépendance, vérifiables en CI :

- les applications ne s'importent jamais l'une l'autre : tout passage de code d'un front à un autre transite par `shared/` ;
- `shared/` n'importe aucune application : le graphe de dépendances est strictement descendant.

### Build et service

Chaque application est compilée en fichiers statiques et servie par le reverse proxy du VPS. Aucun processus Node ne tourne en production. L'état serveur est géré par TanStack Query dans chaque front, au-dessus du client généré. Le routage par domaine (`surplasse.com`, `{slug}.surplasse.com`, `dashboard.surplasse.com`) est assuré par le reverse proxy, chaque domaine servant le build de son application.

### Le cas du SEO

Le SEO du mini-site (le seul front où il compte : un établissement doit être trouvable par son nom) sera traité par un pré-rendu léger des pages publiques au build ou à la génération de l'Espace. Le mécanisme exact reste à trancher : il fera l'objet d'un ADR dédié quand le besoin sera réel, c'est-à-dire quand les premiers mini-sites seront en ligne. Cette décision-ci n'exclut aucune des pistes (pré-rendu statique, rendu à la volée en périphérie), elle exclut seulement d'adopter un framework SSR complet pour ce seul besoin.

!!! info Cible de référence
Au moment de la décision, le monorepo précédait encore l'introduction du code applicatif. Cet ADR a fixé la structure respectée depuis par la première itération de la [roadmap](../roadmap.md), en cohérence avec [l'architecture des frontends](../architecture/frontends.md).
!!!

## Conséquences

### Positives

- Chaque front tient son budget : Commande reste minuscule quoi qu'il arrive au Dashboard. Aucune dépendance lourde ne peut fuiter d'un produit vers un autre, la séparation des builds l'empêche mécaniquement.
- Les déploiements sont indépendants : livrer une évolution du Dashboard ne touche ni le tunnel d'embarquement ni les mini-sites en production. Un incident de build sur un front ne bloque pas les deux autres.
- La surface d'exploitation est minimale : des fichiers statiques derrière le reverse proxy, pas de runtime JavaScript côté serveur à surveiller ni à corriger. Le retour arrière d'un déploiement consiste à resservir les fichiers précédents.
- Le contrat reste l'unique source de vérité : les trois fronts consomment le même client généré, une évolution d'API se propage de façon uniforme et se détecte à la compilation TypeScript.
- Les frontières de code reflètent les frontières de produit, ce qui simplifie l'attribution du travail, la revue et la lecture du monorepo.
- L'outillage reste homogène : trois fois la même stack (React 19, TypeScript strict, Vite, TanStack Query), pas trois technologies différentes à connaître.

### Négatives et dettes assumées

- Trois builds, trois pipelines CI, trois lots de dépendances à tenir à jour. Le coût est assumé ; l'outillage (workflows GitHub Actions factorisés, `shared/` versionné avec le reste du monorepo) doit le contenir.
- Le partage via `shared/` exige de la discipline : un changement cassant dans le design system ou le client généré impacte les trois fronts d'un coup. La règle « jamais d'import direct entre applications » doit être vérifiée en CI.
- Le SEO du mini-site n'est pas résolu par cette décision. C'est une dette explicite : le pré-rendu léger est la piste retenue, l'ADR dédié reste à écrire.
- Un risque de divergence visuelle existe si une application contourne le design system de `shared/`. La revue de code et le design system lui-même sont les garde-fous.
- Les dépendances se mettent à jour en trois endroits. La mitigation est de centraliser les versions communes (React, TypeScript, Vite) à la racine du workspace, pour qu'une montée de version se fasse en un seul geste.

Cette décision sera remise en question si l'un des signaux suivants apparaît : le pré-rendu léger ne suffit plus au SEO du mini-site (l'ADR dédié tranchera), ou la duplication entre fronts déborde ce que `shared/` peut raisonnablement absorber.

Décisions liées : [ADR-0005 : PostgreSQL comme unique moteur de données](adr-0005-postgresql.md), [ADR-0006 : SSE pour le temps réel](adr-0006-sse.md).
