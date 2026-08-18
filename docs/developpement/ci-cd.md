---
label: CI/CD
order: 70
icon: workflow
description: "Intégration continue, publication de candidats OCI depuis main et activation Atlas séparée."
---

# CI/CD

Surplasse s'appuie sur GitHub Actions pour l'intégration continue et la publication de candidats pilotés ensuite par Atlas. Les workflows Pages, API, Backend, Frontends, E2E, Images et VPS integration existent. Les Dockerfiles, les piles Compose locale et historique et le bundle applicatif Atlas sont versionnés. `images.yml` construit, scanne et publie les cinq images applicatives dans GHCR. `vps-integration.yml` publie ensuite un digest `application-release` attesté. Il ne se connecte pas au VPS et n'active aucun service. Le runbook qui peut muter Atlas appartient à `vps-infra`.

Pour le détail des environnements et de la topologie de production, voir [Environnements](../operations/environnements.md) et [Exploitation](../operations/index.md).

## Philosophie

Le [workflow git](workflow-git.md) de Surplasse est volontairement minimal : une branche humaine unique `main`, pas de pull request humaine, des commits poussés le plus souvent possible. Renovate constitue la seule exception automatisée. Ses branches temporaires permettent de qualifier une mise à jour externe avant sa fusion manuelle.

La CI est ce filet. Elle repose sur deux principes :

1. **Chaque push sur `main` est un candidat potentiel, pas un déploiement.** Il n'existe pas de branche d'intégration ni de fenêtre de release. Les portes vertes du SHA exact autorisent la publication d'une `application-release` immuable. Atlas résout ensuite le sommet canonique, revérifie les preuves et n'active que si le contrat protégé est explicitement activé. Surplasse reste actuellement `enabled: false`.
2. **La CI est le garde-fou du workflow.** Tout ce qu'une revue humaine attraperait mécaniquement (build cassé, test rouge, contrat OpenAPI incompatible) doit être attrapé par un workflow. Un push qui casse la CI se corrige immédiatement. Une PR Renovate rouge n'est pas fusionnée.

!!! info Vérifier avant de pousser
La CI ne remplace pas la vérification locale, elle la confirme. Les commandes exécutées par les workflows (build, lint, [tests](tests.md)) sont les mêmes que celles lancées en local : un push ne devrait jamais découvrir un problème que le poste de travail pouvait détecter.
!!!

## Les mises à jour Renovate

Surplasse utilise l'App GitHub Mend Renovate hébergée. Le bot n'est pas auto-hébergé, ne s'exécute pas dans un workflow du dépôt et n'est jamais installé sur le VPS. Il analyse les manifestes et ouvre les branches et pull requests nécessaires depuis le service Mend.

La politique du dépôt est volontairement conservatrice :

| Règle | Valeur |
|---|---|
| Fenêtre | lundi, de 0 h à 5 h, fuseau `Europe/Paris` |
| Limite | trois branches et trois pull requests simultanées, deux nouvelles PR au maximum par heure |
| Fusion | manuelle uniquement, aucun automerge |
| Lots | mises à jour npm et Maven non majeures groupées par écosystème ; GitHub Actions non majeures et digests groupés |
| Approbation préalable | toutes les versions majeures, Node, Java, Caddy, PostgreSQL, Quarkus, Stripe et OpenAPI Generator |
| Visibilité | Dependency Dashboard GitHub intitulé « Mises à jour Renovate » |
| Exception de sécurité | les alertes de vulnérabilité GitHub ignorent la fenêtre et les quotas pour proposer immédiatement une correction, sans automerge |

Renovate couvre npm, Maven, Maven Wrapper, les dépendances Python, GitHub Actions, `mise.toml`, les directives de syntaxe Dockerfile, OpenAPI Generator, `oasdiff` et les images de `config/deployment/images.env`. Pour ces dernières, le tag lisible et le digest sont remplacés ensemble.

