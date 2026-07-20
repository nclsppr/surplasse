---
label: Design system
order: 25
icon: paintbrush
description: "L'identité visuelle de Surplasse (Bistro premium) : logo, typographie, palette, thèmes et règles d'usage, d'après le design system Claude Design."
---

# Design system

Cette page fixe l'identité visuelle de Surplasse. La **source de vérité** est le design system Claude Design « Restaurant management system design » (direction **« Bistro premium »**). Ses tokens sont mirrorés dans `brand/` (avec les polices auto-hébergées) et alimenteront le package partagé `frontends/shared/` ; les composants et UI kits seront synchronisés en phase 1.

!!! info Documentation de référence
La marque est définie dans `brand/` et ses premières briques sont consommées par `frontends/shared/`, Commande et le premier Dashboard. L'Onboarding React l'intégrera à sa création selon la [roadmap](../roadmap.md).
!!!

## Direction : Bistro premium

Un menu typographique monochrome : **ivoire premium**, **encre espresso**, orange signature, paprika fonctionnel et brun cannelle pour la structure fine. Le vert est réservé aux états de succès. Aplats, pas de dégradés. Coins quasi droits, esprit imprimé. Le produit s'efface, la carte parle.

## Logo

Le logo associe un **repère de localisation**, une **table entourée de deux chaises** et le mot **« Surplasse » composé en Bodoni Moda 400**. Cette signature traduit directement la commande à table et distingue la marque produit des noms de restaurants. La décision complète est consignée dans l'[ADR-0021](../decisions/adr-0021-identite-logo-vectoriel.md).

- `brand/logo.svg` : verrouillage horizontal autonome, avec mot-symbole converti en tracés.
- `brand/mark.svg` : icône principale, carré espresso, symbole ivoire et point orange.
- `brand/mark-orange.svg` : variante orange avec point espresso.
- `brand/mark-mono.svg` : symbole sans conteneur pour les petits formats et usages monochromes.
- `.sp-brand` : composition HTML accessible utilisée dans les interfaces, avec texte réel et police auto-hébergée.

La variante sombre est la signature principale sur les fonds clairs. La variante orange est réservée aux contextes où elle reste clairement détachée du fond. Sur une surface paprika, le mot-symbole passe en ivoire avec `.sp-brand--inverse` et le carré espresso reste intact. Les proportions, les couleurs internes et l'espacement entre le symbole et le nom ne doivent pas être modifiés au cas par cas.

## Typographie

