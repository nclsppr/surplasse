---
name: Surplasse Design System 2
description: Une grammaire Untitled UI adaptée au service direct, calme dans l'usage et immersive dans la présentation.
version: 0.1.0-experimental
updated: 2026-07-23
---

# Design System: Surplasse Design System 2

## Overview

**Creative North Star: "Le passe ouvert"**

Le passe d'un restaurant est le point où la cuisine, la salle et le client partagent enfin la même vérité. Le système reprend cette logique : des surfaces franches, un ordre de lecture immédiat et une photographie qui évoque le contexte matériel du service autour de l'interface. Il refuse autant le faux terminal que la page SaaS blanche composée de cartes interchangeables.

Untitled UI React fournit la grammaire accessible, les primitives React Aria et la discipline des états. Surplasse remplace son apparence générique par un monde propre : lumière froide de début de service, graphite mat, acier doux, céramique blanche et orange signature. Les interfaces métier restent calmes et denses. Les surfaces de persuasion peuvent ouvrir ce même monde à l'échelle d'une photographie pleine largeur.

**Key Characteristics:**

- une hiérarchie opérationnelle familière, sans invention d'affordance ;
- une composition par rails, files et plans de travail plutôt que par grilles de cartes identiques ;
- une photographie atmosphérique réservée aux zones où elle donne un contexte, jamais derrière des données critiques ;
- une géométrie courbe et précise, nettement distincte des angles droits du système original ;
- une seule voix de marque, l'orange Surplasse, utilisée avec intention.

## Colors

La stratégie est restreinte dans les outils et engagée dans les surfaces de persuasion. Le graphite et des neutres légèrement froids portent la lecture. L'orange `#FA550C` reste la seule couleur de marque et s'emploie avec une encre sombre lorsqu'un petit texte doit apparaître sur son aplat.

Les états fonctionnels disposent de rôles séparés pour le succès, l'avertissement, le danger et l'information. Une couleur d'état ne remplace jamais son libellé ou son icône.

**The Open Flame Rule.** L'orange marque une action primaire, une sélection ou un moment de récit. Il ne colore pas chaque titre, icône et bordure d'un même écran.

**The Working Surface Rule.** Les zones de données utilisent des surfaces unies et contrastées. Une photographie ne passe jamais sous une commande, un prix, un statut ou un texte long.

## Typography

Archivo reste la famille principale, auto-hébergée et utilisée dans toutes les interfaces. Sa largeur et sa variation de poids permettent une hiérarchie nette sans ajouter une seconde voix aux outils métier. Les chiffres utilisent les formes tabulaires lorsque leur alignement porte du sens.

Bodoni Moda reste un accent éditorial ou d'établissement dans les surfaces de persuasion et les mini-sites. Elle n'apparaît jamais dans les libellés, les boutons, les tableaux ou les données opérationnelles. Parisienne n'est pas chargée tant qu'aucune composition approuvée ne l'utilise.

Les outils emploient une échelle fixe et compacte. Les pages de persuasion peuvent employer une échelle fluide, avec un maximum de 6rem, une approche jamais inférieure à `-0.04em` et des titres équilibrés. Le corps de texte reste entre 65 et 75 caractères par ligne.

**The One Working Voice Rule.** Une tâche complète se lit en Archivo. Les familles éditoriales introduisent un établissement ou un moment de marque, puis se retirent avant l'action.

## Layout

Le système repose sur une grille de 4px et une échelle d'espacement courte. Les groupes liés restent serrés, les changements de tâche bénéficient de respirations plus grandes. Les outils utilisent un rail de navigation, une barre de contexte et une zone de travail continue. Les séparations viennent d'un changement de plan, d'une ligne discrète ou du rythme, pas d'une carte ajoutée autour de chaque groupe.

Sur téléphone, le rail devient une navigation compacte et les files se transforment en piles conservant le même ordre métier. Sur tablette, les contrôles tactiles gardent au moins 44 x 44px. Sur grand écran, les colonnes sont ajoutées seulement quand elles réduisent réellement les déplacements du regard.

