---
label: Déploiement Atlas
order: 15
icon: container
description: Publication, admission, activation, contrôle et reprise de la release Surplasse sur Atlas.
---

# Déploiement sur Atlas

Atlas est l'unique chemin de production de Surplasse. Le monorepo utilise `compose.yaml` et `compose.development.yaml` uniquement pour le développement et l'intégration locale. La production consomme exclusivement le fragment `deployment/vps/compose.yaml` lié dans une `application-release` immuable, puis admis et activé par `vps-infra`, conformément à l'[ADR-0045](../decisions/adr-0045-atlas-unique-production.md).

L'[ADR-0041](../decisions/adr-0041-production-testeurs-stripe-test.md) autorise l'ouverture de la production et de la prise de commandes à un groupe de testeurs avec Stripe test et des sauvegardes locales au VPS. Cette dérogation ne vaut pas ouverture publique.

!!! warning Rappel obligatoire avant toute ouverture publique
La production et les commandes peuvent être ouvertes aux testeurs, mais Stripe live, le SMTP transactionnel qualifié, une sauvegarde chiffrée hors VPS restaurée, les CSP de Commande et du Dashboard, une sonde publique indépendante et son canal d'alerte restent à terminer absolument avant l'ouverture publique.
!!!

## État opérationnel Atlas au 2026-08-18

Cette section conserve la première preuve productrice comme repère historique. Elle ne désigne ni le sommet courant de `main`, ni le digest à activer aujourd'hui. Toute opération doit redécouvrir les références courantes et relire l'état désiré dans `vps-infra`.

