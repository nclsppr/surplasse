---
label: Design system 2 expérimental
order: 26
icon: beaker
description: "Architecture, fondations, composants et gouvernance du design system Untitled UI utilisé par les frontends alternatifs de Surplasse."
---

# Design system 2 expérimental

Le design system 2 est la couche visuelle des variantes Onboarding2, Commande2 et Dashboard2. Il permet une comparaison réelle avec le [design system canonique](design-system.md) sans modifier les applications de production. Son isolement, sa source Untitled UI et son caractère réversible sont fixés par l'[ADR-0033](../decisions/adr-0033-frontends-alternatifs-untitled-ui.md).

!!! warning Expérience de développement
`frontends/design-system2/` et les trois applications qui le consomment sont absents des routes produit `.com`, des images de production et du VPS. Leurs builds statiques `noindex` sur GitHub Pages sont uniquement des preuves visuelles. Une promotion exige un nouvel ADR. Le mot « 2 » identifie une exploration d'interface, pas une version de l'API ni des données.
!!!

## Direction : le passe ouvert

Le passe d'un restaurant est le point où la cuisine, la salle et le client partagent la même vérité. Le système reprend cette logique : surfaces franches, ordre de lecture immédiat, outils denses et photographie contextuelle séparée des données critiques.

La direction combine une lumière froide de début de service, le graphite mat, l'acier doux, la céramique blanche et l'orange Surplasse. Elle ne copie ni la palette de démonstration d'Untitled UI, ni un tableau de bord SaaS générique. Elle évite aussi le faux terminal, les grilles décoratives et l'accumulation de cartes de même poids.

Cinq principes guident les décisions :

1. **La prochaine action se lit en premier.** Une vue opérationnelle organise les objets selon le travail à accomplir, pas selon la commodité du composant.
2. **Le repos est tonal.** Une surface se distingue d'abord par son plan et son rythme. L'ombre signale un objet qui passe devant un autre.
3. **L'orange reste une flamme ouverte.** Il marque une action primaire, une sélection ou un moment de récit. Il ne colore pas tous les titres et toutes les icônes.
4. **Une tâche, une voix.** Archivo suffit pour une tâche complète. Bodoni Moda et Parisienne introduisent la marque ou un établissement, puis se retirent avant l'action.
5. **La photographie occupe un plan.** Une image donne un contexte à une moitié d'écran, un bandeau ou un premier viewport. Elle ne devient pas une vignette décorative répétée.

## Périmètre et dépendances

Le package est une bibliothèque TypeScript source, privée au monorepo. Il ne possède ni serveur, ni stockage, ni volume. Les trois applications alternatives l'intègrent à leur build Vite.

```text
                          api/openapi.yaml
                                  |
                    frontends/shared/ non visuel
                         /        |        \
                        /         |         \
             onboarding2/   commande2/   dashboard2/
                        \         |         /
                         \        |        /
                      frontends/design-system2/
                                  |
                  brand/ SVG et polices canoniques
```

Les responsabilités restent séparées :

| Source | Responsabilité | Interdit |
|---|---|---|
| `api/openapi.yaml` | Types et opérations du Backend | Redéfinir un type d'API dans le design system |
| `frontends/shared/` | Client généré, clés Query, formats et utilitaires non visuels | Ajouter un second composant visuel pour UI2 |
| `frontends/design-system2/` | Tokens, composants, styles, assets expérimentaux et contrats visuels | Logique métier, appel réseau ou état de parcours |
| `frontends/*2/` | Composition et logique de présentation propres à chaque application | Importer le code d'une application canonique |
| `brand/` | Logo, symbole, mot-symbole, icône et polices canoniques | Recomposer ou recolorer un asset de marque |

## Fondation Untitled UI

