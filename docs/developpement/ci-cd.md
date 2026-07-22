---
label: CI/CD
order: 70
icon: workflow
description: "Intégration et déploiement continus : le garde-fou du workflow sans PR, les workflows GitHub Actions et le déploiement sur le VPS."
---

# CI/CD

Surplasse s'appuie sur GitHub Actions pour l'intégration continue et cible un déploiement continu. Les workflows Pages, API, Backend, Frontends et E2E existent. Les Dockerfiles, le socle Compose commun, ses deux surcharges, le profil facultatif d'observabilité et le runbook Ubuntu sont versionnés. La publication des images dans GHCR et le déploiement automatisé sur le VPS restent à livrer dans `images.yml` et `deploy.yml`.

Pour le détail des environnements et de la topologie de production, voir [Environnements](../operations/environnements.md) et [Exploitation](../operations/index.md).

## Philosophie

Le [workflow git](workflow-git.md) de Surplasse est volontairement minimal : une branche unique `main`, pas de pull request, des commits poussés le plus souvent possible. Ce choix supprime toute la mécanique de revue asynchrone, inutile pour un développeur seul, mais il supprime aussi le filet de sécurité qu'une PR apporte d'ordinaire.

La CI est ce filet. Elle repose sur deux principes :

1. **Chaque push sur `main` est potentiellement déployable.** Il n'existe pas de branche d'intégration ni de fenêtre de release : ce qui est sur `main` est ce qui part en production. La discipline de commit (une unité de travail vérifiée = un commit poussé) est la première ligne de défense, la CI est la seconde.
2. **La CI est le garde-fou du workflow sans PR.** Tout ce qu'une revue humaine attraperait mécaniquement (build cassé, test rouge, contrat OpenAPI incompatible) doit être attrapé par un workflow. Un push qui casse la CI se corrige immédiatement, par un commit de correction ou un revert, avant toute autre tâche.

!!! info Vérifier avant de pousser
La CI ne remplace pas la vérification locale, elle la confirme. Les commandes exécutées par les workflows (build, lint, [tests](tests.md)) sont les mêmes que celles lancées en local : un push ne devrait jamais découvrir un problème que le poste de travail pouvait détecter.
!!!

## Le workflow Pages

Le fichier `.github/workflows/pages.yml` construit le site Retype, l'assemble avec la landing statique, le tunnel d'embarquement et son aperçu du Dashboard (`frontends/onboarding/`), puis ajoute les assets de marque (`brand/`) et déploie l'ensemble sur GitHub Pages.

| Élément | Valeur |
|---|---|
| Déclencheurs | `push` sur `main`, déclenchement manuel et horaire à la minute 37 |
| Permissions | `contents: read` globalement ; `pages: write` et `id-token: write` accordés uniquement au job `deploy` |
| Concurrence | Groupe `pages`, avec annulation des exécutions en cours (`cancel-in-progress`) |
| Jobs | `quality` et `local-tests`, puis `build`, `deploy` et propagation différée d'un smoke rouge |

Le job `quality` utilise le checkout exact du workflow. Il vérifie les profils de domaines, la démo statique, les assets de marque, le package partagé, puis le lint, les tests et le build de Commande et du Dashboard. Cette porte tourne sur les push et les lancements manuels. Elle est ignorée pendant l'exécution horaire, qui relit un SHA de `main` déjà qualifié.

Le job `local-tests` tourne en parallèle. Il installe Chromium, dérive le domaine development depuis le profil central, crée un certificat éphémère, démarre le cluster avec `npm run local:up`, puis exécute `npm run e2e:test -- development`. Son cache restaure et sauvegarde l'historique Allure de cette seule cible. Le rapport HTML autonome est exporté dans un petit artefact destiné au job `build`. Le pointeur, les publications, les résultats et les diagnostics restent aussi disponibles 30 jours dans un artefact rejouable. Le cluster et ses volumes sont supprimés à la fin du job.

