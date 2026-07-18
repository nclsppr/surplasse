---
label: "ADR-0012 : Tailwind et shadcn/ui"
order: 120
icon: law
description: "Pourquoi Surplasse construit sa couche de composants avec Tailwind et shadcn/ui, alimentée par les tokens du design system, plutôt que de synchroniser les composants Claude Design tels quels."
---

# ADR-0012 : Tailwind et shadcn/ui

## Statut

Accepté, 2026-07-18.

## Contexte

Le [design system](../architecture/design-system.md) « Bistro premium » existe dans un projet Claude Design : des tokens (couleurs, typographie, espacement), une bibliothèque de composants (Button, Card, Input, Dialog, Tabs, etc.) et trois UI kits (marketing, menu, dashboard). La question : comment matérialiser cette couche de composants dans les trois frontends React ?

Deux faits tranchent le choix :

- **Les tokens sont indépendants de toute bibliothèque.** Ce sont des variables CSS (`--accent`, `--bg-1`, `--radius-md`, etc.) : n'importe quelle couche de composants peut les consommer.
- **Les composants Claude Design sont faits main.** Ils s'appuient sur des classes maison (`sp-btn`, `components.css`) et n'utilisent ni primitives d'accessibilité (Radix), ni gestion de variantes standard. Les copier livrerait des composants sur mesure à maintenir et à durcir soi-même (accessibilité, clavier, focus).

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Tailwind + shadcn/ui, tokens du design system** | Composants sur Radix (accessibilité, clavier, focus fournis) ; on possède le code (copié dans le repo) ; thème piloté par variables CSS, donc la palette Bistro premium se branche directement ; le thème par établissement reste de la donnée | Il faut recâbler chaque composant sur les tokens et reproduire le style Bistro premium |
| Synchroniser les composants Claude Design tels quels | Rien à réécrire au départ | Composants maison sans base d'accessibilité ; tout le durcissement (ARIA, clavier) à écrire ; s'éloigne de l'écosystème |
| Une bibliothèque à runtime (MUI, Mantine, Chakra) | Riche, prête à l'emploi | Dépendance lourde, parfois CSS-in-JS à runtime (à rebours du budget perf de Commande) ; on ne possède pas le code ; theming plus contraint |

## Décision

Surplasse construit sa couche de composants avec **Tailwind CSS et shadcn/ui**, alimentée par les **tokens du design system**.

- Les tokens `brand/tokens/` (couleurs, typographie, espacement, rayons) sont exposés comme variables CSS et thème Tailwind, et servent de valeurs aux variables de shadcn. La palette, les rayons quasi droits et la typographie Bistro premium s'appliquent donc aux composants shadcn.
- Le **design system Claude Design reste la référence** : les composants (`*.prompt.md`, `*.jsx`) et les UI kits (marketing, menu, dashboard) décrivent le style, les variantes et les états attendus. On les reproduit sur shadcn, on ne copie pas leur code.
- Les composants vivent dans `frontends/shared/` et sont consommés par les trois applications. Sur le front Commande (budget perf strict), on ne vendorise que les composants réellement utilisés.
- Le thème par établissement reste une surcharge de variables CSS (voir [les frontends](../architecture/frontends.md)).

## Conséquences

### Positives

- Accessibilité (Radix), ergonomie et écosystème de shadcn, avec le design Bistro premium exact.
- Code possédé et lisible dans le repo, facile à faire évoluer et à relire.
- La palette et le thème par établissement restent de la donnée (variables CSS), pas du code.

### Négatives et dettes assumées

- Chaque composant doit être recâblé sur les tokens et restylé au look Bistro premium (rayons 2 à 10px, capitales, accent orange, filets), au lieu d'un simple import.
- Le mapping entre les tokens du design system et les variables attendues par shadcn est à établir une fois, proprement, et à documenter.
- La synchronisation avec le design system Claude Design est manuelle (référence visuelle), pas automatique.