L'App GitHub Mend Renovate hébergée ne peut pas exécuter `mise lock`. Une mise à jour de Node, Java ou Python peut donc proposer le nouveau pin, mais `mise.lock` est régénéré manuellement avec la version de `mise` déclarée dans `mise.toml`, relu puis ajouté à la branche du bot avant fusion. Surplasse ne contourne pas cette limite par un runner Renovate auto-hébergé ou un second bot d'écriture.

Chaque PR Renovate exécute les workflows concernés par ses chemins. `pages.yml` s'exécute sans filtre afin de fournir une porte intégrée, mais son job `deploy` refuse toute référence autre que `refs/heads/main`. `images.yml` construit et scanne sur la PR, mais son job `publish` reste limité à `main`. `vps-integration.yml` construit deux fois le bundle et le descripteur avec des digests factices stricts dans le job `Validate application release`. Une PR peut donc construire, tester et produire des diagnostics, mais jamais publier GitHub Pages, une image de production, une release OCI ou un déploiement VPS.

## Le workflow Pages

Le fichier `.github/workflows/pages.yml` construit la documentation Nimbus depuis `docs/`, l'assemble avec la landing statique, le tunnel d'embarquement et son aperçu du Dashboard (`frontends/onboarding/`), puis ajoute les assets de marque (`brand/`), le sélecteur de démos UI2 et le rapport Allure avant de déployer l'ensemble sur GitHub Pages.

| Élément | Valeur |
|---|---|
| Déclencheurs | `push` sur `main`, `pull_request` vers `main`, déclenchement manuel et horaire à la minute 37 |
| Permissions | `contents: read` globalement ; `pages: write` et `id-token: write` accordés uniquement au job `deploy` |
| Concurrence | Groupe `pages`, avec annulation des exécutions en cours (`cancel-in-progress`) |
| Jobs | `quality` et `local-tests`, puis `build`, `deploy` et propagation différée d'un smoke rouge |

Le job `quality` utilise le checkout exact du workflow. Il vérifie les profils de domaines, la démo statique, les assets de marque, le package partagé, puis le lint, les tests et le build de Commande, du Dashboard et des quatre packages UI2. Cette porte tourne sur les push, les pull requests et les lancements manuels. Elle est ignorée pendant l'exécution horaire, qui relit un SHA de `main` déjà qualifié.

Le job `local-tests` tourne en parallèle. Il installe Chromium, dérive le domaine development depuis le profil central, crée un certificat éphémère, démarre le cluster avec `npm run local:up`, puis exécute `npm run e2e:test -- development`. Son cache restaure et sauvegarde l'historique Allure de cette seule cible. Le rapport HTML autonome est exporté dans un petit artefact destiné au job `build`. Le pointeur, les publications, les résultats et les diagnostics restent aussi disponibles 30 jours dans un artefact rejouable. Le cluster et ses volumes sont supprimés à la fin du job.

Le job `build` ne démarre que si `local-tests` a produit un rapport et si `quality` a réussi ou a été normalement ignoré pour l'horaire. Il enchaîne un nouveau checkout du même SHA, l'installation de Node 24 (`actions/setup-node@v4`), les installations verrouillées, une nouvelle vérification du fichier de domaines généré avec `npm run domains:check`, puis le build documentaire. Nimbus exécute les tests de conversion, le contrôle Astro, le build, Pagefind et le lint avec l'origine `https://nclsppr.github.io` et le chemin de base `/surplasse/docs`. L'assemblage génère explicitement le `runtime-config.js` du profil production, place la landing et le tunnel à la racine, les assets de marque sous `brand/`, la documentation Nimbus sous `docs/`, le rapport Allure sous `local-tests/` et les trois builds UI2 `noindex` sous `/_experiments/untitled/`. Commande2 utilise seulement dans ce build une carte synthétique signalée. Dashboard2 ouvre une vue de service avec session, commandes et actions synthétiques conservées uniquement en mémoire. Ces modes ne s'activent pas dans les builds Compose ou Vite ordinaires. Le site assemblé est publié comme artefact Pages via `actions/upload-pages-artifact@v3`.