Les photos et fonds générés occupent un plan entier : une moitié d'écran de connexion, un bandeau de lieu ou un premier viewport de vitrine. Ils ne deviennent pas de petits rectangles décoratifs répétés.

## Elevation & Depth

La profondeur combine des plans tonals et deux niveaux d'ombre douce. Les surfaces de travail restent plates. Une ombre apparaît pour un menu, un dialogue, une feuille mobile ou un élément activement déplacé. Une surface ne cumule pas une bordure visible et une large ombre diffuse.

**The Lift Only When Needed Rule.** Le repos est tonal. L'élévation indique qu'un objet passe devant un autre ou attend une interaction.

## Shapes

La nouvelle famille emploie des rayons modérés et hiérarchisés. Les contrôles compacts sont légèrement courbes, les surfaces et feuilles davantage, les badges seuls peuvent devenir des capsules. Aucun rayon maximal n'est appliqué par réflexe.

Les lignes ont une épaisseur régulière. Les icônes gardent un dessin simple, neutre et cohérent. Les quatre SVG canoniques restent intacts et ne sont jamais adaptés à la nouvelle géométrie.

## Do's and Don'ts

### Do:

- **Do** utiliser les primitives React Aria d'Untitled UI pour les comportements clavier, focus et lecteur d'écran.
- **Do** donner à chaque composant les états repos, survol, focus, actif, désactivé, chargement et erreur qui s'appliquent.
- **Do** réserver l'imagerie générée à un rôle éditorial ou atmosphérique clairement séparé des données métier.
- **Do** maintenir une parité fonctionnelle et textuelle mesurable avec le frontend original correspondant.
- **Do** conserver le thème d'établissement comme donnée dans Commande2.

### Don't:

- **Don't** copier la palette violette, les exemples PRO ou la composition d'un Dashboard Untitled UI prêt à l'emploi.
- **Don't** recréer le logo, déplacer son symbole ou recolorer ses tracés.
- **Don't** construire une page entière avec des cartes de même taille et de même poids.
- **Don't** employer une photographie générique comme image d'un plat ou comme preuve d'un établissement réel.
- **Don't** masquer une limite fonctionnelle, un état de paiement ou une perte de connexion derrière un traitement visuel.

## Implementation Baseline

La source vit dans `frontends/design-system2/`. Les applications consomment le package TypeScript par une dépendance locale `file:`. Le package public Untitled UI React est référencé au commit `eaee6a5b9798fa6867b4d896c6cfecf6ce706a73`. Les comportements interactifs utilisent React Aria Components 1.19.0. Les composants sont adaptés pour Surplasse, pas copiés comme un thème fini.

La chaîne de tokens implémentée dans `src/styles.css` est la suivante :

| Niveau | Préfixes réels | Exemples |
|---|---|---|
| Primitif | `--ui2-gray-*`, `--ui2-orange-*`, `--ui2-green-*` | `--ui2-gray-950`, `--ui2-orange-500` |
| Sémantique | `--ui2-bg-*`, `--ui2-fg-*`, `--ui2-border-*`, `--ui2-action-*` | `--ui2-bg-canvas`, `--ui2-fg-secondary`, `--ui2-action-primary` |
| Composant | `--ui2-button-*`, `--ui2-field-*` | `--ui2-button-primary-bg`, `--ui2-field-border-invalid` |

Les alias sans préfixe UI2 existent seulement pour préserver la parité de la première tranche avec le JSX fonctionnel copié. Aucun nouveau composant ne doit étendre cette couche de compatibilité.

### Components Shipped

- `Button` : primitive React Aria avec couleurs primaire, secondaire, tertiaire et danger, trois densités, icônes et chargement.
- `Badge` : libellé compact avec tons neutre, marque, succès, avertissement, danger et information.
- `Brand` : insertion des SVG canoniques horizontal ou icône, sans recomposition.
- `Field` : champ React Aria avec label persistant, description et erreur reliées.
- `Status` : état textuel avec point redondant, réservé aux connexions et états de service.

