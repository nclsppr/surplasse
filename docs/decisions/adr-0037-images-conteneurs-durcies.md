---
label: "ADR-0037 : Images de conteneurs durcies"
order: 370
icon: law
description: "Construction minimale, secrets par fichiers, exécution restreinte, scan bloquant et attestations des images de production."
---

# ADR-0037 : images de conteneurs durcies et vérifiables

## Statut

Accepté, 2026-07-26.

## Contexte

L'[ADR-0026](adr-0026-compose-commun.md) retient une pile Docker Compose commune au poste local et au VPS Ubuntu LTS. Les recettes sont déjà multi-étapes, les bases sont épinglées par tag et digest, les frontends statiques utilisent NGINX non privilégié et les services applicatifs possèdent des healthchecks. Ce socle doit maintenant définir une politique complète pour la construction, l'exécution et la publication.

Une petite image ne suffit pas à prouver sa sécurité. Une variante Alpine peut réduire certains octets tout en ajoutant un écart `musl`, une image sans shell peut compliquer le diagnostic sans réduire le code applicatif, et une compression maximale peut déplacer le coût vers la CI ou le démarrage. À l'inverse, ajouter `curl` uniquement pour une sonde augmente réellement la surface et le nombre de paquets à corriger.

Les secrets posent une frontière distincte. Un `ARG` Docker et une variable `ENV` de Dockerfile ne sont pas un coffre : leur valeur peut rester visible dans les métadonnées, l'historique ou les journaux de build. Compose sait fournir des secrets sous forme de fichiers, mais les applications doivent explicitement accepter cette interface.

Enfin, un tag par SHA garantit l'identité demandée, pas l'innocuité du contenu ni son origine. La publication doit être précédée d'un scan et accompagnée d'une nomenclature logicielle, d'une provenance et d'une attestation vérifiable.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Conserver uniquement les recettes actuelles | Aucun nouvel outillage | Pas de scan bloquant, de SBOM, de provenance ni de règle commune pour les secrets et les journaux |
| Appliquer systématiquement Alpine, distroless et la compression maximale | Images parfois plus petites | Compatibilité et diagnostic plus difficiles ; gain non mesuré ; règle indépendante du runtime réel |
| Externaliser immédiatement tous les builds vers un service spécialisé | Chaîne dédiée et politiques centralisées | Service, compte et coût opérationnel supplémentaires pour un projet solo |
| **Durcir BuildKit, Compose et GitHub Actions dans le dépôt** | Politique versionnée, reproductible et testée au même SHA | Temps de CI plus long ; entretien du scanner et des attestations |

## Décision

### Construction

Chaque Dockerfile utilise une version exacte du frontend Dockerfile, épinglée par digest, et active les contrôles BuildKit en erreur. Les images de base restent officielles ou maintenues par l'éditeur, avec un tag lisible et un digest multi-plateforme dans `config/deployment/images.env`.

Les recettes restent multi-étapes. Elles copient d'abord les manifestes de dépendances, utilisent `npm ci` ou Maven en mode non interactif, puis copient les sources. Les caches npm et Maven passent par des montages de cache BuildKit et ne sont jamais copiés dans le runtime. `.dockerignore` exclut les secrets, sorties de build, rapports, caches et surfaces de travail qui ne participent pas à l'image.

La variante de runtime se choisit selon sa compatibilité et son entretien, pas selon une règle universelle. Temurin JRE Jammy reste la base du Backend. Les fichiers statiques restent servis par l'image NGINX non privilégiée déjà retenue. Aucun passage général à Alpine ou à une image distroless, aucune compression extrême et aucun format d'image exotique ne sont adoptés sans mesure sur le VPS cible.

Les sondes de santé utilisent un binaire déjà présent ou une primitive du runtime. Le Backend emploie une requête TCP HTTP en Bash et n'installe plus `curl` seulement pour son healthcheck.

### Secrets et exécution Compose

Un secret ne passe jamais par `ARG`, `ENV` dans un Dockerfile ou une couche de build. La clé Stripe publiable de Commande reste la seule valeur Stripe acceptée au build, car elle est publique par définition.

Le wrapper matérialise atomiquement les valeurs sensibles du profil protégé dans des fichiers hôte de mode `0600`, placés dans un répertoire de mode `0700` hors de git. Compose les monte ensuite sous `/run/secrets`. Cette étape utilise exclusivement la source `file`, compatible avec les services en lecture seule sur les moteurs supportés. PostgreSQL et Grafana consomment leurs interfaces `*_FILE` natives. Les points d'entrée du Backend, de l'Onboarding de développement et de Caddy lisent les fichiers nécessaires, refusent la présence simultanée d'une valeur directe et d'un fichier, puis lancent le processus. Les clés JWT restent des secrets Compose fondés directement sur leurs fichiers hôte protégés.