Le job `deploy` dépend de `build`. Il refuse explicitement l'événement `pull_request` et ne s'exécute que si la référence est `refs/heads/main`. Il cible alors l'environnement GitHub `github-pages` et publie l'artefact avec `actions/deploy-pages@v4`. Les permissions `pages: write` et `id-token: write` sont limitées à ce job ; les installations et validations précédentes restent en lecture seule sur le dépôt. Une suite UI rouge ou une PR Renovate ne peut donc pas publier le SHA concerné.

Sur `main`, un smoke Playwright rouge produit quand même un rapport Allure rouge, puis le site est déployé avec ce diagnostic. Le job `local-tests-status` propage seulement ensuite le code d'échec au workflow. Sur une PR, le déploiement est ignoré et ce même job propage directement l'échec. Une panne ne laisse donc pas croire que l'ancien rapport vert est encore le résultat courant. Une erreur d'infrastructure qui empêche de produire un rapport bloque le build et conserve le dernier site complet.

Ce workflow reste volontairement sans filtre de chemins. Chaque PR est qualifiée et chaque push sur `main` republie la démo. Ainsi, toute évolution de `brand/**` ou `frontends/**` produit un nouvel artefact public après sa présence sur `main`, même lorsque seul le Dashboard, Commande ou le package partagé change. Une évolution UI n'est terminée qu'après le succès des workflows `Frontends` et `Pages` pour le même SHA, puis le contrôle visuel de la démo publique en vue mobile et bureau.

## Les workflows

Le monorepo suit un découpage par filtres de chemins (`paths`) : un push ou une PR qui ne touche que `frontends/commande/` ne doit pas déclencher les tests du Backend. `api.yml`, `backend.yml`, `frontends.yml` et `e2e.yml` appliquent leurs filtres à `push` et `pull_request`. `images.yml` conserve ses filtres sur les PR, mais s'exécute sur chaque push de `main`. Cette exception garantit que tout SHA susceptible de produire une `application-release` possède ses cinq images propres et ne réutilise jamais les digests d'un commit précédent.

| Workflow | Déclencheur (filtre de chemins) | Étapes |
|---|---|---|
| `pages.yml` | chaque `push` sur `main`, chaque `pull_request` vers `main`, lancement manuel et chaque heure à la minute 37 | Porte qualité UI hors horaire, builds UI2, cluster Compose development jetable, smoke Playwright, rapport Allure et build Nimbus ; déploiement GitHub Pages uniquement depuis `main` |
| `api.yml` | `push` ou `pull_request`, chemins `api/**`, `openapitools.json`, `scripts/api/**`, manifestes npm et outillage `mise` | Lint Spectral, contrôle de compatibilité `oasdiff` contre le commit précédent (dérogation par préfixe de commit `api!:`), fraîcheur de la génération (`npm run api:generate` puis `git diff --exit-code`) |
| `backend.yml` | `push` ou `pull_request`, chemins `backend/**`, `api/**`, profils de domaines, wrapper, `package.json` ou outillage `mise` | Java 25 Temurin, cache Maven, `npm run backend:verify` : injection du profil, compilation, tests unitaires et d'intégration (PostgreSQL 17 via Testcontainers), métriques Micrometer et endpoint `/q/metrics`, contrat et formatage Spotless |
| `frontends.yml` | `push` ou `pull_request`, chemins `frontends/**`, profils, scripts Compose et locaux, fichiers Compose, `infra/caddy/**`, `infra/images/**`, `infra/observability/**`, `brand/**`, `api/**` ou outillage `mise` | Profils et QR générés, tests isolés du contrôleur Compose et des rapports du cockpit, syntaxe shell, modèles Compose avec et sans observabilité, refus des configurations dangereuses, validation de Caddy, CORS, package `shared`, lint, tests et builds des fronts |
| `e2e.yml` | `push` ou `pull_request` ciblé sur le package, sa configuration ou l'outillage `mise`, chaque heure à la minute 17 après activation, plus déclenchement manuel | validation légère sur push et PR ; Chromium, smokes sans écriture, rapport Allure 3, historique propre à la cible, traces et artefact rejouable pour les lancements de surveillance |
| `toolchain.yml` | `push` ou `pull_request`, `mise.toml`, `mise.lock`, `package.json`, `renovate.json5` ou le workflow lui-même | Validation de la configuration Renovate, installation réelle de Node, Java et Python depuis le lockfile sur Ubuntu, puis affichage des versions résolues |
| `images.yml` | `push` sur `main` ou `pull_request`, chemins `backend/**`, `docs/**`, `docs-nimbus/**`, `frontends/**`, `brand/**`, profils, recettes d'images, scripts et fichiers Compose | Contrôles BuildKit et Compose, build production des cinq images applicatives, scan Trivy bloquant ; sur `main` seulement, tag par SHA complet, push `linux/amd64` vers GHCR, SBOM, provenance et attestation |
| `vps-integration.yml` | chaque `push` sur `main` et chaque `pull_request` vers `main` | Sur PR, tests adversariaux et double build déterministe sans publication ; sur `main`, attente bornée des portes du même SHA, validation des cinq images attestées, publication et aller-retour ORAS de `vps-integration` puis `application-release` |

