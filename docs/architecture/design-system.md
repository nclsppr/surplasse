---
label: Design system
order: 25
icon: paintbrush
description: "L'identité visuelle de Surplasse : système de logo vectoriel, typographie, palette, thèmes et règles d'usage."
---

# Design system

Cette page fixe l'identité visuelle de Surplasse. La **source de vérité** est `brand/`, avec ses polices auto-hébergées, ses tokens, ses composants et ses assets canoniques. Le système porte deux registres complémentaires, **Service direct** pour la marque produit et **Bistro premium** pour les établissements. Cette séparation est fixée par l'[ADR-0024](../decisions/adr-0024-deux-registres-visuels.md).

!!! info Documentation de référence
La marque est définie dans `brand/` et ses premières briques sont consommées par `frontends/shared/`, Commande et le premier Dashboard. L'Onboarding React l'intégrera à sa création selon la [roadmap](../roadmap.md).
!!!

## Deux registres, une seule marque

### Service direct

Le registre de la vitrine Surplasse et des surfaces opérationnelles : **fond neutre**, **encre presque noire**, orange signature, bordures nettes et angles droits. Les titres sont en Archivo 800, en casse naturelle et avec une approche resserrée. Space Mono porte uniquement les statuts, numéros, horodatages et preuves courtes.

La composition montre des flux concrets plutôt que des formes décoratives. Le pixel art peut représenter la chaîne photo, carte structurée, QR de table et ticket cuisine. Il reste sémantique, compréhensible sans animation et limité à un mouvement discret.

### Bistro premium

Un menu typographique monochrome : **ivoire premium**, **encre espresso**, orange signature, paprika fonctionnel et brun cannelle pour la structure fine. Le vert est réservé aux états de succès. Aplats, pas de dégradés. Coins quasi droits, esprit imprimé. Le produit s'efface, la carte parle.

## Logo

Le logo associe un **repère de localisation**, une **table entourée de deux chaises** et le mot **« Surplasse »**. Cette signature traduit directement la commande à table et distingue la marque produit des noms de restaurants. La décision complète est consignée dans l'[ADR-0023](../decisions/adr-0023-systeme-logo-vectoriel-fourni.md).

| Asset canonique | Usage |
|---|---|
| `brand/surplasse-logo-horizontal.svg` | Navigation, en-têtes et identité principale |
| `brand/surplasse-app-icon.svg` | Favicon et icône d'application |
| `brand/surplasse-wordmark.svg` | Supports compacts ou imprimés qui demandent le nom seul |
| `brand/surplasse-symbol.svg` | Centre des QR codes et petit repère de marque |

Les interfaces insèrent l'asset complet adapté au contexte. Elles ne recomposent pas le mot-symbole en HTML, ne déplacent pas le symbole et ne recolorent pas les tracés. Le logo horizontal reste sur un fond clair ou très sombre afin de préserver le contraste de son orange.

## Typographie