Le job `build` ne démarre que si `local-tests` a produit un rapport et si `quality` a réussi ou a été normalement ignoré pour l'horaire. Il enchaîne un nouveau checkout du même SHA, l'installation de Node 24 (`actions/setup-node@v4`), `npm ci`, une nouvelle vérification du fichier de domaines généré avec `npm run domains:check`, `npm run docs:build`, puis l'assemblage du site publié. Cet assemblage génère explicitement le `runtime-config.js` du profil production, place la landing et le tunnel à la racine, les assets de marque sous `brand/`, la documentation Retype sous `docs/` et le rapport Allure sous `local-tests/`. Il n'existe aucun choix implicite de la production depuis un hostname inconnu. Le script npm invoque `node node_modules/retypeapp/retype.js` directement plutôt que la commande `retype` : npm 10.9.x ne crée pas le lien `node_modules/.bin/retype` à l'installation, à cause d'une collision de noms de bin avec les paquets plateforme `retypeapp-*`. Le site assemblé est publié comme artefact Pages via `actions/upload-pages-artifact@v3`.

Le job `deploy` dépend de `build`. Il ne s'exécute que si la référence est `refs/heads/main`, cible l'environnement GitHub `github-pages` et publie l'artefact avec `actions/deploy-pages@v4`. Les permissions `pages: write` et `id-token: write` sont limitées à ce job ; les installations et validations précédentes restent en lecture seule sur le dépôt. Une suite UI rouge ne peut donc pas publier le SHA concerné, même si le workflow `Frontends` séparé termine plus tard.

Un smoke Playwright rouge produit quand même un rapport Allure rouge, puis le site est déployé avec ce diagnostic. Le job `local-tests-status` propage seulement ensuite le code d'échec au workflow. Une panne ne laisse donc pas croire que l'ancien rapport vert est encore le résultat courant. Une erreur d'infrastructure qui empêche de produire un rapport bloque le build et conserve le dernier site complet.

Ce workflow reste volontairement sans filtre de chemins. Chaque push sur `main` republie la démo. Ainsi, toute évolution de `brand/**` ou `frontends/**` produit un nouvel artefact public, même lorsque seul le Dashboard, Commande ou le package partagé change. Une évolution UI n'est terminée qu'après le succès des workflows `Frontends` et `Pages` pour le même SHA, puis le contrôle visuel de la démo publique en vue mobile et bureau.

## Les workflows

Le monorepo suit un découpage par filtres de chemins (`paths`) : un push qui ne touche que `frontends/commande/` ne doit pas déclencher les tests du backend. `api.yml`, `backend.yml` et `frontends.yml` existent. `images.yml` et `deploy.yml` restent à créer maintenant que leurs recettes Compose sont disponibles.

| Workflow | Déclencheur (filtre de chemins) | Étapes |
|---|---|---|
| `pages.yml` | chaque `push` sur `main`, lancement manuel et chaque heure à la minute 37 | Porte qualité UI hors horaire, cluster Compose development jetable, smoke Playwright, rapport Allure public sous `/local-tests/`, build Retype et déploiement GitHub Pages |
| `api.yml` | `push`, chemins `api/**`, `openapitools.json`, `scripts/api/**` | Lint Spectral, contrôle de compatibilité `oasdiff` contre le commit précédent (dérogation par préfixe de commit `api!:`), fraîcheur de la génération (`npm run api:generate` puis `git diff --exit-code`) |
| `backend.yml` | `push`, chemins `backend/**`, `api/**`, profils de domaines, wrapper ou `package.json` | Java 21 Temurin, cache Maven, `npm run backend:verify` : injection du profil, compilation, tests unitaires et d'intégration (PostgreSQL 17 via Testcontainers), métriques Micrometer et endpoint `/q/metrics`, contrat et formatage Spotless |
| `frontends.yml` | `push`, chemins `frontends/**`, profils, scripts Compose et locaux, fichiers Compose, `infra/caddy/**`, `infra/images/**`, `infra/observability/**`, `brand/**`, `api/**` | Profils et QR générés, tests isolés du contrôleur Compose et des rapports du cockpit, syntaxe shell, modèles Compose avec et sans observabilité, refus des configurations dangereuses, validation de Caddy, CORS, package `shared`, lint, tests et builds des fronts |
| `e2e.yml` | push ciblé sur le package ou sa configuration, chaque heure à la minute 17 après activation, plus déclenchement manuel | validation légère au push ; Chromium, smokes sans écriture, rapport Allure 3, historique propre à la cible, traces et artefact rejouable pour les lancements de surveillance |
| `images.yml` (cible) | `push` sur `main`, chemins `backend/**`, `frontends/**`, `brand/**`, `config/domains/**`, `infra/images/**`, `infra/observability/**`, fichiers Compose | Build des quatre images applicatives et du Caddy DNS pour le profil production, contrôle qu'aucun artefact development n'entre dans les images, tag par SHA complet, push vers GHCR ; Prometheus et Grafana restent des images amont épinglées |
| `deploy.yml` (cible) | Fin réussie de `images.yml` sur `main`, ou déclenchement manuel avec un SHA complet | Connexion SSH au VPS, sélection de `IMAGE_TAG`, wrapper Compose, attente des healthchecks publics |