Le point de départ est le dépôt public [Untitled UI React](https://github.com/untitleduico/react), épinglé au commit [`eaee6a5b9798fa6867b4d896c6cfecf6ce706a73`](https://github.com/untitleduico/react/tree/eaee6a5b9798fa6867b4d896c6cfecf6ce706a73). Le package adapte seulement les composants publics nécessaires et conserve leur provenance ainsi que la licence MIT. Aucun contenu PRO n'est autorisé.

La pile du système expérimental est la suivante :

| Couche | Choix | Rôle |
|---|---|---|
| Comportements | React Aria Components | Sémantique, clavier, focus, sélection et états interactifs |
| Styles | Tailwind CSS 4 et variables CSS | Génération statique des classes et résolution des tokens |
| Icônes | Lucide | Jeu cohérent, trait simple, licence et dépendance explicites |
| Composition | React 19 et TypeScript strict | API de composants typée, sans logique métier |
| Marque | Assets de `brand/` | Signature Surplasse inchangée |

Le code public sert de fondation, pas de thème fini. Les noms de composants, les variantes et les slots restent proches de la source lorsque cela facilite les mises à jour. Les couleurs, la typographie, les densités, les formes et la composition viennent de Surplasse.

## Architecture des tokens

Les tokens forment une chaîne à trois niveaux. Une valeur remonte d'un niveau seulement lorsque plusieurs rôles partagent réellement la même décision.

| Niveau | Préfixe indicatif | Exemples de rôle | Consommateur autorisé |
|---|---|---|---|
| Primitif | `--ui2-color-*`, `--ui2-space-*`, `--ui2-radius-*` | graphite 950, orange 500, espace 4, rayon 3 | Fichier de thème, ou composition éditoriale locale documentée |
| Sémantique | `--ui2-bg-*`, `--ui2-fg-*`, `--ui2-border-*`, `--ui2-action-*` | fond de page, texte secondaire, bordure forte, action primaire | Applications et composants |
| Composant | `--ui2-button-*`, `--ui2-field-*` | fond du bouton primaire, anneau du champ invalide | Composant concerné uniquement |

Un composant partagé ne consomme pas directement un token primitif de couleur. Cette règle permet de modifier une palette ou un thème d'établissement sans rechercher des valeurs visuelles dans le JSX. Une composition éditoriale spécifique à une application peut exceptionnellement employer un primitif pour définir un plan inverse ou une mise en scène fixe. Cette exception ne s'applique jamais aux états, au focus, aux composants réutilisables ni aux thèmes d'établissement.

### Couleurs

Le graphite et des neutres légèrement froids portent la lecture. L'orange canonique `#FA550C` reste la seule couleur de marque. Les couleurs de succès, d'avertissement, de danger et d'information ont chacune un rôle sémantique distinct. Une couleur d'état est toujours accompagnée d'un libellé, d'une icône ou d'une structure qui conserve le sens sans couleur.

Les zones de données utilisent un fond uni. Une photographie ne se place jamais derrière un prix, un statut, une commande ou un texte long. Les thèmes d'établissement de Commande2 peuvent surcharger des rôles éditoriaux autorisés. Ils ne modifient ni le focus, ni les erreurs, ni les états de paiement, ni le logo Surplasse.

### Typographie

Archivo est la police principale, auto-hébergée depuis `brand/fonts/`. Les outils emploient une échelle compacte et fixe. Les surfaces de persuasion peuvent utiliser une échelle fluide, avec une longueur de ligne de 65 à 75 caractères.

Bodoni Moda reste limitée aux accents éditoriaux et aux noms d'établissement. Elle n'apparaît pas dans les boutons, formulaires, tableaux, statuts ou données opérationnelles. Parisienne n'est pas chargée tant qu'aucune composition approuvée ne l'utilise. Les nombres alignés utilisent des chiffres tabulaires.

### Espacement, densité et formes

Le système repose sur une grille de 4 px. Les éléments d'un même groupe restent proches. Un changement de tâche reçoit une respiration plus grande qu'un changement de champ. Les vues métier utilisent un rail de navigation, une barre de contexte et une zone de travail continue plutôt qu'une carte autour de chaque groupe.

Les contrôles compacts sont légèrement courbes. Les panneaux, feuilles et dialogues peuvent recevoir un rayon supérieur. Une capsule est réservée aux badges et contrôles dont la forme porte un sens. Les surfaces de travail restent plates. Deux niveaux d'ombre suffisent aux menus, dialogues, feuilles mobiles et éléments déplacés.

### Mouvement

Le mouvement explique un changement d'état, une relation spatiale ou la conséquence d'une action. Une transition décorative continue est interdite. Toute animation respecte `prefers-reduced-motion` et conserve une version instantanée compréhensible.

## Contrat des composants

Un composant entre dans `design-system2` lorsqu'il est réutilisable dans au moins deux variantes ou lorsqu'il constitue une primitive du système. Les compositions propres à un parcours restent dans l'application concernée.

Chaque composant documente :

- son rôle, ses props et ses slots ;
- ses variantes nécessaires, sans variante de convenance non utilisée ;
- ses états repos, survol, focus, actif, désactivé, chargement et erreur lorsqu'ils s'appliquent ;
- son comportement au clavier et au lecteur d'écran ;
- ses règles responsive, de troncature et de contenu long ;
- les tokens sémantiques qu'il consomme ;
- ses tests de comportement et d'accessibilité.

Les composants interactifs sont construits sur la primitive React Aria correspondante. Une `div` cliquable ne remplace pas un bouton ou un lien. Les attributs `data-*` exposés par React Aria pilotent les états visuels. Le focus reste visible au clavier et ne dépend jamais du seul changement de couleur.

### Composition par application

| Variante | Registre dominant | Contraintes particulières |
|---|---|---|
| Onboarding2 | Persuasion puis tâche guidée | Premier viewport distinctif, formulaire progressif, preuve produit sans capacité inventée |
| Commande2 | Éditorial d'établissement | Mobile d'abord, cible 44 x 44 px, thème comme donnée, poids initial strict |
| Dashboard2 | Outil opérationnel dense | Clavier complet, états SSE visibles, files et inspecteur orientés prochaine action |

Un composant partagé reste neutre vis-à-vis de ces compositions. Par exemple, un panneau ne décide pas s'il appartient à une file de service ou à une étape d'embarquement. L'application porte cette sémantique.

## Accessibilité

WCAG 2.2 niveau AA est le seuil minimal. Il s'applique aux composants isolés et aux compositions réelles.

| Sujet | Exigence |
|---|---|
| Structure | Régions, titres et ordre du DOM suivent l'ordre de lecture et de focus |
| Clavier | Toutes les actions sont atteignables, déclenchables et quittables sans souris |
| Focus | Anneau visible avec contraste suffisant sur chaque surface |
| Contraste | Texte, icônes utiles, bordures de contrôle et états passent AA dans chaque thème autorisé |
| Tactile | Cibles de 44 x 44 px minimum dans Commande2 et sur les vues tablette opérationnelles |
| Formulaires | Label persistant, aide reliée, erreur reliée au champ et résumé si nécessaire |
| Temps réel | Une mise à jour SSE ne vole pas le focus et ne dépend pas d'une animation pour être comprise |
| Imagerie | Alternative utile pour l'informatif, alternative vide pour le décoratif |
| Mouvement | Réduction respectée et aucun clignotement dangereux |

Les tests automatisés détectent une partie des défauts. La revue clavier, le lecteur d'écran, le zoom à 200 %, le contenu long et les thèmes d'établissement restent des vérifications manuelles obligatoires avant toute comparaison.

## Responsive et performance

Les breakpoints suivent le besoin du contenu, pas un appareil nommé. Une file du Dashboard2 devient une pile dans le même ordre métier. Un rail devient une navigation compacte. Aucun contenu critique ne disparaît seulement parce que la largeur diminue.

Commande2 conserve le budget strict de Commande. Les composants Untitled UI sont ajoutés à la demande, jamais en lot. Les dépendances lourdes sont chargées au niveau de la route qui les utilise. Les images possèdent des dimensions explicites, un format optimisé et des variantes adaptées à leur surface. Les polices sont auto-hébergées et limitées aux graisses réellement nécessaires.

Le poids JavaScript, le plus grand élément visible, les décalages de mise en page et le temps d'interaction sont mesurés séparément pour l'original et la variante. Une amélioration visuelle ne justifie pas une dégradation non mesurée du parcours de commande.

## Imagerie générée et provenance

Les assets générés servent uniquement un rôle atmosphérique ou éditorial. Ils peuvent représenter un passe vide, une table dressée sans plat ou une matière abstraite. Ils ne prétendent jamais montrer un établissement partenaire, une assiette servie, un membre d'équipe ou une performance réelle.

Le dossier d'assets conserve un manifeste de provenance avec les champs suivants :

| Champ | Contenu |
|---|---|
| `file` | Chemin du fichier livré |
| `createdAt` | Date de création au format AAAA-MM-JJ |
| `tool` | Outil ou modèle utilisé |
| `promptSummary` | Intention et contraintes principales, sans donnée sensible |
| `source` | Fichier source éventuel, sinon `generated` |
| `dimensions` | Largeur et hauteur du master et des dérivés |
| `transforms` | Recadrage, redimensionnement et compression |
| `usage` | Surface autorisée et rôle décoratif ou informatif |

Le master reste disponible lorsqu'un dérivé optimisé est committé. Le code charge le dérivé adapté. Un fond décoratif est ignoré par les technologies d'assistance. Une image informative reçoit une alternative concise qui décrit son rôle, pas son style.

## Gouvernance

La référence fonctionnelle reste le frontend canonique correspondant. Une contribution UI2 suit cet ordre :

1. identifier le parcours, les états Backend et les contraintes de l'original ;
2. composer avec les tokens et composants existants ;
3. ajouter un composant seulement si son contrat est générique ;
4. vérifier les états, le clavier, le responsive et les performances ;
5. comparer original et variante avec les mêmes données ;
6. mettre à jour la documentation de provenance ou de composant si le contrat change.

Chaque adaptation Untitled UI enregistre son fichier amont et le commit de référence. Une synchronisation change le commit seulement après examen du diff public, de la licence, de l'API React Aria et des tests. Les composants PRO restent hors périmètre.

L'arrêt complet est documenté dans l'[ADR-0033](../decisions/adr-0033-frontends-alternatifs-untitled-ui.md). Il ne demande aucune migration de données. La procédure d'installation, de lancement et de vérification vit dans [Frontends alternatifs](../developpement/frontends-alternatifs.md).