Les services applicatifs utilisent un système de fichiers en lecture seule, des répertoires temporaires explicites, `no-new-privileges`, un utilisateur non privilégié et la suppression de toutes les capacités Linux quand leur runtime le permet. Caddy ne récupère que `NET_BIND_SERVICE`. PostgreSQL conserve son point d'entrée officiel, qui doit initialiser les permissions du volume.

Tous les services utilisent le pilote de logs Docker `local`, avec une taille et un nombre de fichiers bornés. Les arrêts du Backend et de PostgreSQL reçoivent un délai explicite afin de terminer les requêtes et écritures en cours.

### Validation et publication

`npm run images:check` exécute les contrôles BuildKit sur toutes les recettes et tous leurs profils. `npm run compose:config:test` résout les deux piles et vérifie notamment les fichiers de secrets, capacités, utilisateurs, healthchecks et journaux. Ces portes tournent dans les workflows concernés.

Le workflow `images.yml` construit les quatre images applicatives de production sur chaque pull request concernée et chaque push sur `main`. Trivy analyse les paquets du système et des bibliothèques. Une vulnérabilité `HIGH` ou `CRITICAL` disposant d'un correctif bloque la publication. L'action Trivy et toutes les autres actions de ce workflow sont épinglées par SHA, notamment pour ne jamais suivre une référence mutable après un incident de chaîne d'approvisionnement.

La première exécution bloquante a conduit à passer NGINX de `1.29.4-alpine` à `1.31.3-alpine`, Quarkus de `3.37.3` à `3.37.4` et `jackson-core` à `2.22.1`. Ces versions rendent les quatre images applicatives conformes à la politique au moment de la décision. L'override `jackson-core` reste explicite dans le BOM du projet jusqu'à ce qu'une plateforme Quarkus retenue fournisse une version au moins équivalente.

Seul un push sur `main` peut publier dans GHCR. Le tag est le SHA git complet et n'est jamais réutilisé. Chaque image reçoit les labels OCI de source et de révision, une SBOM, une provenance BuildKit maximale et une attestation GitHub liée à son digest. La cible initiale est `linux/amd64`, architecture du runner et du futur VPS de référence. Un VPS ARM imposerait d'étendre la matrice, de scanner chaque variante et de publier un manifeste multi-architecture avant son provisionnement.

L'image `edge` reste hors de cette publication tant que le fournisseur DNS et son module Caddy versionné ne sont pas décidés. Les images amont PostgreSQL, Prometheus, Grafana et Mailpit restent consommées directement par digest. Cette limite est une porte explicite du premier déploiement, pas une valeur implicite dans le workflow.

## Conséquences

### Positives

- Les erreurs de recette Docker deviennent des échecs locaux et CI avant une construction coûteuse.
- Les caches accélèrent les reconstructions sans entrer dans les images finales.
- Les secrets ne figurent plus dans la configuration d'environnement des conteneurs créée par Compose.
- La surface d'exécution est réduite par les utilisateurs non privilégiés, les capacités supprimées et les systèmes de fichiers en lecture seule.
- Les logs ne peuvent plus remplir le disque sans rotation.
- Un SHA publié possède un scan préalable, une SBOM, une provenance et une attestation vérifiables.

### Négatives et dettes assumées

- Le scan et la seconde construction de publication augmentent le temps et le stockage de cache de GitHub Actions.
- `ignore-unfixed` laisse visibles mais non bloquantes les vulnérabilités sans correctif ; elles doivent rester surveillées par les mises à jour Renovate.
- L'override `jackson-core` doit être retiré dès que le BOM Quarkus sélectionné fournit une version au moins égale.
- La publication ne couvre initialement que `linux/amd64`.
- L'image Caddy de production ne peut pas être publiée avant le choix du fournisseur DNS.
- Compose améliore la distribution des secrets, mais le moteur Docker et l'utilisateur capable de le piloter restent une frontière de confiance élevée.

## Références

- [Bonnes pratiques de construction Docker](https://docs.docker.com/build/building/best-practices/)
- [Optimisation du cache BuildKit](https://docs.docker.com/build/cache/optimize/)
- [Contrôles de build Docker](https://docs.docker.com/build/checks/)
- [Secrets Docker Compose](https://docs.docker.com/compose/how-tos/use-secrets/)
- [Configuration des pilotes de logs](https://docs.docker.com/engine/logging/configure/)
- [Sécurité du moteur Docker](https://docs.docker.com/engine/security/)
- [SBOM et provenance avec BuildKit](https://docs.docker.com/build/ci/github-actions/attestations/)
- [Attestations des images avec GitHub Actions](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
- [Action Trivy officielle](https://github.com/aquasecurity/trivy-action)