Quatre familles, quatre rôles nettement séparés. Les polices sont **auto-hébergées** (`brand/fonts/`, `woff2`), jamais servies par un CDN tiers : performance et conformité (pas de fuite d'adresse IP, cohérent avec la posture [RGPD](../operations/rgpd.md)).

| Police | Variable | Rôle |
|---|---|---|
| **Bodoni Moda** | `--font-brand` | Référence typographique du mot-symbole vectorisé. Aucun texte courant ne reconstitue le logo |
| **Archivo** | `--font-display`, `--font-ui` | Titres et interface. En Service direct, casse naturelle et encre noire. En Bistro premium, capitales grasses et orange par défaut. Les noms de plats restent en Archivo 800 capitales |
| **Space Mono** | `--font-mono` | La méta : descriptions de carte, quantités (« (33 cl) »), prix, horodatages, labels eyebrow. Chiffres tabulaires via `.num` |
| **Parisienne** | `--font-script` (`.script`) | Noms d'établissements et accents éditoriaux. Jamais le mot-symbole Surplasse |

Dans le registre Bistro premium, les titres `h1, h2, h3` sont en capitales Archivo 800 **couleur accent**. Le **filet titré** `.rule-title` encadre un titre de deux barres orange. Dans le scope `.theme-service`, les titres passent en casse naturelle, en encre noire et avec une approche maximale de `-0.03em`. Les labels et boutons restent en capitales avec une approche modérée.

Échelle de type (`--text-*`, `--display-*`) : de `--text-xs` 12px à `--display-xl` 64px. Détail dans `brand/tokens/typography.css`.

## Palette

Palette « Bistro premium », définie par les tokens de `brand/tokens/colors.css`. L'orange Surplasse garde la vedette sur le symbole, les grands titres et les filets. Le paprika plus sombre porte les boutons et petits textes. Le brun cannelle structure les liens, labels et tags sans concurrencer le vert de succès sémantique.

| Rôle | Token | Valeur |
|---|---|---|
| Fond page (ivoire) | `--bg-1` / `--surface-page` | `#f6efe0` |
| Fond carte | `--surface-card` | `#fbf7ec` |
| Fond creusé | `--surface-sunken` | `#ebe1cc` |
| Encre (texte) | `--fg-1` / `--text-body` | `#181818` |
| Texte secondaire | `--fg-3` / `--text-muted` | `#71604e` |
| Orange signature (symbole, grands titres, filets) | `--accent` | `#FA550C` |
| Paprika fonctionnel | `--accent-press` | `#b94226` |
| Paprika profond au survol | `--accent-hover` | `#a83721` |
| Sur accent (texte ivoire) | `--on-accent` | `#FAF7F2` |
| Soutien (sable) | `--peach` | `#f3d5bd` |
| Soutien (argile claire) | `--clay` | `#c9926d` |
| Structure (brun cannelle) | `--structure` | `#7a4933` |
| Succès | `--ok` | `#256b52` |
| Ligne fine | `--line-1` | espresso 12% |

Toute paire texte/fond destinée à de la lecture doit respecter le contraste WCAG 2.2 AA ([accessibilité](../produit/fonctionnalites.md)). L'encre, le texte secondaire, le paprika et la cannelle passent AA sur ivoire. L'orange `#FA550C` est réservé au symbole, aux grands titres, aux filets et aux grandes icônes. Pour un bouton ou un petit libellé, utiliser `--accent-press`. L'argile claire reste un aplat décoratif avec l'encre du logo, jamais une couleur de texte.

### Thèmes et registres

Quatre scopes, mêmes tokens :

| Scope | Usage | Surfaces |
|---|---|---|
| défaut | Carte et menu client | Ivoire profond `#f6efe0` |
| `.theme-light` | Landing marketing, dashboard | Quasi blanc `#faf8f3`, cartes blanches |
| `.theme-service` | Vitrine Surplasse, surfaces opérationnelles | Gris papier `#f4f4f0`, encre `#11110f`, ombres franches |
| `.theme-nuit` | Menu du soir, mode cuisine plein écran | Espresso profond, orange éclairci |

Sur les mini-sites, ces variables de base sont **surchargées par le thème de l'établissement** (couleurs extraites à l'embarquement), sur le mécanisme décrit dans [les frontends](frontends.md).

## Formes, bordures, mouvement

