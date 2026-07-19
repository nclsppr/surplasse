---
label: "ADR-0009 : Retype pour la documentation"
order: 90
icon: law
description: Choix de Retype comme générateur du site de documentation, déployé sur GitHub Pages.
---

# ADR-0009 : Retype pour la documentation, déployée sur GitHub Pages

## Statut

**Accepté**, 2026-07-18.

## Contexte

Au moment de cette décision, le 2026-07-18, Surplasse démarrait par sa documentation avant l'introduction du code applicatif. Ces pages constituaient la référence à partir de laquelle le produit allait être construit. L'outil de documentation n'était donc pas un accessoire choisi en fin de projet ; c'était le premier composant de la chaîne de production, à mettre en place avant le reste.

### Besoins

| Besoin | Exigence |
|---|---|
| Format source | Markdown pur, committé dans le monorepo à côté du code à venir |
| Rendu | Site statique soigné sans travail de thème : sidebar, recherche, thème sombre |
| Navigation | Arborescence par dossiers avec ordre et libellés contrôlés page par page |
| Hébergement | GitHub Pages, publication automatique à chaque push sur `main` |
| Vérifiabilité | Un build local rapide qui échoue franchement en cas de lien cassé ou de page invalide |
| Coût d'entretien | Proche de zéro : une très petite équipe, pas de temps pour maintenir un outil de docs |

Le workflow git du projet (branche unique `main`, commits fréquents, pas de PR, voir [Workflow git](../developpement/workflow-git.md)) impose que la documentation se vérifie et se publie sans cérémonie : un build qui passe, un push, un site à jour.

### L'acquis Papers Empire

Un facteur pèse particulièrement : **Papers Empire**, l'autre projet de Nicolas, documente déjà avec Retype. Les conventions (front matter par page, `index.yml` par dossier, callouts, arborescence par sections) et la chaîne de publication GitHub Actions y sont éprouvées et peuvent être réutilisées telles quelles. Choisir un autre outil, c'est renoncer à cet acquis et re-payer le coût d'apprentissage, de configuration et de mise au point de la CI.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Retype** | Déjà éprouvé sur Papers Empire : conventions et CI réutilisées telles quelles. Zéro configuration pour un rendu soigné (sidebar, recherche intégrée, thème sombre). Markdown pur committé avec le code. Front matter simple et lisible. | Produit commercial semi-fermé : certaines fonctions réservées à l'offre Pro payante. Pas de rendu mermaid. Écosystème de plugins réduit. |
| **Docusaurus** | Open source, écosystème React très riche, versioning de docs, mermaid natif, composants MDX. | Projet React à maintenir (dépendances, mises à jour majeures), configuration réelle avant d'obtenir un rendu propre, personnalisation qui appelle du code. Coût d'entretien disproportionné pour le besoin. |
| **VitePress** | Open source, très rapide, aligné avec l'outillage Vite déjà retenu pour les frontends, mermaid via plugin. | Thème par défaut pensé pour des docs de bibliothèques ; structure multi-sections et navigation riche à construire soi-même. Pas d'acquis d'équipe. |
| **Wiki GitHub** | Aucune mise en place, édition en ligne immédiate. | Hors du dépôt principal (dépôt git séparé, pas de CI sur le contenu), navigation pauvre, pas de front matter ni d'ordre contrôlé, rendu non personnalisable. Inadapté à une documentation de référence structurée. |

### Analyse

**Docusaurus** est le choix le plus riche, mais cette richesse a un prix permanent : c'est un projet React de plus à maintenir, avec ses montées de version et sa configuration. Pour une documentation dont le contenu prime sur la forme, portée par une très petite équipe, chaque heure passée sur l'outil est une heure prise au produit.

**VitePress** aurait l'élégance de la cohérence avec la stack frontend (Vite), mais cette cohérence est illusoire : la documentation n'importe rien des frontends, et l'outillage partagé se limiterait à Node. Son thème par défaut, excellent pour documenter une bibliothèque, demande du travail pour porter une documentation produit multi-sections comme celle-ci.

**Le wiki GitHub** est disqualifié par le principe même du projet : la documentation est la référence du produit, elle doit vivre dans le dépôt, passer par les mêmes commits et le même build de vérification que tout le reste.

**Retype** gagne sur le seul critère qui compte à ce stade : le coût total, apprentissage compris, est quasi nul grâce à l'acquis Papers Empire, pour un rendu immédiatement professionnel.

## Décision

**La documentation de Surplasse est construite avec Retype (4.6 ou plus) et déployée sur GitHub Pages.**

Dans la cible :