Une PR Renovate et sa fusion suivent deux chemins distincts :

```
PR Renovate
     |
     +--> filtres de chemins --> validations concernées
     +--> pages.yml           --> build et smoke, aucun déploiement
     |
     +--> fusion manuelle après CI verte
                    |
                    v
push sur main
     |
     +--> filtres de chemins
     |         |
     |         +--> backend.yml     (si backend/ ou api/ touchés)
     |         +--> frontends.yml   (si frontends/, config/domains/, cockpit, brand/ ou api/ touchés)
     |         +--> api.yml         (si api/ touché)
     |         +--> pages.yml       (à chaque push sur main)
     |
     +--> images.yml              (chaque push, cinq images du SHA)
     +--> vps-integration.yml     (attend Images, Pages et les portes observées)
                |
                +--> application-release@sha256 (signal Atlas)
```

Une image immuable présente dans GHCR n'est pas une promotion. Le job `Publish immutable application release` exige que `Container images` et `Pages` du même push soient verts, ainsi que chaque autre workflow `push` observé pour ce SHA. Il vérifie deux fois que le SHA reste le sommet de `main`, résout les cinq images en références digest, puis publie le signal unique pour Atlas. Une exécution `pull_request` ne peut jamais atteindre la publication ni le déploiement.

## Le workflow Images

`images.yml` commence par `npm run images:check` et `npm run compose:config:test`. La première commande exécute les contrôles du frontend Dockerfile épinglé sur toutes les recettes et variantes. La seconde résout les profils development et production, puis vérifie notamment que les secrets sensibles viennent de fichiers hôte protégés et passent sous `/run/secrets`, que les valeurs directes ont disparu de la configuration des conteneurs, que les capacités, utilisateurs et systèmes de fichiers correspondent à la politique et que les logs ont une rotation bornée.

Une matrice construit ensuite `backend`, `onboarding`, `commande`, `dashboard` et `docs` pour le profil production. Les caches npm et Maven de BuildKit sont conservés dans le cache GitHub Actions, sans entrer dans les couches finales. Chaque image chargée localement est analysée par Trivy 0.72.0. Après la seconde construction, le digest exact poussé est analysé à son tour avant l'attestation. Une vulnérabilité `HIGH` ou `CRITICAL` disposant d'un correctif arrête le workflow. Les actions GitHub, Docker, Trivy et d'attestation sont toutes épinglées par SHA.

Sur une PR, le workflow s'arrête après le scan. Une exécution manuelle suit le même chemin non publiable et ne reçoit pas la clé Stripe du dépôt. Sur un push vers `main`, une seconde matrice reconstruit depuis le même SHA et publie seulement le tag `ghcr.io/nclsppr/surplasse/<image>:<sha-complet>`, utilisé pour découvrir le digest. BuildKit ajoute les labels OCI, la SBOM et la provenance maximale. Le workflow rescane chaque digest poussé, puis GitHub l'atteste avec l'identité OIDC du workflow. Les permissions `packages: write`, `id-token: write` et `attestations: write` existent uniquement dans ce job. Un nouveau digest peut remplacer le tag de découverte lors d'une nouvelle exécution du même SHA, mais les descripteurs admis par Atlas restent liés au digest exact, jamais au tag.