L'enchaînement sur un push touchant du code applicatif se lit ainsi :

```
push sur main
     |
     +--> filtres de chemins
     |         |
     |         +--> backend.yml     (si backend/ ou api/ touchés)
     |         +--> frontends.yml   (si frontends/, config/domains/, cockpit, brand/ ou api/ touchés)
     |         +--> api.yml         (si api/ touché)
     |         +--> pages.yml       (à chaque push sur main)
     |
     +--> images.yml  (cible, si une recette ou un module déployé change)
                |
                +--> deploy.yml  (cible, si images.yml réussit)
```

La cible ne doit publier puis déployer les images qu'après la réussite des portes API, Backend et Frontends du même SHA. Cette dépendance reste à encoder avec les deux workflows manquants ; elle ne doit pas être remplacée par une simple course en parallèle.

Les jobs `domains` et `dev-cockpit` utilisent seulement Node 24 et son runner de tests natif. Le contrôleur Compose du cockpit y reçoit un exécuteur simulé : ce job ne démarre ni Docker, ni le cluster, ni Chromium. Les jobs `commande` et `dashboard` installent d'abord `frontends/shared/`, consommé en source conformément à l'ADR-0014, puis leur propre verrou npm. Le job Dashboard exécute successivement `npm run lint`, `npm test` et `npm run build`. Ce dernier inclut `tsc --noEmit` avant le build Vite. Aucun de ces outils de vérification ne devient un processus de production.

Le bouton Playwright du cockpit appelle uniquement `npm run e2e:test -- development` sur le poste, après contrôle de la santé du cluster Compose local, puis rend le dernier rapport accessible sur `REPORTS_URL`. Il reste séparé du job `local-tests`, qui construit son propre cluster jetable et publie son propre historique sur GitHub Pages. Le cockpit ne propose jamais `production` ou `custom`. Ces cibles passent par la CLI ou par le workflow E2E, ce qui conserve une sélection explicite et une trace de l'exécution.

L'observabilité suit les mêmes portes que le code qu'elle décrit. Le Backend teste ses compteurs avec un registre en mémoire et vérifie que `/q/metrics` exporte les séries attendues. La validation Compose résout les deux environnements avec le profil `observability`, contrôle les images épinglées, les montages en lecture seule, les volumes et l'absence de dépendance du Backend vers Prometheus ou Grafana. La même image Prometheus épinglée exécute `promtool check config`, ce qui charge aussi les règles référencées, puis Node parse le JSON du tableau de bord. Le test Caddy exige un `404` public sur `/q/metrics` et la production ne reçoit aucun upstream Grafana.

Le déploiement applicatif normal ne dépend pas du profil facultatif. Une indisponibilité de Prometheus ou Grafana ne rend ni le SHA applicatif, ni le healthcheck Backend rouges. Une modification de leurs fichiers se déploie par un démarrage ou une recréation explicite des deux services après validation. Les règles restent sans canal de notification tant qu'Alertmanager n'est pas livré.

## La surveillance E2E horaire

