---
label: Design system
order: 25
icon: paintbrush
description: "L'identité visuelle de Surplasse (Bistro premium) : logo, typographie, palette, thèmes et règles d'usage, d'après le design system Claude Design."
---

# Design system

Cette page fixe l'identité visuelle de Surplasse. La **source de vérité** est le design system Claude Design « Restaurant management system design » (direction **« Bistro premium »**). Ses tokens sont mirrorés dans `brand/` (avec les polices auto-hébergées) et alimenteront le package partagé `frontends/shared/` ; les composants et UI kits seront synchronisés en phase 1.

!!! info Documentation de référence
Le projet n'a pas encore de code applicatif. La marque est définie ; son intégration dans les frontends viendra avec la phase 1 de la [roadmap](../roadmap.md).
!!!

## Direction : Bistro premium

Un menu typographique monochrome : **ivoire premium**, **encre espresso**, un seul accent **orange international / terracotta**, et un **petrol** (sarcelle profond) dosé pour la structure fine. Aplats, pas de dégradés. Coins quasi droits, esprit imprimé. Le produit s'efface, la carte parle.

## Logo

Le logo de Surplasse est le mot **« Surplasse » composé en Parisienne**, en **orange accent** (`--accent`, `#e8481c`). Il n'y a pas de symbole séparé.