Quatre familles, quatre rôles nettement séparés. Les polices sont **auto-hébergées** (`brand/fonts/`, `woff2`), jamais servies par un CDN tiers : performance et conformité (pas de fuite d'adresse IP, cohérent avec la posture [RGPD](../operations/rgpd.md)).

| Police | Variable | Rôle |
|---|---|---|
| **Bodoni Moda** | `--font-brand` (`.sp-brand__wordmark`) | Mot-symbole « Surplasse » en 400, avec axe optique fixé à 72 pour une signature stable. Aucun texte courant |
| **Archivo** | `--font-display`, `--font-ui` | Titres en capitales grasses (800), **par défaut en orange** ; toute l'UI en 400 à 700. Les noms de plats sont aussi en Archivo 800 capitales |
| **Space Mono** | `--font-mono` | La méta : descriptions de carte, quantités (« (33 cl) »), prix, horodatages, labels eyebrow. Chiffres tabulaires via `.num` |
| **Parisienne** | `--font-script` (`.script`) | Noms d'établissements et accents éditoriaux. Jamais le mot-symbole Surplasse |

Signature : les titres `h1, h2, h3` sont en capitales Archivo 800 **couleur accent**. Le **filet titré** `.rule-title` encadre un titre de deux barres orange. Les labels et boutons sont toujours en capitales avec un tracking de 0.06 à 0.1em.

Échelle de type (`--text-*`, `--display-*`) : de `--text-xs` 12px à `--display-xl` 64px. Détail dans `brand/tokens/typography.css`.

## Palette

Palette « Bistro premium », définie par les tokens de `brand/tokens/colors.css`. L'orange historique garde la vedette sur le point du symbole, les grands titres et les filets. Le paprika plus sombre porte les boutons et petits textes. Le brun cannelle structure les liens, labels et tags sans concurrencer le vert de succès sémantique.

| Rôle | Token | Valeur |
|---|---|---|
| Fond page (ivoire) | `--bg-1` / `--surface-page` | `#f6efe0` |
| Fond carte | `--surface-card` | `#fbf7ec` |
| Fond creusé | `--surface-sunken` | `#ebe1cc` |
| Encre (texte) | `--fg-1` / `--text-body` | `#2b2118` |
| Texte secondaire | `--fg-3` / `--text-muted` | `#71604e` |
| Orange signature (point du symbole, grands titres, filets) | `--accent` | `#e8481c` |
| Paprika fonctionnel | `--accent-press` | `#b94226` |
| Paprika profond au survol | `--accent-hover` | `#a83721` |
| Sur accent (texte ivoire) | `--on-accent` | `#fff7ef` |
| Soutien (sable) | `--peach` | `#f3d5bd` |
| Soutien (argile claire) | `--clay` | `#c9926d` |
| Structure (brun cannelle) | `--structure` | `#7a4933` |
| Succès | `--ok` | `#256b52` |
| Ligne fine | `--line-1` | espresso 12% |

Toute paire texte/fond destinée à de la lecture doit respecter le contraste WCAG 2.2 AA ([accessibilité](../produit/fonctionnalites.md)). L'encre, le texte secondaire, le paprika et la cannelle passent AA sur ivoire. L'orange `#e8481c` est réservé au point du symbole, aux grands titres, aux filets et aux grandes icônes. Pour un bouton ou un petit libellé, utiliser `--accent-press`. L'argile claire reste un aplat décoratif avec de l'encre espresso, jamais une couleur de texte.

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

- Base mirrorée dans `brand/` : `styles.css` importe d'abord les polices auto-hébergées de `brand/fonts/`, puis `tokens/colors.css`, `tokens/typography.css` et `tokens/spacing.css`. Cet ordre garde les déclarations `@font-face` en tête de la feuille assemblée.
- En phase 1, ces tokens et la couche composants (Button, Card, Input, Dialog, Tabs, etc.) sont synchronisés dans `frontends/shared/` depuis le design system Claude Design.
- La couche composants (Tailwind et une bibliothèque à acter par ADR) est décrite dans [les conventions React](../developpement/conventions-react.md).

## QR codes

Deux règles de marque non négociables pour les QR codes de Surplasse :

- **bords arrondis** (modules arrondis) ;
- **logo Surplasse au centre**.

Le verrouillage horizontal étant large, le centre du QR porte une simplification compacte du **symbole table et repère** sur un fond ivoire protégé. Le nom de l'établissement et l'URL se placent sous le QR sur les supports comme les stickers et sous-verres. Chaque QR encode `{APP_SCHEME}://{slug}.{APP_BASE_DOMAIN}/?table={jeton}`. Le profil de production donne `.com`, celui de développement `.test`.

Le générateur est un outil de build et de développement, absent de la production. Son installation et son exécution sont identiques sur macOS, Linux et Ubuntu sous WSL2 :

```bash
# Create and populate an isolated Python environment
python3 -m venv .venv-brand
. .venv-brand/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r scripts/requirements.txt

# Generate and verify both public domain profiles
python3 scripts/generate_brand_assets.py
test -s brand/qr/qr-demo.png
test -s brand/qr/qr-demo-development.png
```

`deactivate` quitte l'environnement et `rm -rf .venv-brand` le supprime si aucune autre tâche ne l'utilise. Le script lit `config/domains/development.env` et `config/domains/production.env`, puis produit les QR `.test` et `.com` (modules arrondis espresso sur ivoire, correction d'erreur haute pour tolérer la marque centrale) dans `brand/qr/`. Le fichier `qr-demo-development.png` sert en local et `qr-demo.png` reste l'exemple de production. Un exemple de sticker de table est dans `brand/qr/sticker.html`.

Les SVG `brand/logo.svg`, `brand/mark.svg`, `brand/mark-orange.svg` et `brand/mark-mono.svg` sont les **sources** ; les QR et supports en sont dérivés. Un hook `PostToolUse` (`scripts/check_brand_assets.py`, branché dans `.claude/settings.json`) rappelle de régénérer ces assets dès que l'une de ces sources change, pour qu'ils ne se désynchronisent jamais du logo.
