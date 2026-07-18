---
label: Design system
order: 25
icon: paintbrush
description: "L'identité visuelle de Surplasse : logo, système typographique (Archivo, Space Mono, Parisienne), palette et règles d'usage."
---

# Design system

Cette page fixe l'identité visuelle de Surplasse : le logo, les polices et leurs rôles, la palette et les règles d'usage. Elle est la source de référence pour les trois frontends (voir [les frontends](frontends.md)). Les assets vivent dans `brand/` à la racine du dépôt ; les tokens réutilisables par les applications vivront dans `frontends/shared/`.

!!! info Documentation de référence
Le projet n'a pas encore de code applicatif. La marque (logo, polices, palette) est posée ; son intégration dans les frontends viendra avec la phase 1 de la [roadmap](../roadmap.md). La palette est une proposition à confirmer.
!!!

## Logo

Le logo de Surplasse est le mot **« Surplasse » composé en Parisienne**, la police script de la marque. Il n'y a pas de symbole séparé : le wordmark est le logo.

- Asset de référence : `brand/logo.svg`, un SVG autonome dont la police Parisienne est embarquée (il rend identique partout, sans dépendre d'une police installée).
- Couleur par défaut : l'encre `#2B1B12` sur fond clair. Une variante claire (papier `#FAF4E9`) est utilisée sur fond sombre ou photo.
- Le logo sert aussi de marque au **centre des QR codes** (voir [les règles QR](#qr-codes)).

## Système typographique

Trois familles, trois rôles nettement séparés. Les polices sont **auto-hébergées** (fichiers `woff2` dans `brand/fonts/`), jamais servies par un CDN tiers : c'est un choix de performance et de conformité (pas de fuite d'adresse IP vers un tiers, cohérent avec la posture [RGPD](../operations/rgpd.md)).

| Police | Rôle | Usage précis |
|---|---|---|
| **Archivo** | Police principale : titres et toute l'UI | Titres en capitales grasses (poids 800 et 900) ; boutons, corps, labels en 400 à 700 |
| **Space Mono** | La méta | Descriptions de carte, quantités (« (33 cl) »), prix, horodatages, labels eyebrow en capitales espacées |
| **Parisienne** | Le geste manuscrit | Réservée au mot « Surplasse » (le logo) et aux **noms d'établissements** (« Fiorella »). Rien d'autre |

Règles d'emploi :

- **Archivo** porte la structure et l'action. Les titres forts sont en 900 capitales ; l'UI courante en 600. On ne compose jamais un paragraphe de corps en Parisienne ni en Space Mono.
- **Space Mono** signale la donnée : un prix, une contenance, une heure, une référence de commande. Sa chasse fixe aligne naturellement les chiffres.
- **Parisienne** est rare par définition. L'étendre au-delà du logo et des noms d'établissements diluerait son effet. Sur les mini-sites, c'est elle qui porte l'identité du restaurant, en écho au logo Surplasse.

### Familles et fichiers

| Famille | Poids servis | Fichiers |
|---|---|---|
| Archivo | 400 à 900 (police variable) | `brand/fonts/archivo-*.woff2` + `archivo.css` |
| Space Mono | 400, 700 | `brand/fonts/spacemono-*.woff2` + `spacemono.css` |
| Parisienne | 400 | `brand/fonts/parisienne-*.woff2` + `parisienne.css` |

Chaque famille a son fichier CSS `@font-face` déjà localisé (les `url()` pointent vers les `woff2` voisins). Le frontend consommera ces déclarations depuis `frontends/shared/`.

## Palette

Palette proposée, à confirmer. Elle vise l'univers d'une belle carte de restaurant : papier chaud, encre profonde, un rouge terracotta appétissant pour l'action.

| Rôle | Nom | Valeur | Usage |
|---|---|---|---|
| Fond | Papier | `#FAF4E9` | Fond des pages et des cartes |
| Texte | Encre | `#2B1B12` | Texte principal, logo par défaut |
| Accent | Terracotta | `#C0432B` | Boutons, actions, accents, eyebrow |
| Secondaire | Ambre | `#E0902F` | Accents secondaires, états, badges |
| Méta | Méta | `#6E5F51` | Texte Space Mono secondaire, séparateurs |

Les paires de couleurs destinées au texte doivent respecter le contraste WCAG 2.2 AA (voir l'exigence d'[accessibilité](../produit/fonctionnalites.md)). L'encre sur papier et le papier sur terracotta passent AA ; le terracotta et l'ambre sont réservés aux grands titres, aux surfaces et aux icônes, pas au corps de petit texte sur papier.

## Tokens et intégration frontend

L'intégration concrète suivra la mise en place du package partagé `frontends/shared/` :

- les couleurs deviennent des variables CSS (`--color-paper`, `--color-ink`, `--color-terracotta`, `--color-amber`, `--color-meta`) et des tokens Tailwind ;
- les familles sont exposées comme variables de police (`--font-ui` pour Archivo, `--font-meta` pour Space Mono, `--font-script` pour Parisienne) ;
- sur les mini-sites, la palette de base est **surchargée par le thème de l'établissement** (couleurs extraites à l'embarquement), sur le mécanisme de variables CSS décrit dans [les frontends](frontends.md).

La couche de composants (Tailwind, et une bibliothèque de composants à acter par ADR) est décrite dans [les conventions React](../developpement/conventions-react.md).

## QR codes

Les QR codes de Surplasse suivent deux règles de marque non négociables :

- **bords arrondis** ;
- **logo Surplasse au centre**.

Le logo (`brand/logo.svg`) est la source ; les QR d'exemple et supports (stickers, sous-verres) sont des assets dérivés. Si le logo change, ces dérivés doivent être **régénérés** : un script de génération et un hook dédié garantissent qu'ils ne se désynchronisent pas du logo.
