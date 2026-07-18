---
label: "ADR-0014 : Liaison de frontends/shared"
order: 140
icon: law
description: "Comment les trois frontends consomment le package partagé : dépendance file:, paquet interne consommé en source TypeScript, sans étape de build ni workspace global."
---

# ADR-0014 : Liaison de frontends/shared

## Statut

Accepté, 2026-07-18.

## Contexte

Le package `frontends/shared/` porte le client API généré, les fabriques de clés TanStack Query, les briques du design system et les utilitaires transverses. Les trois frontends le consomment. Le [setup](../developpement/index.md) fixait deux contraintes en laissant le mécanisme exact ouvert :

- **Pas de workspace npm global** à la racine du monorepo : chaque application reste installable et lançable indépendamment (`cd frontends/commande && npm install` suffit).
- Les trois frontends utilisent Vite, qui sait transformer du TypeScript de dépendances locales sans étape de compilation préalable.

La question a deux volets : comment npm résout `@surplasse/shared` depuis chaque front, et sous quelle forme (source ou buildée) le paquet est consommé.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Dépendance `file:../shared`, consommée en source TypeScript** | npm crée un lien symbolique et installe les dépendances du paquet lié : chaque front reste autonome ; aucune étape de build ni de watch pour `shared/` ; toute modification est visible immédiatement dans les trois fronts | `shared/` n'est pas compilée isolément : son typage est vérifié par les fronts qui l'importent ; il faut déclarer React en `peerDependency` pour éviter une double instance |
| npm workspaces (racine `frontends/`) | Déduplication des `node_modules`, outillage npm natif | `npm install` dans un front remonte au workspace et installe tout : contredit la contrainte d'indépendance des applications ; introduit un `package.json` de racine intermédiaire à maintenir |
| Paquet buildé (`npm pack` ou registre privé) | Frontière nette, typage vérifié à la publication | Étape de build et de version à orchestrer en continu pour un paquet interne à un seul dépôt : de la friction sans bénéfice à cette échelle |
| Copie du code dans chaque front | Aucun outillage | Trois copies qui divergent : exactement ce que `shared/` existe pour empêcher |

## Décision

Nous retenons la **dépendance `file:../shared` consommée en source TypeScript**, parce que c'est le seul montage qui respecte l'indépendance de chaque application sans introduire ni étape de build ni workspace :

- Chaque front déclare `"@surplasse/shared": "file:../shared"` dans ses `dependencies`. `npm install` dans le front crée le lien symbolique ; `shared/` s'installe une fois (`npm install` dans `frontends/shared/`) pour ses dépendances de développement, nécessaires au typecheck des fronts qui le consomment en source.
- `shared/` est un **paquet interne source** : son `exports` pointe vers `src/index.ts`. Vite (dev et build) et Vitest transforment ce TypeScript comme celui du front ; `tsc --noEmit` du front le vérifie dans la même passe.
- `shared/` déclare `react` et `@tanstack/react-query` en **`peerDependencies`** : une seule instance de chaque, celle du front hôte.
- `shared/` n'a pas de version significative (`0.0.0`) : dans un monorepo à branche unique, la version de `shared/` est le commit.

## Conséquences

### Positives

- Aucune étape de build, de watch ou de publication : modifier `shared/` et recharger le front suffit.
- Chaque application reste installable et lançable seule, conformément au setup.
- Le client généré et le design system vivent à un seul endroit, consommés à l'identique par les trois fronts.

### Négatives et dettes assumées

- `shared/` n'est pas typecheckée ni testée isolément : ses tests tournent avec Vitest dans son propre répertoire, mais son typage n'est garanti que par les fronts qui l'importent. Si une partie de `shared/` cesse d'être importée, son typage n'est plus vérifié ; dette assumée à cette échelle.
- Les dépendances de `shared/` sont installées dans chaque front (pas de déduplication globale) : un peu d'espace disque contre l'indépendance des applications.
- Le lien symbolique impose `preserveSymlinks: false` (défaut Vite) et une configuration Vitest qui inline le paquet ; c'est de la configuration, pas du code, mais elle doit rester identique dans les trois fronts.