Le workflow `.github/workflows/pages.yml` exerce la cible `development` à la minute 37 de chaque heure. Il publie le dernier rapport sur [nclsppr.github.io/surplasse/local-tests/](https://nclsppr.github.io/surplasse/local-tests/). Cette preuve valide les images construites depuis `main`, le graphe Compose, Caddy, PostgreSQL, le Backend et les frontends dans un runner jetable. Elle ne mesure pas le poste local d'un développeur et ne dépend d'aucun secret applicatif.

Le workflow `.github/workflows/e2e.yml` valide au push le résolveur de cibles et le chargement de toutes les spécifications, sans installer de navigateur ni joindre un environnement. Son horaire `17 * * * *` évite le début exact de l'heure, souvent chargé chez GitHub. Il cible le profil `production`, mais le job planifié reste ignoré tant que la variable de dépôt `E2E_MONITORING_ENABLED` ne vaut pas `true`. Cette porte empêche de signaler comme panne une production qui n'est pas encore provisionnée.

Un lancement manuel choisit `production` ou `custom`. La seconde option exige `target_id` et `base_domain`, puis accepte un `establishment_slug` facultatif. Elle permet de rejouer le même rapport sur un deuxième serveur ou une future UAT. Elle ne construit pas cette UAT et ne remplace pas son profil de domaines applicatif. Les rapports produits restent dans les artefacts GitHub Actions et ne sont pas publiés par le cockpit local.

Le job suit cet ordre :

```text
checkout et npm ci du package e2e
              |
              v
validation de la cible et restauration du pointeur et de l'historique
              |
              v
installation de Chromium, puis smokes Playwright
              |
              v
génération Allure 3 et mise à jour de l'historique
              |
              +--> sauvegarde du cache propre à la cible
              +--> artefact rapport, résultats, historique et diagnostics
              |
              v
propagation du code rouge après conservation des preuves
```

Le cache utilise une clé immuable par `run_id` et un préfixe de restauration par cible. Il restaure `current.json` et le `history.jsonl` de la publication associée. Deux cibles ne partagent donc jamais leurs tendances. L'artefact est conservé 30 jours et contient le pointeur ainsi que les publications rejouables, car un cache GitHub peut être évincé. La concurrence est sérialisée par cible avec `cancel-in-progress: false`, afin que deux lancements ne réécrivent pas simultanément le même historique.

Le slug témoin planifié vient de `E2E_PRODUCTION_ESTABLISHMENT_SLUG`. En son absence, le test mobile Commande est visible comme ignoré et les autres smokes restent obligatoires. Aucune clé applicative ou donnée de connexion n'entre dans le workflow. Les tests horaires ne créent ni magic link, ni session de table, ni commande, ni paiement.

Une planification GitHub peut démarrer en retard ou être omise lors d'une forte charge. Ce workflow apporte une preuve fonctionnelle périodique et un diagnostic navigateur, mais il ne remplace pas la sonde de disponibilité et son canal d'alerte décrits dans [Observabilité](../operations/observabilite.md).

Deux règles transversales :

- **Le contrat d'abord.** Toute modification de `api/openapi.yaml` passe par `api.yml` avant que backend ou frontends ne consomment la nouvelle version. Une rupture de compatibilité détectée par `oasdiff` fait échouer le workflow ; elle n'est acceptée que si elle est assumée et documentée (voir [le contrat](../architecture/api.md)).
- **Des images immuables.** Une image est construite une seule fois, taggée par le SHA du commit qui l'a produite, et n'est jamais reconstruite ni re-taggée. Déployer, c'est choisir un SHA ; revenir en arrière, c'est en choisir un autre.

## Le déploiement cible

Le déploiement vise le VPS unique décrit dans [Exploitation](../operations/index.md). Le workflow `deploy.yml` procède ainsi :

```
GitHub Actions                                VPS
     |                                         |
     |-- (1) ssh (clé dédiée au déploiement) ->|
     |                                         |-- (2) checkout + IMAGE_TAG=<sha>
     |                                         |-- (3) compose.sh production pull
     |                                         |-- (4) compose.sh production up --wait
     |<- (5) sondes HTTPS publiques -----------|
     |                                         |
     |-- (6) échec ? redéployer le tag         |
     |        précédent (rollback)             |
```

1. **Connexion SSH.** Le runner GitHub Actions se connecte au VPS avec une clé SSH dédiée au déploiement, restreinte à un utilisateur non privilégié membre du groupe Docker. La clé privée est un secret de CI, la clé publique est provisionnée sur le VPS.
2. **Sélection de la version.** Le dépôt du VPS passe en checkout détaché sur le SHA complet demandé et `IMAGE_TAG` reçoit exactement le même SHA dans `/etc/surplasse/production.env`. `scripts/compose.sh` refuse un tag mutable, abrégé, différent du checkout ou un worktree sale.
3. **Pull.** `scripts/compose.sh production pull` récupère les images taggées depuis GHCR avec le profil de domaines central.
4. **Recréation contrôlée.** `scripts/compose.sh production up --detach --wait` recrée seulement les conteneurs modifiés et attend leurs healthchecks.
5. **Healthcheck post-déploiement.** Le workflow interroge `/q/health/ready` et la page d'accueil de chaque front par leurs URL HTTPS publiques. Un healthcheck rouge fait échouer le workflow et déclenche une alerte (voir [Observabilité](../operations/observabilite.md)).
6. **Rollback.** Revenir en arrière consiste à relancer `deploy.yml` manuellement avec le SHA du dernier déploiement sain en paramètre. Le checkout et les images reviennent ensemble à cette version. Aucune reconstruction n'est nécessaire : l'image précédente existe toujours dans le registre. Les migrations Flyway étant additives par convention (voir [Backend](../architecture/backend.md)), un rollback applicatif n'exige pas de rollback de schéma.

!!! warning Migrations et rollback
Le rollback redéploie le code, pas la base. Une migration Flyway qui supprime ou renomme une colonne casserait la version précédente du backend. La convention est donc : les migrations destructives sont découpées en deux déploiements (d'abord le code qui n'utilise plus la colonne, puis la migration qui la supprime).
!!!

## Les secrets de CI

Les secrets sont portés par les GitHub Environments, pas par des secrets de dépôt globaux. L'environnement `production` est associé au job de déploiement ; ses secrets ne sont exposés qu'aux exécutions sur `main`.

| Secret | Environnement | Usage |
|---|---|---|
| `VPS_HOST` | `production` | Adresse du VPS |
| `VPS_USER` | `production` | Utilisateur de déploiement (non privilégié) |
| `VPS_SSH_KEY` | `production` | Clé privée SSH dédiée au déploiement |

Le push vers GHCR utilise le `GITHUB_TOKEN` éphémère du workflow, aucun secret supplémentaire n'est requis. Les secrets applicatifs (Stripe, API OpenAI, base de données) ne transitent jamais par la CI : ils vivent dans le fichier d'environnement du VPS, décrit dans [Environnements](../operations/environnements.md). La CI sait déployer, elle ne sait pas ce que l'application déploie.

Cette séparation borne le rayon d'action d'une compromission : un secret de CI qui fuite donne au pire un accès SSH restreint au compte de déploiement, pas les clés Stripe live. Elle simplifie aussi la rotation : changer une clé applicative se fait sur le VPS et se prend en compte au redémarrage du service concerné, sans toucher à GitHub.

## Pas de staging, et c'est assumé

Il n'y a que deux environnements : le poste de développement local et la production (voir [Environnements](../operations/environnements.md)). Aucun environnement de staging n'est prévu au lancement, pour trois raisons :

- **Le coût de la pièce mobile.** Un staging est un deuxième VPS (ou une deuxième pile Compose) à maintenir, sauvegarder, superviser et garder synchrone. Pour un développeur seul, ce coût d'entretien dépasse le bénéfice tant que le trafic est faible.
- **La fidélité illusoire.** Un staging sans données réelles, sans trafic réel et sans webhooks Stripe live ne reproduit pas la production ; il donne surtout une fausse confiance. Le cluster Compose local exerce déjà le graphe, les images, Caddy, PostgreSQL et Stripe en mode test avec le profil development.
- **Le déploiement est réversible.** Images immuables taggées par SHA, rollback en une relance de workflow, migrations additives : le coût d'un déploiement raté est borné et court.

Quand une fonctionnalité est trop risquée pour partir directement en production, la réponse est un feature flag léger : une variable de configuration lue au démarrage, qui masque la fonctionnalité tant qu'elle n'est pas prête. Pas de plateforme de feature flags dédiée à ce stade ; une entrée de configuration par flag suffit.

Ce qui reste à trancher :

- Le seuil (trafic, chiffre d'affaires, nombre d'établissements actifs) au-delà duquel un environnement de staging redeviendrait pertinent.
- L'outillage exact du lint backend (outil de formatage seul ou analyse statique en plus) ; la décision sera consignée en ADR si elle est structurante.