- Les sources vivent dans `docs/` au sein du monorepo, en markdown pur. La configuration Retype (`retype.yml`) vit à la racine du dépôt et exclut `docs/AGENTS.md` du build.
- Chaque page porte un front matter YAML (`label`, `order`, `icon`, `description`) et chaque dossier un `index.yml`, selon les conventions fixées par `docs/AGENTS.md`, reprises de Papers Empire.
- Le build passe par `npm run docs:build` et doit réussir avant tout push touchant `docs/`, conformément au [workflow git](../developpement/workflow-git.md).
- La publication est automatique : chaque push sur `main` déclenche `.github/workflows/pages.yml`, qui construit le site et le publie sur GitHub Pages.

```
Rédaction            Vérification              Publication
    |                     |                        |
 docs/*.md  --->  npm run docs:build  --->  push sur main
                  (build local, échec         |
                   franc si problème)         v
                                     GitHub Actions (pages.yml)
                                              |
                                              v
                                        GitHub Pages
```

- Les diagrammes sont en **ASCII dans des blocs de code** : Retype ne rend pas mermaid, et cette limite est assumée comme une convention plutôt que contournée par un plugin.
- Les composants Retype sont volontairement limités (callouts avec parcimonie, un par section au maximum) : le markdown doit rester lisible brut, dans un éditeur ou sur GitHub, sans passer par le site rendu.

### Conventions reprises de Papers Empire

| Convention | Application dans Surplasse |
|---|---|
| Front matter `label`, `order`, `icon`, `description` sur chaque page | Identique, décrite dans `docs/AGENTS.md` |
| `index.yml` par dossier (`label`, `order`, `expanded`) | Identique |
| Liens internes relatifs vers les fichiers `.md` | Identique |
| Build de vérification obligatoire avant push | Identique, via `npm run docs:build` |
| Workflow GitHub Actions de publication sur Pages | Repris et adapté dans `.github/workflows/pages.yml` |
| Fichier de conventions exclu du build | `docs/AGENTS.md`, exclu via `retype.yml` |

!!! info Périmètre de la décision
Cet ADR fixe l'outil et la chaîne de publication de la documentation. Il ne fixe ni le plan du site (décrit dans `docs/AGENTS.md` et visible depuis l'[accueil](../README.md)) ni le style rédactionnel, qui relèvent des conventions du projet.
!!!

## Conséquences

### Positives

- **Démarrage immédiat** : conventions, structure et CI reprises de Papers Empire sans adaptation, la documentation a pu commencer le jour du choix.
- **Rendu professionnel sans effort** : sidebar générée depuis l'arborescence, recherche intégrée, thème sombre, sans une ligne de configuration de thème.
- **La documentation vit avec le code** : mêmes commits, même branche `main`, même vérification avant push. Une décision et sa documentation partent dans le même push.
- **Coût d'entretien quasi nul** : une dépendance npm à mettre à jour, pas de projet de site à maintenir.
- **Cohérence entre projets** : les habitudes acquises sur Papers Empire s'appliquent ici sans traduction, dans les deux sens.
- **Le markdown reste lisible partout** : dans le site rendu, sur GitHub et dans l'éditeur, grâce à la sobriété imposée sur les composants et les diagrammes.

### Négatives et dettes assumées

- **Produit commercial semi-fermé** : Retype n'est pas open source et certaines fonctions relèvent de l'offre Pro payante. Si une fonction Pro devenait indispensable, il faudrait payer la licence ou s'en passer. Dette assumée : le besoin actuel est entièrement couvert par l'offre gratuite.
- **Pas de rendu mermaid** : les diagrammes sont en ASCII, plus austères et plus coûteux à modifier qu'un diagramme généré. Convention assumée dans `docs/AGENTS.md` ; elle a l'avantage annexe de rester lisible dans le markdown brut.
- **Écosystème de plugins réduit** : tout besoin non couvert par Retype nativement (glossaire interactif, graphiques, rendu OpenAPI du contrat) restera non couvert ou traité en dehors du site de docs.
- **Dépendance à la trajectoire d'un éditeur commercial** : un arrêt du produit ou un changement de licence imposerait une migration. Réversibilité correcte mais non gratuite : les sources étant du markdown pur, migrer resterait possible au prix de la conversion du front matter et des callouts ; la sobriété imposée sur les composants Retype réduit ce coût par avance.

### Critères de remise en cause

La décision sera réexaminée par un nouvel ADR si l'un de ces signaux apparaît :

- l'arrêt du développement de Retype, ou un changement de licence qui ferait basculer le besoin actuel dans l'offre payante ;
- un besoin devenu central que Retype ne peut pas couvrir, en particulier un rendu interactif du contrat (documentation OpenAPI navigable) si les blocs de code ne suffisent plus ;
- un volume de diagrammes tel que l'ASCII devient un frein mesurable à la maintenance de la documentation.

Dans tous les cas, la première option étudiée serait celle qui préserve le markdown existant avec le moins de conversion possible.