Le contrat Atlas cible `linux/amd64`. Une autre architecture exigerait une évolution commune du producteur et du contrôleur avant publication. L'image `edge` reste exclue car Caddy appartient à la plateforme partagée de `vps-infra`, qui choisit et épingle son module DNS. La route publiée importe `/etc/caddy/surplasse-tls.caddy`, possédé et monté par Atlas. Les images PostgreSQL, Prometheus, Grafana et Mailpit continuent à venir directement de leur éditeur avec un digest dans les contextes qui les possèdent.

La politique publique `SURPLASSE_PRODUCTION_RELEASE_MODE` vient de `config/deployment/production-release.env`. Le workflow exige `testers` ou `public` et transmet la valeur du premier job aux matrices. La clé Stripe publiable de Commande vient séparément de la variable de dépôt `VITE_STRIPE_PUBLISHABLE_KEY`. En mode `testers`, le workflow exige `pk_test_` et refuse `pk_live_`. En mode `public`, il exige `pk_live_` et refuse `pk_test_`. Une valeur absente ou contenant un espace arrête la publication. Le SHA-256 de la clé est figé pour empêcher une substitution entre les matrices. Le script suit le JavaScript chargé par `index.html` et exige la valeur exacte avec un seul préfixe du mode attendu, dans l'image scannée puis dans le digest publié. Ce contrôle ne prouve pas l'existence de la clé chez Stripe ni son appartenance au même compte que la clé secrète Backend. Ces preuves restent dans le préflight du mode choisi. Le Dashboard reçoit le mode public uniquement pour sa bannière, jamais la clé. Une pull request peut seulement construire et scanner un candidat non publiable. La clé publiable est publique et sa présence dans les journaux, les arguments et la provenance de construction est assumée. Aucun secret Stripe, SMTP, PostgreSQL, JWT ou DNS n'entre dans le workflow ou dans un argument de build.

Les jobs `domains` et `dev-cockpit` utilisent seulement Node 24 et son runner de tests natif. Le contrôleur Compose du cockpit y reçoit un exécuteur simulé : ce job ne démarre ni Docker, ni le cluster, ni Chromium. Les jobs `commande` et `dashboard` installent d'abord `frontends/shared/`, consommé en source conformément à l'ADR-0014, puis leur propre verrou npm. Le job Dashboard exécute successivement `npm run lint`, `npm test` et `npm run build`. Ce dernier inclut `tsc --noEmit` avant le build Vite. Aucun de ces outils de vérification ne devient un processus de production.

Le bouton Playwright du cockpit appelle uniquement `npm run e2e:test -- development` sur le poste, après contrôle de la santé du cluster Compose local, puis rend le dernier rapport accessible sur `REPORTS_URL`. Il reste séparé du job `local-tests`, qui construit son propre cluster jetable et publie son propre historique sur GitHub Pages. Le cockpit ne propose jamais `production` ou `custom`. Ces cibles passent par la CLI ou par le workflow E2E, ce qui conserve une sélection explicite et une trace de l'exécution.

L'observabilité suit les mêmes portes que le code qu'elle décrit. Le Backend teste ses compteurs avec un registre en mémoire et vérifie que `/q/metrics` exporte les séries attendues. La validation Compose résout les deux environnements avec le profil `observability`, contrôle les images épinglées, les montages en lecture seule, les volumes et l'absence de dépendance du Backend vers Prometheus ou Grafana. La même image Prometheus épinglée exécute `promtool check config`, ce qui charge aussi les règles référencées, puis Node parse le JSON du tableau de bord. Le test Caddy exige un `404` public sur `/q/metrics` et la production ne reçoit aucun upstream Grafana.