| Frontière | Preuve historique | Portée |
|---|---|---|
| Hôte et plateforme Atlas | Provisionnés | Plateforme partagée disponible, pas activation implicite de Surplasse |
| Révision productrice | `b3df325fd8266b8a0a73e8b4ee3a936683861a15` | Commit prouvé pendant le run, pas cible courante |
| `vps-integration` | `sha256:1c193f79052ed618cdd62b769ca066dfd2190612788a416279591f211af15b9d` | Bundle immuable de cette révision |
| `application-release` | `sha256:68a479690817cc55a19985a19f0d524007eeb4a8f240656397fa4d313d0a7b4e` | Signal immuable de cette révision |
| Publication productrice | [Run GitHub Actions 32068614255](https://github.com/nclsppr/surplasse/actions/runs/32068614255) | Publication prouvée, pas activation |

Avant toute annonce d'état courant, vérifier le sommet de `main`, les portes vertes, les digests et attestations OCI, l'entrée Surplasse dans `vps-infra`, la convergence du contrôleur, l'état des services sur Atlas et les sondes publiques.

## Frontière de responsabilité

Le dépôt Surplasse produit et prouve :

- les images immuables `backend`, `onboarding`, `commande`, `dashboard` et `docs` ;
- le fragment `deployment/vps/compose.yaml` ;
- le job one-shot `migrator` et la commande one-shot `pilot-bootstrap` ;
- la route Caddy, les cibles et règles Prometheus, le tableau de bord Grafana et les sondes attendues ;
- le manifeste `vps-integration`, puis l'`application-release` qui lie les digests exacts.

La plateforme `vps-infra` possède et contrôle :

- le bord Caddy public et ses certificats ;
- PostgreSQL, ses rôles, ses volumes et son cycle de sauvegarde ;
- les réseaux externes `app_surplasse` et `db_surplasse` ;
- les secrets matérialisés sous `/etc/vps/secrets/surplasse/` ;
- Prometheus, Grafana et leur accès privé ;
- l'admission, la migration, l'activation, la reprise et l'arrêt de la release.

Le monorepo ne fournit aucune commande de transport vers Atlas. `scripts/compose.sh` accepte seulement `development` et ne doit jamais être détourné pour la production.

## Contrat Compose de la release

`deployment/vps/compose.yaml` contient cinq services longs et deux jobs explicites :

| Service | Cycle de vie | Réseaux | État |
|---|---|---|---|
| `backend` | `restart: unless-stopped` | `app_surplasse`, `db_surplasse` | Aucun port hôte, migrations automatiques désactivées |
| `onboarding` | `restart: unless-stopped` | `app_surplasse` | Statique, non privilégié |
| `commande` | `restart: unless-stopped` | `app_surplasse` | Statique, non privilégié |
| `dashboard` | `restart: unless-stopped` | `app_surplasse` | Statique, non privilégié |
| `docs` | `restart: unless-stopped` | `app_surplasse` | Nimbus statique, non privilégié |
| `migrator` | profil `migration`, `restart: "no"` | `db_surplasse` | Même digest Backend, rôle PostgreSQL de migration |
| `pilot-bootstrap` | profil `pilot-bootstrap`, `restart: "no"` | `app_surplasse`, `db_surplasse` | Même digest Backend, manifeste protégé, Stripe test |

Tous les services retirent leurs capabilities, interdisent l'élévation de privilèges, rendent leur système de fichiers racine en lecture seule, bornent leurs journaux et possèdent des limites de ressources. Caddy, PostgreSQL, Prometheus et Grafana ne sont pas redéfinis dans ce fragment.

## Admission d'une release

Une release admissible part d'un commit complet présent sur `main`. Les portes productrices doivent avoir construit, testé, scanné et publié chaque image, puis produit les deux manifestes OCI reproductibles. Les tags servent à la découverte, jamais à l'activation. Le contrôleur retient les digests exacts liés par l'`application-release` et vérifie leurs attestations avant toute mutation.

Le contrat protégé de `vps-infra` fixe notamment le mode `testers`, l'activation explicite, les réseaux, les chemins de secrets, les routes et les limites de la release. Changer ce contrat est une action de plateforme revue séparément. Un push Surplasse seul ne déploie jamais l'application.

## Migration et activation

Le contrôleur Atlas suit cet ordre sans démarrer le Backend en avance :

1. résoudre l'`application-release` courante par digest et revérifier ses preuves ;
2. vérifier les réseaux, PostgreSQL 17, les rôles et chaque fichier de secret attendu ;
3. exécuter `migrator` avec le digest Backend sélectionné et le rôle `surplasse_migrator` ;
4. prouver un historique Flyway réussi et contigu de V1 à V15 ;
5. activer ou réconcilier les cinq services longs avec les digests admis ;
6. vérifier leurs healthchecks internes, puis les routes HTTPS publiques ;
7. si la base pilote est vide, exécuter la [procédure de bootstrap](bootstrap-pilote-production.md) ;
8. ouvrir la prise de commandes uniquement par l'action métier authentifiée, après les preuves du [pilote](pilote.md).

Le migrateur exige ses secrets par fichiers, utilise uniquement le réseau `db_surplasse` et quitte au premier échec. Le Backend utilise le rôle `surplasse_runtime`, privé des droits de migration. Le bootstrap reste une commande Java et JDBC sans serveur. Il exige l'historique exact V1 à `REQUIRED_SCHEMA_VERSION`, actuellement 15, conformément à l'[ADR-0047](../decisions/adr-0047-version-flyway-bootstrap-pilote.md).

Les commandes capables de muter Atlas, leur identité de projet et leurs validations appartiennent exclusivement au [runbook `vps-infra`](https://github.com/nclsppr/vps-infra/blob/main/docs/deployment.md#deploy-a-compose-application). Cette page n'en invente aucune variante.

## Contrôles après activation

Depuis un poste ou GitHub Actions, jamais en installant Node sur le VPS :

```bash
npm ci --prefix e2e
npm run e2e:install
SURPLASSE_E2E_ESTABLISHMENT_SLUG=<monitoring-slug> \
  npm run e2e:test -- production
```

La suite doit valider TLS et les routes de l'Onboarding, du Backend, du Dashboard et, si le slug est fourni, de Commande. Elle ne crée aucune donnée et ne reçoit aucun secret applicatif. La cible conserve uniquement :

```text
.surplasse/e2e/production/
+-- history.jsonl
+-- allure-report/
`-- test-results/
```

`history.jsonl` est l'historique borné. `allure-report/` et `test-results/` sont les sorties courantes, remplacées seulement après une génération complète. GitHub Actions met en cache uniquement l'historique et charge le rapport et les diagnostics comme artefact propre au run.

Compléter cette preuve externe par les healthchecks de la plateforme, la lecture des journaux bornés, l'état du migrateur et une requête métier authentifiée. Une publication OCI verte ne prouve jamais que le runtime public sert ce digest.

## Observabilité facultative {#observabilite-facultative}

En développement, le profil `observability` ajoute Prometheus et Grafana sans les placer dans la readiness du Backend :

```bash
npm run local:up
scripts/compose.sh development up --detach --wait prometheus grafana
scripts/compose.sh development ps prometheus grafana
curl --fail https://grafana.surplasse.test/api/health
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  https://api.surplasse.test/q/metrics
```

Le dernier contrôle doit afficher `404`, car Caddy ne publie jamais les métriques du Backend. L'arrêt de Prometheus et Grafana ne doit pas interrompre l'API :

```bash
scripts/compose.sh development stop prometheus grafana
curl --fail https://api.surplasse.test/q/health/ready
```

En production, Prometheus, Grafana, leurs volumes et leur cycle de vie appartiennent à Atlas. Le bundle Surplasse fournit seulement sa cible, ses règles et son tableau de bord. Grafana ne possède aucune route publique. Son accès passe par le tunnel privé décrit dans `vps-infra`. La perte de ses séries ou préférences n'affecte ni PostgreSQL, ni les commandes, ni les paiements.

## Mise à jour et reprise

Une mise à jour sélectionne une nouvelle `application-release` descendante dont toutes les portes sont vertes. Atlas exécute la migration, réconcilie les services avec les nouveaux digests et refait les sondes. Les images ne sont jamais reconstruites sous le même SHA.

Un échec avant mutation laisse la release courante intacte. Un échec après migration ne provoque jamais l'annulation automatique du schéma. Le runtime précédent ne redémarre que si sa compatibilité avec la version courante est attestée. Sinon, la reprise avance vers un commit correctif et une nouvelle release.

Le premier SHA sain de production inclut V15. Aucun retour vers un SHA pré-V15 n'est autorisé. Toute nouvelle migration fait avancer `REQUIRED_SCHEMA_VERSION` et ses preuves dans la même release.

## Données, sauvegarde et restauration

PostgreSQL est l'unique état métier actuel. Son volume, ses dumps et leur restauration appartiennent à Atlas. Les images et la configuration applicative se reconstruisent depuis les artefacts immuables. Prometheus et Grafana restent reconstructibles depuis leurs configurations versionnées.

Pour la phase MVP testeurs, une sauvegarde conservée sur le VPS est une dette explicitement acceptée et ne bloque pas l'ouverture de la production ni des commandes. Aucun stockage objet Scaleway n'est requis dans cette phase. Avant l'ouverture publique, un dump PostgreSQL chiffré doit toutefois être copié hors du VPS et une restauration complète doit être prouvée. Une sauvegarde jamais restaurée n'est pas une preuve.

Une restauration contrôle au minimum :

- l'historique Flyway contigu jusqu'à V15 ;
- le défaut `stripe` de `payment.provider` et `payment_refund.provider` ;
- les rattachements entre restaurateurs, établissements, commandes, paiements et remboursements ;
- la valeur `open` ou `paused` de chaque établissement ;
- les index critiques du [modèle de données](../architecture/donnees.md#migrations-flyway-effectivement-livrées).

Le stockage d'images reste absent tant que le domaine `generation` n'est pas livré. S'il est ajouté pendant le MVP, il peut utiliser un volume du VPS derrière l'interface S3 du Backend. Sa copie hors VPS rejoint les obligations préalables à l'ouverture publique.

## Arrêt

Un arrêt de production est une mutation Atlas explicite. Il passe par le contrôleur et les commandes bornées de `vps-infra`, jamais par un checkout Surplasse ni par le Compose local. Avant l'arrêt, identifier le digest actif, conserver les preuves utiles et mettre la prise de commandes à `paused` lorsque l'API reste disponible. Après reprise, revérifier les migrations, les healthchecks, les routes publiques et l'état métier.
