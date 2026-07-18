---
label: "ADR-0001 : monorepo"
order: 10
icon: law
description: Un dépôt git unique héberge la documentation, le contrat OpenAPI, le backend Quarkus, les trois frontends React et l'infrastructure.
---

# ADR-0001 : un monorepo unique

## Statut

Accepté, 2026-07-18.

## Contexte

Surplasse se compose de plusieurs artefacts logiciels distincts : la documentation (ce site), le contrat OpenAPI (`api/openapi.yaml`), le Backend Quarkus, trois frontends React (Onboarding, Commande, Dashboard) plus un package partagé, et la configuration d'infrastructure (Docker Compose, workflows GitHub Actions). La question se pose avant d'écrire la première ligne de code applicatif : ces artefacts vivent-ils dans un seul dépôt git ou dans plusieurs ?

La contrainte dominante est humaine : le projet est développé par une seule personne. Il n'y a pas d'équipes aux rythmes différents à isoler, pas de droits d'accès à cloisonner, pas de conflit de propriété entre dépôts à arbitrer. Les arguments classiques en faveur du multi-repo (autonomie des équipes, cycles de release indépendants, périmètres de sécurité) ne s'appliquent tout simplement pas.

La contrainte technique dominante est la cohérence autour du contrat. Le contrat OpenAPI est la source de vérité de l'API (voir [ADR-0002](adr-0002-contract-first.md)) : le Backend en implémente les interfaces générées, les frontends en consomment les clients TypeScript générés. Chaque évolution de l'API touche donc mécaniquement au moins trois artefacts. Si ces artefacts vivent dans des dépôts séparés, chaque évolution devient une chorégraphie de versions : publier le contrat, attendre la propagation, ouvrir un changement par dépôt, gérer la fenêtre où les dépôts sont désynchronisés.

Enfin, le déploiement cible est un VPS unique piloté par Docker Compose, avec une CI GitHub Actions. Il n'y a pas d'exigence d'échelle qui imposerait des pipelines totalement indépendants.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Monorepo unique** | Contrat et implémentations modifiés dans un même commit ; refactorings transverses atomiques ; un seul clone, un seul historique, une seule CI à configurer ; recherche globale triviale | Le dépôt grossit avec le temps ; la CI doit filtrer par chemins pour ne pas tout rebuilder à chaque push ; outillage hétérogène (Maven et Node) dans un même arbre |
| **Multi-repo par application** | Périmètres nets par artefact ; CI simple par dépôt (tout build est pertinent) ; historiques séparés et plus courts | Toute évolution d'API traverse 3 à 5 dépôts ; versionnage et publication du contrat comme paquet à outiller ; états intermédiaires incohérents entre dépôts ; charge de coordination absurde pour une personne seule |
| **Repo docs séparé** | Documentation déployable sans toucher au code ; historique docs isolé | La doc décrit le contrat et le code sans vivre à côté d'eux : dérive garantie ; deux dépôts à maintenir synchrones pour un bénéfice nul, GitHub Pages se déclenche aussi bien par filtre de chemins |

## Décision

Nous retenons le **monorepo unique**. Le dépôt `surplasse` héberge `docs/`, `api/`, `backend/`, `frontends/`, `infra/` et `.github/workflows/`, selon l'arborescence cible définie dans `docs/AGENTS.md`.

L'argument décisif est l'atomicité autour du contrat. Une évolution d'API se fait dans un seul commit : le contrat, l'implémentation Java, les clients TypeScript régénérés et, si besoin, la page de doc concernée avancent ensemble. Il n'existe jamais d'état publié où le contrat dit une chose et une implémentation une autre. Pour un flux de travail en [branche unique avec commits fréquents](../developpement/workflow-git.md), c'est la seule organisation qui ne fabrique pas d'états intermédiaires incohérents.

Le deuxième argument est le coût de coordination. Un développeur seul qui alterne dans la même journée entre le Backend, un frontend et la doc paie chaque frontière de dépôt en pur frottement : changements liés éclatés, versions de contrat à publier et consommer, contexte à recharger. Le monorepo ramène ce coût à zéro.

Le troisième argument est le refactoring transverse. Renommer un concept métier (par exemple aligner le code sur la terminologie canonique : établissement, revendication) se fait en une passe outillée sur tout l'arbre, vérifiable dans un seul diff.

La CI reste maîtrisable par filtres de chemins : GitHub Actions déclenche le workflow docs sur `docs/**`, le build backend sur `backend/**` et `api/**`, les builds frontends sur `frontends/**` et `api/**`. Le monorepo n'implique pas de tout rebuilder à chaque push.

## Conséquences

### Positives

- Le contrat, le Backend, les frontends et la doc évoluent dans des commits atomiques : aucune fenêtre d'incohérence entre artefacts.
- Un seul `git clone` donne l'intégralité du projet ; l'environnement de développement se documente et se reproduit une seule fois.
- Les refactorings transverses (terminologie, types partagés, montées de version) tiennent dans un diff unique et relisible.
- L'historique unique raconte le projet entier, ce qui sert la même fonction de mémoire que les ADR.
- La configuration CI/CD vit au même endroit que ce qu'elle construit ; un changement d'infra et le code qui le motive voyagent ensemble.

### Négatives et dettes assumées

- Le dépôt mélange deux écosystèmes d'outillage (Maven pour `backend/`, Node pour `frontends/` et `docs/`) : les fichiers de configuration racine doivent rester disciplinés pour ne pas devenir un fourre-tout.
- Les workflows GitHub Actions doivent utiliser des filtres `paths` soignés ; un filtre oublié ou trop large gaspille des minutes de CI, un filtre trop étroit laisse passer des régressions. Cet outillage plus fin est une charge assumée.
- Le clone grossira avec le temps (notamment si des binaires ou captures rejoignent la doc) ; le point de vigilance est accepté, avec `git lfs` en solution de repli si nécessaire.
- Si le projet accueillait un jour des contributeurs aux droits différenciés, le monorepo ne permettrait pas de cloisonner l'accès par artefact. Ce scénario est jugé lointain et le coût d'une migration éventuelle est assumé.

Cette décision conditionne [ADR-0002 : contract-first](adr-0002-contract-first.md), qui suppose que le contrat et ses consommateurs partagent le même dépôt, ainsi que l'organisation de la CI décrite dans les pages de [développement](../developpement/index.md).