Le déploiement applicatif normal ne dépend pas du profil facultatif. Une indisponibilité de Prometheus ou Grafana ne rend ni le SHA applicatif, ni le healthcheck Backend rouges. Une modification de leurs fichiers se déploie par un démarrage ou une recréation explicite des deux services après validation. Les règles restent sans canal de notification tant qu'Alertmanager n'est pas livré.

## La surveillance E2E horaire

Le workflow `.github/workflows/pages.yml` exerce la cible `development` à la minute 37 de chaque heure. Il publie le dernier rapport sur [nclsppr.github.io/surplasse/local-tests/](https://nclsppr.github.io/surplasse/local-tests/). Cette preuve valide les images construites depuis `main`, le graphe Compose, Caddy, PostgreSQL, le Backend et les frontends dans un runner jetable. Elle ne mesure pas le poste local d'un développeur et ne dépend d'aucun secret applicatif.

Le workflow `.github/workflows/e2e.yml` valide au push le résolveur de cibles et le chargement de toutes les spécifications, sans installer de navigateur ni joindre un environnement. Son horaire `17 * * * *` évite le début exact de l'heure, souvent chargé chez GitHub. Il cible le profil `production`, mais le job planifié reste ignoré tant que la variable de dépôt `E2E_MONITORING_ENABLED` ne vaut pas `true`. Cette porte empêche de signaler comme panne la route Surplasse qui n'est pas encore activée sur Atlas.

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
- **Des releases immuables.** Une image est construite une seule fois, taggée par le SHA du commit qui l'a produite, et n'est jamais reconstruite ni re-taggée. Le producteur publie un candidat lié au SHA. Atlas active une référence `application-release@sha256` après ses propres preuves.

## La publication applicative pour Atlas

Le workflow producteur ne se connecte jamais au VPS. Il transforme un push exact de `main` en deux artefacts OCI attestés :

```
push main au SHA exact
        |
        +--> cinq images linux/amd64 attestées
        +--> portes du même push stables et vertes
                         |
                         v
              vps-integration@sha256
                         |
                         v
              application-release@sha256
                         |
                         v
              admission séparée par Atlas
```

Le bundle `vps-integration` contient seulement le graphe applicatif et ses intégrations. Son artifact type commun est `application/vnd.vps-infra.application-integration.v1`. Ses couches `integration.tar.gz` et `inventory.json` utilisent le même contrat externe que Parkventory. Le Compose ne possède ni port hôte, ni PostgreSQL, ni Caddy, ni Prometheus, ni Grafana. Il référence les deux réseaux externes `app_surplasse` et `db_surplasse`. Le job `migrator` utilise le digest Backend exact, le rôle `surplasse_migrator` et `/opt/surplasse/scripts/backend-migrate.sh`. Le service HTTP utilise `surplasse_runtime` avec `QUARKUS_FLYWAY_MIGRATE_AT_START=false`.

Le bundle contient la route Caddy mais pas sa politique TLS. La route doit importer exactement `/etc/caddy/surplasse-tls.caddy`. Le validateur refuse une directive `tls` ou `dns` locale afin que le dépôt producteur ne choisisse ni le fournisseur DNS, ni le module Caddy, ni les identifiants. Atlas fournit et monte ce fichier séparément avant de valider sa configuration.

Le descripteur `application-release` est le seul signal admis par Atlas. Il lie les cinq images, le bundle, les migrations et les sondes au même SHA. Les tags `sha-<SHA>` servent à la découverte. Atlas doit résoudre puis conserver la référence `@sha256`, vérifier l'attestation et refuser toute référence mutable.

!!! info Première preuve productrice
La première preuve distante retenue porte sur la révision `b3df325fd8266b8a0a73e8b4ee3a936683861a15`, qui était le sommet de `main` pendant l'exécution [VPS integration release 32068614255](https://github.com/nclsppr/surplasse/actions/runs/32068614255). Elle a publié `vps-integration@sha256:1c193f79052ed618cdd62b769ca066dfd2190612788a416279591f211af15b9d` et `application-release@sha256:68a479690817cc55a19985a19f0d524007eeb4a8f240656397fa4d313d0a7b4e`. Ces références sont une preuve historique, pas un sommet durable : chaque nouveau push sur `main` doit publier son propre candidat. Cette preuve s'arrête à la publication. Surplasse reste `enabled: false` sur Atlas.
!!!

Cette publication ne prouve pas que l'activation réelle est possible. Atlas reste responsable de la vérification des fichiers de secrets pré-provisionnés, de sa politique TLS DNS-01, de PostgreSQL 17, des rôles, de la migration, des réseaux et routes, des sondes et de la politique de reprise. Après migration, le runtime précédent ne peut redémarrer que si sa compatibilité avec le schéma est attestée ; sinon le contrôleur doit s'arrêter pour une reprise explicite vers l'avant. L'[ADR-0040](../decisions/adr-0040-publication-oci-applicative-pour-atlas.md) fixe la frontière complète. Sa première preuve de mise en oeuvre consigne un candidat historique et l'absence d'activation Surplasse.

!!! warning Migrations et rollback
Le rollback redéploie le code, pas la base. Une migration Flyway qui supprime ou renomme une colonne casserait la version précédente du backend. La convention est donc : les migrations destructives sont découpées en deux déploiements (d'abord le code qui n'utilise plus la colonne, puis la migration qui la supprime).
!!!

## Les secrets de CI

La publication utilise seulement le `GITHUB_TOKEN` éphémère avec des permissions bornées : lecture des exécutions et du dépôt, écriture des paquets et des attestations, puis identité OIDC. Elle n'utilise ni clé SSH, ni adresse du VPS, ni secret applicatif. Le job de pull request conserve la permission globale `contents: read` et ne publie rien.

Les secrets applicatifs Stripe, JWT, SMTP et PostgreSQL ne transitent jamais par le bundle ou le workflow. Le Compose publié contient leurs noms de montage et les chemins attendus sous `/etc/vps/secrets/surplasse`, sans valeur. L'opérateur pré-provisionne les fichiers exacts hors de la release. Le contrôleur Atlas vérifie leurs chemins, leurs métadonnées et leur allocation par service sans lire ni persister leurs octets. Il doit échouer avant migration si un prérequis manque.

## Pas de staging, et c'est assumé

Il n'y a que deux environnements : le poste de développement local et la production (voir [Environnements](../operations/environnements.md)). Aucun environnement de staging n'est prévu au lancement, pour trois raisons :

- **Le coût de la pièce mobile.** Un staging est un deuxième VPS (ou une deuxième pile Compose) à maintenir, sauvegarder, superviser et garder synchrone. Pour un développeur seul, ce coût d'entretien dépasse le bénéfice tant que le trafic est faible.
- **La fidélité illusoire.** Un staging sans données réelles, sans trafic réel et sans webhooks Stripe live ne reproduit pas la production ; il donne surtout une fausse confiance. Le cluster Compose local exerce déjà le graphe, les images, Caddy, PostgreSQL et Stripe en mode test avec le profil development.
- **La cible impose une reprise bornée.** Images et release immuables, journal transactionnel et migrations additives rendent le retour applicatif possible. L'activation reste toutefois bloquée tant que la compatibilité descendante des migrations, la restauration et le comportement du bord pendant la reprise ne sont pas prouvés.

Quand une fonctionnalité est trop risquée pour partir directement en production, la réponse est un feature flag léger : une variable de configuration lue au démarrage, qui masque la fonctionnalité tant qu'elle n'est pas prête. Pas de plateforme de feature flags dédiée à ce stade ; une entrée de configuration par flag suffit.

Ce qui reste à trancher :

- Le seuil (trafic, chiffre d'affaires, nombre d'établissements actifs) au-delà duquel un environnement de staging redeviendrait pertinent.
- L'outillage exact du lint backend (outil de formatage seul ou analyse statique en plus) ; la décision sera consignée en ADR si elle est structurante.
