---
label: Workflow git
order: 20
icon: git-commit
description: Branche unique main, commits fréquents et vérifiés, format des messages, discipline avant push et gestion des retours en arrière.
---

# Workflow git

Le dépôt Surplasse est un monorepo (voir l'[arborescence cible](../architecture/index.md)) géré avec un workflow volontairement minimal : une seule branche, pas de pull request, des commits petits, fréquents et vérifiés. Cette page décrit le modèle, le format des messages, ce qui ne se committe jamais, la discipline avant chaque push et la conduite à tenir quand un commit doit être annulé.

## Le modèle : une branche, pas de PR

Tout le travail se fait sur `main`. Il n'existe ni branche de fonctionnalité, ni branche de développement, ni pull request. On committe directement sur `main` et on pousse aussitôt, le plus souvent possible.

### L'unité committable

La règle centrale : **une unité de travail vérifiée = un commit poussé**. Une unité committable est un changement cohérent qui laisse le dépôt dans un état sain après application :

| Type de changement | État sain signifie |
|---|---|
| Documentation | `npm run docs:build` passe sans erreur |
| Backend | les tests du module touché passent (`./mvnw test`) |
| Frontend | typecheck et tests du package touché passent |
| Le contrat (`api/openapi.yaml`) | le contrat est valide et les artefacts générés restent cohérents |
| Infra, CI | la configuration est syntaxiquement valide et cohérente avec les workflows existants |

Un commit peut être petit (une phrase corrigée dans une page) ou plus large (une page entière, un endpoint complet avec ses tests). Ce qui compte n'est pas la taille mais l'invariant : après chaque commit, quelqu'un qui clone le dépôt obtient un état qui builde.

À l'inverse, un travail en cours qui casse le build ne se committe pas « pour sauvegarder ». On termine l'unité, ou on la découpe en étapes dont chacune laisse le dépôt sain.

### Pourquoi ce choix

Ce modèle est adapté au contexte du projet et assumé comme tel :

- **Développement solo.** Une PR est un outil de coordination entre plusieurs personnes. Sans relecteur humain, elle n'apporte que de la friction : création de branche, ouverture, merge, suppression, pour un contenu que personne d'autre ne relit.
- **Vélocité.** Committer et pousser souvent réduit la taille de chaque changement, rend l'historique lisible et limite le risque de perdre du travail. Un push par unité de travail vaut mieux qu'un push massif en fin de journée.
- **La revue passe par les outils, pas par les PR.** La qualité est garantie par la chaîne de vérification : build docs, tests, typecheck strict, validation du contrat, et la CI décrite dans [CI/CD](ci-cd.md) qui rejoue tout à chaque push. Une revue par agent (analyse du diff avant commit) peut compléter, mais elle intervient avant le commit, pas dans une interface de PR.

!!! info Et si l'équipe grandit ?
Ce modèle est une décision réversible. Si un deuxième contributeur régulier rejoint le projet, le passage à des branches courtes avec PR se décide via un ADR dans [decisions](../decisions/index.md). Rien dans l'outillage actuel ne l'empêche.
!!!

### Les garde-fous

L'absence de PR ne signifie pas l'absence de filet :

1. **La CI tourne sur chaque push** et signale immédiatement un état cassé sur `main`. Un push rouge se corrige en priorité, avant toute autre tâche.
2. **La vérification locale avant push** est obligatoire (voir [la discipline avant push](#la-discipline-avant-push)).
3. **L'historique reste intact** : jamais de réécriture sur `main`, donc tout état antérieur est récupérable (voir [les retours en arrière](#les-retours-en-arrière)).
4. **Le contrat fait autorité** : un changement d'API passe d'abord par `api/openapi.yaml`, ce qui rend les ruptures visibles à la génération des clients (voir [le contrat](../architecture/api.md)).

## Format des messages de commit

Les messages de commit sont en français, à l'impératif, et commencent par un préfixe de périmètre suivi de deux-points. Le sujet tient sur une ligne, sans point final, et décrit le changement, pas l'intention vague (« corrige le calcul du total », pas « fixes »).

### Les préfixes

| Préfixe | Périmètre | Exemple |
|---|---|---|
| `docs:` | Documentation Retype (`docs/`) | `docs: ajoute la page workflow git` |
| `api:` | Le contrat (`api/openapi.yaml`) | `api: ajoute l'endpoint de revendication d'un espace` |
| `backend:` | Backend Quarkus (`backend/`) | `backend: implémente la transition de statut d'une commande` |
| `front(commande):` | Application Commande | `front(commande): affiche les options d'un produit dans le panier` |
| `front(dashboard):` | Application Dashboard | `front(dashboard): branche le flux SSE des commandes entrantes` |
| `front(onboarding):` | Application Onboarding | `front(onboarding): ajoute l'étape photo de la carte à l'embarquement` |
| `shared:` | Package partagé (`frontends/shared/`) | `shared: extrait le composant de badge de statut` |
| `infra:` | Docker Compose, configuration VPS (`infra/`) | `infra: ajoute le service PostgreSQL au compose de dev` |
| `ci:` | Workflows GitHub Actions | `ci: vérifie la fraîcheur du client API généré` |

Un commit qui traverse plusieurs périmètres prend le préfixe du périmètre principal. Si aucun ne domine, c'est le signe que le commit devrait être découpé.

### Le corps du message

Le corps est optionnel. Il devient nécessaire quand le pourquoi du changement n'est pas évident à la lecture du diff : un contournement, un choix entre deux approches, une contrainte externe. Une ligne vide sépare le sujet du corps.

```
backend: sérialise les montants en centimes dans les événements SSE

Le client TypeScript généré typait les montants en number flottant,
ce qui produisait des erreurs d'arrondi côté Dashboard. Les montants
transitent désormais en centimes (entiers), la conversion en euros
est faite à l'affichage.
```

Le corps explique le pourquoi. Le comment est dans le diff, inutile de le paraphraser.

## Ce qui ne se committe jamais

| Catégorie | Exemples | Pourquoi |
|---|---|---|
| Secrets | clés Stripe, clé API OpenAI, tokens, mots de passe | Un secret poussé est un secret compromis, même supprimé ensuite |
| Fichiers d'environnement | `.env`, `.env.local` | Contiennent des secrets ou des valeurs propres à une machine |
| Dépendances | `node_modules/`, artefacts Maven dans `target/` | Reconstructibles depuis `package-lock.json` et `pom.xml` |
| Sortie de build docs | `docs-site/` | Régénérée par `npm run docs:build`, déployée par la CI |
| Fichiers générés | clients API générés, artefacts de build, caches | Reconstructibles depuis leur source |
| Fichiers locaux d'IDE ou d'OS | `.idea/`, `.DS_Store` | Propres à une machine |

Tout ce tableau est couvert par le `.gitignore` racine. Un fichier qui devrait y figurer et n'y figure pas se corrige par un commit `infra:` ou `docs:` selon le cas.

### Le cas du client API généré

Le client TypeScript généré depuis le contrat est le seul fichier généré pour lequel la question se pose : le committer simplifierait le setup (pas de génération à cloner), mais créerait une source de dérive entre le contrat et le client committé.

Décision de référence : **le client généré n'est pas committé**. Il est régénéré localement par le script de génération et régénéré en CI, qui vérifie sa fraîcheur : si la génération depuis `api/openapi.yaml` produit un résultat différent de ce que le build utilise, la CI échoue. Le contrat reste ainsi l'unique source de vérité, sans risque de client obsolète poussé par oubli.

!!! warning À confirmer par ADR
Ce choix (client non committé, vérification de fraîcheur en CI) est la recommandation de référence, mais il touche l'outillage de tous les frontends. Il sera confirmé ou amendé par un ADR dans [decisions](../decisions/index.md) au moment de la mise en place effective de la génération.
!!!

## La discipline avant push

Puisque `main` est la seule branche et qu'elle déploie (la doc aujourd'hui, les applications demain), chaque push est précédé d'une vérification locale proportionnée au périmètre touché :

| Périmètre touché | Vérification obligatoire avant push |
|---|---|
| `docs/` | `npm run docs:build` passe sans erreur ni warning bloquant |
| `api/openapi.yaml` | validation du contrat, régénération des clients, build des consommateurs |
| `backend/` | tests du module touché (`./mvnw test` sur le module, ou complet si doute) |
| `frontends/*` | typecheck et tests du package touché |
| `infra/`, `.github/workflows/` | validation syntaxique, relecture du diff |

La règle d'or : on ne vérifie pas tout à chaque fois, on vérifie ce que le commit touche. La CI, elle, rejoue l'ensemble et sert de filet pour les interactions entre périmètres qu'une vérification locale ciblée aurait manquées.

Un push qui casse la CI n'est pas un drame, c'est un signal : la correction (ou le revert) devient la tâche prioritaire, avant tout nouveau développement.

## Les retours en arrière

Le principe : **l'historique de `main` est immuable**. On avance, on ne réécrit pas.

- **Annuler un commit poussé : `git revert`.** Le revert crée un nouveau commit qui inverse le changement, en gardant la trace de l'aller et du retour. Le message suit le format habituel, par exemple `backend: revert de la sérialisation en centimes` avec un corps expliquant la raison.
- **Jamais de force push sur `main`.** Ni `git push --force`, ni `--force-with-lease`, ni `git rebase` sur des commits déjà poussés. Un historique réécrit casse les clones, les liens vers les commits et la confiance dans le déploiement continu.
- **Avant le push, tout est permis.** Un commit local non poussé peut être amendé (`git commit --amend`), fusionné ou réordonné librement. La frontière est le push : ce qui est poussé est figé.

!!! info Cas extrême : un secret poussé
Si un secret atteint `main` malgré tout, la réécriture d'historique ne le sauve pas : le secret est compromis dès le push. La réponse est la révocation immédiate du secret (rotation de la clé chez Stripe, OpenAI ou autre), puis un commit qui le retire du dépôt. Voir [sécurité](../architecture/securite.md).
!!!

## Tags de version par application

Tant que rien n'est déployé en production, `main` avance sans tags. Quand les déploiements commenceront, chaque application sera versionnée et déployée indépendamment, avec des tags par application :

```
<application>-v<majeur>.<mineur>.<correctif>

backend-v1.0.0
commande-v1.2.0
dashboard-v1.1.3
onboarding-v0.9.0
docs-v1.0.0          (optionnel, si l'on souhaite jalonner la doc)
```

Règles de nommage :

| Élément | Convention |
|---|---|
| Préfixe | Le nom du répertoire de l'application (`backend`, `commande`, `dashboard`, `onboarding`) |
| Version | SemVer : `majeur` pour une rupture, `mineur` pour une fonctionnalité, `correctif` pour un fix |
| Portée | Un tag pointe un commit de `main` ; le déploiement de l'application part de ce tag |

Le contrat suit la version du backend qui l'implémente : pas de tag propre pour `api/openapi.yaml`. Le détail du déclenchement des déploiements depuis les tags est décrit dans [CI/CD](ci-cd.md) ; les environnements cibles dans [environnements](../operations/environnements.md).

## Hooks locaux

Des hooks git locaux légers peuvent compléter la discipline, sans la remplacer ni devenir une usine à gaz. Deux vérifications rapides suffisent en pré-commit :

1. **Détection de secrets** : un scan du diff à la recherche de motifs de clés (préfixes Stripe `sk_`, clés API, blocs `PRIVATE KEY`). Bloquant, car c'est la seule erreur réellement irréversible.
2. **Détection des tirets longs dans `docs/`** : le cadratin et le demi-cadratin sont interdits par les conventions rédactionnelles (voir `AGENTS.md`). Un grep sur le diff des fichiers de `docs/` les rejette avant qu'ils n'atteignent le build.

Ces hooks restent volontairement modestes : rapides (moins d'une seconde), sans dépendance lourde, sans framework de gestion de hooks. Un script shell dans le dépôt, activé par chaque clone qui le souhaite, suffit. Les vérifications longues (build complet, suite de tests) restent du ressort de la discipline avant push et de la CI, pas des hooks : un pré-commit lent finit toujours contourné par `--no-verify`.

Le reste des conventions de développement est décrit dans les pages voisines : [setup du poste](index.md), [conventions de test](tests.md) et [CI/CD](ci-cd.md).
