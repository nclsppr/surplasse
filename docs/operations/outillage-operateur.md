---
label: Outillage de l'opérateur
order: 25
icon: terminal
description: "Où l'opérateur regarde : accès à PostgreSQL, logs, résultats de tests, exploration de l'API. Les mêmes gestes en local et en production."
---

# L'outillage de l'opérateur

Cette page répond aux questions quotidiennes de celui qui exploite Surplasse : comment voir la base, où lire les logs, où trouver les résultats de tests, comment explorer et requêter l'API. Le principe directeur : **les mêmes gestes en local et en production**, seuls changent l'adresse et les identifiants.

## Voir la base PostgreSQL

| | Local (Dev Services) | Production (VPS) |
|---|---|---|
| Hôte | `localhost:5432` (port fixé, voir le [setup](../developpement/index.md)) | Réseau interne Compose uniquement : jamais exposé ; passer par un tunnel SSH (`ssh -L 5432:localhost:5432 <vps>` puis `localhost:5432`) |
| Base / utilisateur / mot de passe | `quarkus` / `quarkus` / `quarkus` (identifiants par défaut des Dev Services) | Variables `POSTGRES_*` du fichier d'environnement du VPS (voir [environnements](environnements.md)) |
| Données | Seed de démonstration, réinitialisable en relançant le mode dev | Données réelles : lecture prudente, jamais d'écriture manuelle (Flyway est le seul DDL, les services le seul DML) |

Pour l'interface humaine, tout client PostgreSQL convient : **TablePlus**, **DBeaver** ou **pgAdmin** en application de bureau, `psql` en terminal. Aucun client web n'est hébergé sur le VPS (une surface d'attaque de plus pour un besoin couvert par le tunnel SSH).

## Lire les logs

| Contexte | Où |
|---|---|
| Backend en dev | Le terminal `quarkus:dev` (format texte lisible) ; la Dev UI (`/q/dev-ui`) pour le détail |
| Frontends en dev | Le terminal Vite, et la console du navigateur |
| Production | `docker compose logs -f <service>` sur le VPS (backend, caddy, postgres...) ; agrégateur à poser plus tard, voir [observabilité](observabilite.md) |

## Résultats de tests

| Où | Contenu |
|---|---|
| `./mvnw verify` en local | La vérité avant tout push ; rapports détaillés dans `backend/*/target/surefire-reports/` |
| Onglet Actions du dépôt GitHub | Les workflows `api`, `backend`, `frontends` sur chaque push ; un rouge se corrige avant toute autre tâche ([CI/CD](../developpement/ci-cd.md)) |
| `npm test` dans `frontends/*` | Vitest en local |

## Explorer et requêter l'API

Le backend sert **Swagger UI sur `/q/swagger-ui`** (en dev), alimenté par le contrat lui-même : `npm run api:generate` copie `api/openapi.yaml` tel quel (brouillons visibles, marqués `x-draft`) dans les ressources de l'application, et le scan d'annotations est désactivé pour que le contrat reste l'unique source. On peut y lire chaque endpoint et l'appeler directement (penser à l'en-tête `X-Table-Session` pour les endpoints de commande).

En complément : `/q/health` (santé), `/q/metrics` (métriques Micrometer, avec le domaine paiement), `/q/dev-ui` (dev uniquement). L'exposition de Swagger UI en production reste fermée par défaut ; l'ouvrir serait une décision explicite.

## Les secrets

Les identifiants ci-dessus ne se copient jamais dans un document ni un canal de discussion. La référence des variables vit dans [environnements](environnements.md), les valeurs de production dans le fichier d'environnement du VPS, et les copies maîtresses dans le gestionnaire de mots de passe de l'équipe ; l'orientation complète (et le seuil au-delà duquel un coffre dédié se justifie) est décrite dans [la sécurité](../architecture/securite.md).