- Asset de référence : `brand/logo.svg` (SVG autonome, police Parisienne embarquée).
- Variantes de couleur selon le fond : accent orange sur ivoire (par défaut), encre espresso, ou ivoire (`--on-accent`) sur surface accent ou photo.
- Le même wordmark, en plus petit, sert de marque au **centre des QR codes** (voir [QR codes](#qr-codes)).

!!! warning Note de source
Le readme du design system mentionne à un endroit « Cormorant Garamond » pour le nom : c'est un résidu contradictoire. La direction retenue (tokens `typography.css`, carte de marque, et consigne de l'auteur) est **Parisienne**.
!!!

## Typographie

Trois familles, trois rôles nettement séparés. Les polices sont **auto-hébergées** (`brand/fonts/`, `woff2`), jamais servies par un CDN tiers : performance et conformité (pas de fuite d'adresse IP, cohérent avec la posture [RGPD](../operations/rgpd.md)).

| Police | Variable | Rôle |
|---|---|---|
| **Archivo** | `--font-display`, `--font-ui` | Titres en capitales grasses (800), **par défaut en orange** ; toute l'UI en 400 à 700. Les noms de plats sont aussi en Archivo 800 capitales |
| **Space Mono** | `--font-mono` | La méta : descriptions de carte, quantités (« (33 cl) »), prix, horodatages, labels eyebrow. Chiffres tabulaires via `.num` |
| **Parisienne** | `--font-script` (`.script`) | Réservée au mot « Surplasse » et aux noms d'établissements. Rien d'autre |

Signature : les titres `h1, h2, h3` sont en capitales Archivo 800 **couleur accent**. Le **filet titré** `.rule-title` encadre un titre de deux barres orange. Les labels et boutons sont toujours en capitales avec un tracking de 0.06 à 0.1em.

Échelle de type (`--text-*`, `--display-*`) : de `--text-xs` 12px à `--display-xl` 64px. Détail dans `brand/tokens/typography.css`.

## Palette

Palette « Bistro premium », définie par les tokens de `brand/tokens/colors.css`. Un seul accent : l'orange garde la vedette, le petrol ne sert que la structure fine (entêtes, liens, tags, statuts calmes), jamais un CTA ni un titre. Le petrol (teinte 204deg) a été choisi pour se distinguer nettement du vert de succès sémantique, sur analyse OKLCH.

| Rôle | Token | Valeur |
|---|---|---|
| Fond page (ivoire) | `--bg-1` / `--surface-page` | `#f6efe0` |
| Fond carte | `--surface-card` | `#fbf7ec` |
| Fond creusé | `--surface-sunken` | `#ebe1cc` |
| Encre (texte) | `--fg-1` / `--text-body` | `#2b2118` |
| Texte secondaire | `--fg-3` / `--text-muted` | `#857463` |
| Accent (actions, titres) | `--accent` | `#e8481c` |
| Accent survol / pressé | `--accent-hover` / `--accent-press` | `#cf3a12` / `#b02f0c` |
| Sur accent (texte ivoire) | `--on-accent` | `#fff7ef` |
| Soutien (sable) | `--peach` | `#f3d5bd` |
| Structure (petrol) | `--green` | `#14595f` |
| Succès | `--ok` | `#256b52` |
| Ligne fine | `--line-1` | espresso 12% |

Toute paire texte/fond destinée à de la lecture doit respecter le contraste WCAG 2.2 AA ([accessibilité](../produit/fonctionnalites.md)) : l'encre sur ivoire et l'ivoire sur accent passent AA ; l'orange et le vert sont réservés aux titres, surfaces, icônes et petits labels, pas au corps de petit texte sur ivoire.

### Thèmes

Trois scopes, mêmes tokens :

| Scope | Usage | Surfaces |
|---|---|---|
| défaut | Carte et menu client | Ivoire profond `#f6efe0` |
| `.theme-light` | Landing marketing, dashboard | Quasi blanc `#faf8f3`, cartes blanches |
| `.theme-nuit` | Menu du soir, mode cuisine plein écran | Espresso profond, orange éclairci |

Sur les mini-sites, ces variables de base sont **surchargées par le thème de l'établissement** (couleurs extraites à l'embarquement), sur le mécanisme décrit dans [les frontends](frontends.md).

## Formes, bordures, mouvement

- **Rayons quasi droits** : contrôles `--radius-sm` 2px, cartes `--radius-md` 4px, modales `--radius-lg` 10px. Badges carrés en mono capitales, pas de pills (sauf le switch).
- **Motif signature** : barres pleines accent (header, barre d'onglets de carte, barre panier/CTA en bas, footer), texte ivoire en capitales.
- **Bordures** : 1px `--line-1` pour la structure ; filets orange (`--line-accent`, 1 à 1.5px) entre items de carte ; 1.5px accent pour boutons secondaires et modales.
- **Ombres** discrètes (`--shadow-card`), esprit imprimé. Beaucoup de contenus se posent à plat, en listes à filets, sans carte.
- **Hover / press / focus** : `--accent-tint`, `--accent-hover`, `scale(0.98)` au press, double anneau `--focus-ring`. Transitions 150ms ease-out, pas de bounce.
- **Espacement** : échelle de 4px (`--sp-1` à `--sp-9`). Marketing aéré (sections 96px, conteneur 1120px) ; dashboard dense (12 à 16px).

## Icônes et imagerie

- **Icônes : Lucide**, trait 1.75px arrondi, 16/20px, `currentColor`. Pas d'emoji, pas d'unicode en guise d'icônes (sauf « € » et « · »).
- **Photos** chaudes, appétissantes, lumière naturelle. Placeholders rayés avec note monospace en attendant les vraies photos. Les visuels de plats générés (voir [ADR-0011](../decisions/adr-0011-visuels-plats.md)) suivent cette direction chaude.

## Tokens et intégration frontend

- Base mirrorée dans `brand/` : `styles.css` importe `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, eux-mêmes reliés aux polices auto-hébergées de `brand/fonts/`.
- En phase 1, ces tokens et la couche composants (Button, Card, Input, Dialog, Tabs, etc.) sont synchronisés dans `frontends/shared/` depuis le design system Claude Design.
- La couche composants (Tailwind et une bibliothèque à acter par ADR) est décrite dans [les conventions React](../developpement/conventions-react.md).

## QR codes

Deux règles de marque non négociables pour les QR codes de Surplasse :

- **bords arrondis** (modules arrondis) ;
- **logo Surplasse au centre**.

Le wordmark étant large, le centre du QR porte une marque compacte : le **« S » de Parisienne en orange** dans un rond ivoire ; le wordmark « Surplasse » et l'URL se placent sous le QR sur les supports (stickers, sous-verres). Chaque QR encode `https://{slug}.surplasse.com/?table={jeton}`.

Génération : `python3 scripts/generate_brand_assets.py` produit les QR (modules arrondis espresso sur ivoire, correction d'erreur haute pour tolérer la marque centrale) dans `brand/qr/`. Un exemple de sticker de table est dans `brand/qr/sticker.html`.

Le logo (`brand/logo.svg`) est la **source** ; les QR et supports en sont dérivés. Un hook `PostToolUse` (`scripts/check_brand_assets.py`, branché dans `.claude/settings.json`) rappelle de régénérer ces assets dès que `brand/logo.svg` change, pour qu'ils ne se désynchronisent jamais du logo.
