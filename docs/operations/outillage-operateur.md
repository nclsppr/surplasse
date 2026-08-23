---
label: Outillage de l'opérateur
order: 25
icon: terminal
description: "Où l'opérateur regarde : accès à PostgreSQL, logs, résultats de tests, exploration de l'API et frontière Atlas."
---

# L'outillage de l'opérateur

Cette page répond aux questions quotidiennes de celui qui exploite Surplasse : comment voir la base, les métriques et les logs, où trouver les résultats de tests, comment explorer et requêter l'API. Les commandes `scripts/compose.sh development` s'appliquent uniquement au cluster local. Toute commande de production vient du [runbook `vps-infra`](https://github.com/nclsppr/vps-infra/blob/main/docs/deployment.md#deploy-a-compose-application), car Atlas est l'unique chemin de production.

## Voir la base PostgreSQL

| | Boucle native locale (Dev Services) | Cluster Compose local | Production Atlas |
|---|---|---|---|
| Hôte | `localhost:5432`, port fixé pour `quarkus:dev` | Aucun port publié, accès par `exec postgresql` depuis l'hôte Compose | Aucun port public, commande bornée de plateforme |
| Base, utilisateur et mot de passe | `quarkus` / `quarkus` / `quarkus` pour les Dev Services | Variables `POSTGRES_*` du profil development | Fichiers protégés gérés par `vps-infra` |
| Données | Seed de démonstration, réinitialisable en relançant le mode dev | Seed persistant et jetable | Données testeurs ou réelles, jamais de DML manuel |

Pour l'interface humaine en local, tout client PostgreSQL convient : **TablePlus**, **DBeaver** ou **pgAdmin** en application de bureau, `psql` en terminal. Dans le cluster local, la commande de référence est `scripts/compose.sh development exec postgresql psql`. Sur Atlas, tout accès passe par une commande bornée de `vps-infra`, sans publier PostgreSQL ni improviser de tunnel.

## Lire les logs

| Contexte | Où |
|---|---|
| Backend en dev | Le terminal `quarkus:dev` (format texte lisible) ; la Dev UI (`/q/dev-ui`) pour le détail |
| Emails en dev | Mailpit sur `https://mail.surplasse.test`, santé sur `/readyz` ; `localhost:8025` reste un diagnostic interne ; uniquement des comptes de démonstration, aucun volume persistant |
| Frontends en dev | Le terminal Vite, et la console du navigateur |
| Cluster local | `scripts/compose.sh development logs --follow <service>` sur l'hôte, par exemple `backend`, `edge`, `postgresql`, `prometheus` ou `grafana` ; Loki n'est pas installé |
| Atlas | Commandes bornées et projet Compose exact documentés par `vps-infra` |

Mailpit est absent de la CI et de la production. Les rejets, rebonds et délais de remise des magic links devront se consulter dans l'interface du relais SMTP transactionnel géré. Sa sélection, son provisionnement et sa qualification restent bloquants. Les logs du Backend ne contiennent ni adresse email ni jeton.

## Voir les métriques

Le profil Compose facultatif `observability` fournit le tableau de bord Grafana `Surplasse / Vue opérationnelle`. En développement, l'URL canonique vient de `GRAFANA_URL`. Prometheus reste sur le réseau Compose et n'a pas d'URL navigateur publique.

Sur Atlas, Grafana appartient à la plateforme et n'est pas routé par Caddy. Après activation de l'intégration Surplasse, ouvrir le tunnel documenté par `vps-infra` depuis le poste d'exploitation. La forme suivante illustre uniquement le principe, le port exact vient du runbook de plateforme :

```bash
ssh -N -L 3000:127.0.0.1:3000 <utilisateur>@<vps>
```

Le navigateur joint alors l'extrémité locale du tunnel et l'opérateur se connecte avec le compte Grafana conservé dans son gestionnaire de mots de passe. Les commandes et le port exact viennent du runbook de plateforme. Le port loopback du VPS n'est pas ouvert par le pare-feu. Les règles visibles dans Prometheus n'envoient pas encore de notification tant qu'aucun canal d'alerte n'est raccordé.

Pour un diagnostic interne sans exposer l'endpoint :

```bash
scripts/compose.sh development exec backend \
  curl --fail http://127.0.0.1:8080/q/metrics
scripts/compose.sh development exec prometheus \
  wget --quiet --output-document=- http://127.0.0.1:9090/-/ready
```

Les noms, labels, panneaux et limites sont documentés dans [Observabilité](observabilite.md). Les chiffres exacts d'un établissement ne viennent jamais de Prometheus.

## Résultats de tests

| Où | Contenu |
|---|---|
| `npm run backend:verify` en local | La vérité avant tout push, avec profil central injecté ; rapports détaillés dans `backend/*/target/surefire-reports/` |
| Onglet Actions du dépôt GitHub | Les workflows `api`, `backend` et `frontends` selon leurs filtres de chemins ; un rouge se corrige avant toute autre tâche ([CI/CD](../developpement/ci-cd.md)) |
| `npm test` dans `frontends/shared`, `frontends/commande` ou `frontends/dashboard` | Vitest en local pour la bibliothèque partagée et les deux applications React existantes |
| `.surplasse/e2e/<id>/history.jsonl` | Historique Allure borné de la cible, seul élément restauré par le cache CI |
| `.surplasse/e2e/<id>/allure-report/` | Rapport Allure courant, remplacé après chaque génération complète et ouvert par la CLI |
| `.surplasse/e2e/<id>/test-results/` | Traces, captures et diagnostics Playwright courants, remplacés à chaque exécution |
| Artefact de `.github/workflows/e2e.yml` | Rapport courant, historique et diagnostics propres à l'exécution, sans arborescence de publications imbriquées |

## Explorer et requêter l'API

Le backend sert **Swagger UI sur `/q/swagger-ui`** (en dev), alimenté par le contrat lui-même : `npm run api:generate` copie `api/openapi.yaml` tel quel (brouillons visibles, marqués `x-draft`) dans les ressources de l'application, et le scan d'annotations est désactivé pour que le contrat reste l'unique source. On peut y lire chaque endpoint et l'appeler directement. Penser à l'en-tête `X-Table-Session` pour les endpoints de commande. Pour l'identité restaurateur, le navigateur conserve les cookies hôte uniquement ; les appels Dashboard utilisent les credentials plutôt qu'un en-tête `Authorization`.

En développement, `/q/health`, `/q/dev-ui` et `/q/swagger-ui` restent disponibles selon la configuration locale. `/q/metrics` est collecté seulement depuis le réseau Compose et Caddy le refuse sur l'URL de l'API. En production, Caddy Atlas ferme toute surface `/q/*` avec un `404`, y compris la santé et Swagger UI. La readiness se contrôle par la sonde interne bornée de la plateforme, jamais en ouvrant un endpoint d'administration public.

## Les secrets

Les identifiants ci-dessus ne se copient jamais dans un document ni un canal de discussion. La référence des variables vit dans [Environnements](environnements.md). Sur Atlas, les valeurs sont matérialisées par fichier sous `/etc/vps/secrets/surplasse/`, sans valeur dans Git ni dans le bundle OCI. Les copies maîtresses restent dans le gestionnaire de mots de passe de l'équipe ; l'orientation complète est décrite dans [la sécurité](../architecture/securite.md).