- **Rayons quasi droits** : contrôles `--radius-sm` 2px, cartes `--radius-md` 4px, modales `--radius-lg` 10px. Badges carrés en mono capitales, pas de pills (sauf le switch).
- **Motif signature** : barres pleines accent (header, barre d'onglets de carte, barre panier/CTA en bas, footer), texte ivoire en capitales.
- **Bordures** : 1px `--line-1` pour la structure ; filets orange (`--line-accent`, 1 à 1.5px) entre items de carte ; 1.5px accent pour boutons secondaires et modales.
- **Ombres** discrètes (`--shadow-card`), esprit imprimé. Beaucoup de contenus se posent à plat, en listes à filets, sans carte.
- **Service direct** : bordures 1 à 2px, angles droits et ombres franches de 3 à 8px uniquement pour faire ressortir une action ou un objet produit.
- **Hover / press / focus** : `--accent-tint`, `--accent-hover`, `scale(0.98)` au press, double anneau `--focus-ring`. Transitions 150ms ease-out, pas de bounce.
- **Espacement** : échelle de 4px (`--sp-1` à `--sp-9`). Marketing aéré (sections 96px, conteneur 1120px) ; dashboard dense (12 à 16px).

## Icônes et imagerie

- **Icônes : Lucide**, trait 1.75px arrondi, 16/20px, `currentColor`. Pas d'emoji, pas d'unicode en guise d'icônes (sauf « € » et « · »).
- **Photos** chaudes, appétissantes, lumière naturelle. Placeholders rayés avec note monospace en attendant les vraies photos. Les visuels de plats générés (voir [ADR-0011](../decisions/adr-0011-visuels-plats.md)) suivent cette direction chaude.
- **Illustrations de flux** : pixel art ou schémas géométriques qui montrent une transformation produit réelle. Pas de bruit, de grille décorative, d'effet terminal ou d'animation continue sans sens.
- **Marques de paiement** : assets officiels Apple Pay, Google Pay et Stripe conservés sous `brand/payments/`. Les tracés et couleurs ne sont pas modifiés. La composition adapte seulement la taille, le fond et la zone de protection.

## Tokens et intégration frontend

- Base mirrorée dans `brand/` : `styles.css` importe d'abord les polices auto-hébergées de `brand/fonts/`, puis `tokens/colors.css`, `tokens/typography.css` et `tokens/spacing.css`. Cet ordre garde les déclarations `@font-face` en tête de la feuille assemblée.
- En phase 1, ces tokens et la couche composants (Button, Card, Input, Dialog, Tabs, etc.) sont synchronisés dans `frontends/shared/` depuis le design system Claude Design.
- La couche composants (Tailwind et une bibliothèque à acter par ADR) est décrite dans [les conventions React](../developpement/conventions-react.md).

## QR codes

Deux règles de marque non négociables pour les QR codes de Surplasse :

- **bords arrondis** (modules arrondis) ;
- **logo Surplasse au centre**.

Le verrouillage horizontal étant large, le centre du QR porte exactement `brand/surplasse-symbol.svg` sur un fond ivoire protégé. Le nom de l'établissement et l'URL se placent sous le QR sur les supports comme les stickers et sous-verres. Chaque QR encode `{APP_SCHEME}://{slug}.{APP_BASE_DOMAIN}/?table={jeton}`. Le profil de production donne `.com`, celui de développement `.test`.

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

`deactivate` quitte l'environnement et `rm -rf .venv-brand` le supprime si aucune autre tâche ne l'utilise. Le script lit `config/domains/development.env` et `config/domains/production.env`, puis produit les QR `.test` et `.com` (modules arrondis encre sur ivoire, correction d'erreur haute pour tolérer la marque centrale) dans `brand/qr/`. Le fichier `qr-demo-development.png` sert en local et `qr-demo.png` reste l'exemple de production. Un exemple de sticker de table est dans `brand/qr/sticker.html`.

Les SVG `brand/surplasse-logo-horizontal.svg`, `brand/surplasse-app-icon.svg`, `brand/surplasse-wordmark.svg` et `brand/surplasse-symbol.svg` sont les **sources** ; les QR et supports en sont dérivés. Un hook `PostToolUse` (`scripts/check_brand_assets.py`, branché dans `.claude/settings.json`) rappelle de régénérer ces assets dès que l'une de ces sources change, pour qu'ils ne se désynchronisent jamais du logo.
