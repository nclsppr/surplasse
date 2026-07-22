---
label: Outillage de l'opérateur
order: 25
icon: terminal
description: "Où l'opérateur regarde : accès à PostgreSQL, logs, résultats de tests, exploration de l'API. Les mêmes gestes en local et en production."
---

# L'outillage de l'opérateur

Cette page répond aux questions quotidiennes de celui qui exploite Surplasse : comment voir la base, les métriques et les logs, où trouver les résultats de tests, comment explorer et requêter l'API. Le principe directeur : **les mêmes gestes en local et en production**, seuls changent l'accès et les identifiants.

## Voir la base PostgreSQL

| | Boucle native locale (Dev Services) | Cluster Compose local ou production |
|---|---|---|
| Hôte | `localhost:5432`, port fixé pour `quarkus:dev` | Aucun port publié, accès par `exec postgresql` depuis l'hôte Compose |
| Base, utilisateur et mot de passe | `quarkus` / `quarkus` / `quarkus` pour les Dev Services | Variables `POSTGRES_*` du profil development ou du fichier protégé du VPS |
| Données | Seed de démonstration, réinitialisable en relançant le mode dev | Seed persistant en local ; données réelles en production, jamais de DML manuel |

Pour l'interface humaine en local, tout client PostgreSQL convient : **TablePlus**, **DBeaver** ou **pgAdmin** en application de bureau, `psql` en terminal. Dans le cluster et en production, la commande de référence est `scripts/compose.sh <profil> exec postgresql psql` depuis l'hôte. Aucun client web n'est hébergé. Si un accès graphique distant devient nécessaire, son tunnel sera conçu et documenté avec `infra/`, sans publier PostgreSQL sur Internet.

## Lire les logs

| Contexte | Où |
|---|---|
| Backend en dev | Le terminal `quarkus:dev` (format texte lisible) ; la Dev UI (`/q/dev-ui`) pour le détail |
| Emails en dev | Mailpit sur `https://mail.surplasse.test`, santé sur `/readyz` ; `localhost:8025` reste un diagnostic interne ; uniquement des comptes de démonstration, aucun volume persistant |
| Frontends en dev | Le terminal Vite, et la console du navigateur |
| Cluster local ou production | `scripts/compose.sh <profil> logs --follow <service>` sur l'hôte, par exemple `backend`, `edge`, `postgresql`, `prometheus` ou `grafana` ; Loki n'est pas installé |

Mailpit est absent de la CI et de la production. Les rejets, rebonds et délais de remise des magic links se consultent dans l'interface du futur fournisseur SMTP transactionnel, qui reste à sélectionner. Les logs du Backend ne contiennent ni adresse email ni jeton.

## Voir les métriques

Le profil Compose facultatif `observability` fournit le tableau de bord Grafana `Surplasse / Vue opérationnelle`. En développement, le lien vient de `GRAFANA_URL` et apparaît dans le cockpit. Prometheus reste sur le réseau Compose et n'a pas d'URL navigateur publique.

En production, Grafana n'est pas routé par Caddy. Après démarrage explicite du profil, ouvrir un tunnel depuis le poste d'exploitation :

```bash
ssh -N -L 3000:127.0.0.1:3000 <utilisateur>@<vps>
```

Le port de droite reprend `GRAFANA_PORT` si sa valeur diffère de l'exemple. Le navigateur joint alors l'extrémité locale du tunnel et l'opérateur se connecte avec le compte Grafana conservé dans son gestionnaire de mots de passe. Le port loopback du VPS n'est pas ouvert par le pare-feu. Les règles visibles dans Prometheus n'envoient pas encore de notification : Alertmanager est absent.

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
| `https://reports.surplasse.test` | Dernier rapport Allure de la cible development, disponible lorsque le cockpit local tourne |
| Artefact de `.github/workflows/e2e.yml` | Rapport Allure, résultats bruts, historique et diagnostics de production ou d'une cible custom ; téléchargement puis rejeu par la CLI |

## Explorer et requêter l'API

Le backend sert **Swagger UI sur `/q/swagger-ui`** (en dev), alimenté par le contrat lui-même : `npm run api:generate` copie `api/openapi.yaml` tel quel (brouillons visibles, marqués `x-draft`) dans les ressources de l'application, et le scan d'annotations est désactivé pour que le contrat reste l'unique source. On peut y lire chaque endpoint et l'appeler directement. Penser à l'en-tête `X-Table-Session` pour les endpoints de commande. Pour l'identité restaurateur, le navigateur conserve les cookies hôte uniquement ; les appels Dashboard utilisent les credentials plutôt qu'un en-tête `Authorization`.

En complément : `/q/health` (santé) et `/q/dev-ui` (développement uniquement). `/q/metrics` existe dans le Backend, mais Caddy le refuse sur l'URL publique de l'API. Il est collecté seulement depuis le réseau Compose et ne doit pas être ouvert pour faciliter un diagnostic. L'exposition de Swagger UI en production reste fermée par défaut ; l'ouvrir serait une décision explicite.

## Les secrets

Les identifiants ci-dessus ne se copient jamais dans un document ni un canal de discussion. La référence des variables vit dans [environnements](environnements.md), les valeurs de production dans le fichier d'environnement du VPS, et les copies maîtresses dans le gestionnaire de mots de passe de l'équipe ; l'orientation complète (et le seuil au-delà duquel un coffre dédié se justifie) est décrite dans [la sécurité](../architecture/securite.md).
