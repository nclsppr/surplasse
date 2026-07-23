# Provenance Untitled UI React

Ce package expérimental adapte les fondations publiques d'Untitled UI React. Il ne contient aucun composant, exemple ou asset de l'offre PRO.

- dépôt : `https://github.com/untitleduico/react`
- commit de référence : `eaee6a5b9798fa6867b4d896c6cfecf6ce706a73`
- version de schéma : `8`
- licence du dépôt public : MIT, copie dans `licenses/untitled-ui-react-MIT.txt`

Les composants ont été réécrits pour Surplasse à partir des conventions publiques d'Untitled UI, notamment React Aria Components, les états `data-*`, les propriétés de composition et la séparation entre primitives, tokens sémantiques et composants. Les icônes ne sont pas recopiées depuis Untitled UI. Les applications utilisent Lucide comme dépendance distincte.

## Inventaire des adaptations

Tous les chemins amont ci-dessous désignent le commit de référence. Aucun de ces fichiers n'est copié tel quel dans le package.

| Élément Surplasse | Fichier amont examiné | Décisions conservées | Réécriture Surplasse |
|---|---|---|---|
| `src/components/Button.tsx` | `components/base/buttons/button.tsx` | Primitive `Button` de React Aria, variantes de couleur et de taille, icônes avant ou après le libellé, chargement bloquant l'activation | API réduite aux quatre couleurs et trois tailles utilisées, tokens UI2, spinner CSS, aucune variante lien |
| `src/components/Badge.tsx` | `components/base/badges/badges.tsx` et `components/base/badges/badge-types.ts` | Élément textuel non interactif, tons sémantiques, point ou icône facultatifs | Six tons Surplasse, une seule densité, aucun bouton de fermeture ni icône Untitled UI |
| `src/components/Field.tsx` | `components/base/input/input.tsx`, `components/base/input/label.tsx` et `components/base/input/hint-text.tsx` | Composition `TextField`, `Label`, `Input` et texte relié par React Aria, états désactivé, requis et invalide | Champ texte minimal avec label persistant, description et erreur, sans tooltip, raccourci ni bascule de mot de passe |
| `src/lib/cx.ts` | `utils/cx.ts` | Fusion déterministe des classes avec `tailwind-merge` | Enveloppe locale minimale, sans extension de thème Untitled UI |
| `src/styles.css` | `styles/theme.css` | Séparation entre valeurs de fondation, rôles sémantiques et styles de composant | Palette, typographie, rayons, ombres, focus et mouvement entièrement redéfinis pour Surplasse |
| `src/components/Brand.tsx` | Aucun | Aucun composant de marque repris | Composant propre à Surplasse qui insère uniquement les SVG canoniques de `brand/` |
| `src/components/Status.tsx` | Aucun | Aucun composant repris | État de connexion propre à Surplasse, avec libellé et point redondant |

L'inventaire est revu avant tout changement de commit. Une nouvelle adaptation ajoute sa ligne avec le fichier amont réellement examiné, ou indique explicitement « Aucun » lorsqu'elle est propre à Surplasse.