### Contrats factuels des composants

| Composant | Props et contenu | Variantes et états | Clavier et technologies d'assistance | Responsive et contenu long | Tokens principaux | Tests directs |
|---|---|---|---|---|---|---|
| `Button` | `children`, `color`, `size`, `iconLeading`, `iconTrailing`, `isLoading`, plus les props de `Button` React Aria | `primary`, `secondary`, `tertiary`, `danger` ; `sm`, `md`, `lg` ; repos, survol, pression, focus, désactivé et chargement | React Aria porte le focus et l'activation clavier ; le chargement désactive l'action sans changer son nom accessible | Libellé sur une ligne, sans troncature intégrée ; minimum global de 44 px sauf `sm` à 36 px, relevé à 44 px par Commande2 | `--ui2-button-*`, `--ui2-action-*`, `--ui2-border-*`, `--ui2-radius-control`, `--ui2-shadow-sm`, tokens de focus | Deux cas dans `components.test.tsx` : activation et chargement bloquant |
| `Badge` | `children`, `tone`, `dot`, `icon`, plus les attributs d'un `span` | `neutral`, `brand`, `success`, `warning`, `danger`, `info` ; aucun état interactif | Non interactif ; le point est masqué aux technologies d'assistance, le contenu textuel porte le libellé et l'appelant masque toute icône seulement décorative | Une ligne sans troncature ; le consommateur doit fournir un libellé court | rôles `--ui2-fg-*`, `--ui2-bg-*` et tokens d'état | Un cas dans `components.test.tsx` vérifie le ton, le libellé et le point décoratif |
| `Brand` | `compact`, `tagline`, plus les attributs d'un `div` | logo horizontal ou icône canonique ; slogan facultatif | Non interactif ; l'image expose le nom « Surplasse » | hauteur 32 px, icône 38 px en mode compact, slogan limité à 12 rem sans troncature | `--ui2-fg-secondary`, `--ui2-font-ui` | Un cas dans `components.test.tsx` vérifie le nom accessible et le retrait du slogan en mode compact |
| `Field` | `label`, `placeholder`, `description`, `errorMessage`, plus les props de `TextField` React Aria | normal, focus, requis, désactivé et invalide | `TextField`, `Label`, `Input` et `Text` de React Aria relient le label, l'aide et l'erreur au champ natif | largeur disponible complète, contrôle de 46 px minimum, aide et erreur capables de revenir à la ligne | `--ui2-field-*`, `--ui2-fg-*`, `--ui2-danger`, `--ui2-radius-control`, tokens de focus | Deux cas dans `components.test.tsx` : label avec description et erreur reliée |
| `Status` | `children`, `state`, plus les attributs d'un `span` ; helper `initials` séparé | `connected`, `connecting`, `disconnected` | `role="status"` annonce le libellé ; le point est masqué aux technologies d'assistance | Une ligne sans troncature ; réservé à un libellé de connexion court | tokens de succès, avertissement et danger, ainsi que leurs fonds sémantiques | Un cas dans `components.test.tsx`, partagé avec le helper `initials` |

Chaque dérivé visuel possède son propre sous-chemin, par exemple `assets/service-pass-960` ou `assets/table-setting-640`, afin qu'une application ne livre pas un fichier qu'elle n'utilise pas. Les masters, dérivés WebP, dimensions, prompts résumés et rôles décoratifs sont enregistrés dans `src/assets/generated/provenance.json`.

### Application Grammar

- Onboarding2 combine une composition éditoriale asymétrique, un aperçu interactif honnête et un passage explicite vers le tunnel original lorsque la parité n'est pas encore livrée.
- Commande2 garde une liste continue mobile, des cibles de 44px, le restaurant au premier plan et le panier dans un espace de stockage `surplasse.ui2.*`.
- Dashboard2 combine un rail sombre, un bandeau de contexte et quatre files opérationnelles denses. La photographie reste hors des commandes et des contrôles.
