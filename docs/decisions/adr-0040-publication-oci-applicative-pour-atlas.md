---
label: "ADR-0040 : Publication OCI applicative pour Atlas"
order: 400
icon: law
description: "Pourquoi Surplasse publie un descripteur application-release unique, immuable et attesté avant toute décision de déploiement Atlas."
---

# ADR-0040 : publication OCI applicative pour Atlas

## Statut

Accepté, 2026-08-17.

## Contexte

Surplasse livre cinq images applicatives : le Backend Java, l'Onboarding, Commande, le Dashboard et la documentation. La production Atlas fournit séparément le bord Caddy, PostgreSQL et l'observabilité. Un déploiement ne peut donc pas être décidé à partir d'un seul tag d'image ni d'un checkout implicite. Il doit lier les cinq digests, le fragment Compose applicatif, la route Caddy, les cibles Prometheus, les règles, le tableau de bord Grafana, les migrations Flyway et les sondes.

Les workflows du dépôt utilisent des filtres de chemins. Plusieurs portes peuvent finir dans un ordre différent, et un nouveau push peut déplacer `main` pendant une publication. Un artefact présent dans GHCR ne prouve pas à lui seul que les autres portes du même commit sont vertes. Une publication issue d'une branche, d'un fork, d'un SHA devenu ancien ou d'une image construite par un autre workflow doit être refusée.

Le dépôt applicatif ne possède pas les secrets du VPS et ne doit ni ouvrir une session SSH, ni choisir le fournisseur DNS ou SMTP, ni activer Stripe Connect. Son rôle est de produire une entrée immuable et vérifiable pour le contrôleur Atlas. L'activation reste une décision séparée du dépôt `vps-infra`.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Déployer directement depuis le workflow Images | Chemin court | Mélange publication et activation ; secrets VPS dans le dépôt applicatif ; course entre portes ; aucun contrat unique |
| Laisser Atlas résoudre les tags des cinq images | Peu de fichiers producteurs | Tags mutables comme frontière ; relation implicite entre composants, migrations et sondes ; preuve de provenance fragmentée |
| **Publier un bundle d'intégration puis un descripteur `application-release` unique** | Tous les digests et inventaires sont liés ; admission exacte par SHA ; aucune autorité sur le VPS | Deux artefacts OCI et une validation stricte à maintenir ; la publication attend les workflows du même push |

## Décision

Chaque push sur `main` construit et publie les cinq images sous le SHA Git complet. Le workflow `VPS integration release` attend de manière bornée les exécutions `push` du même SHA. Il exige au minimum `Container images` et `Pages`, refuse toute exécution observée qui n'est pas terminée avec succès, vérifie que le SHA est encore le sommet canonique de `main`, puis stabilise deux lectures successives avant de continuer.

Le workflow résout les cinq tags en références `@sha256`, exige un index OCI avec une seule plateforme `linux/amd64`, vérifie les labels source, révision et version, puis valide l'attestation GitHub de chaque image. Le workflow signataire autorisé est `images.yml`, la source est `nclsppr/surplasse`, la référence est `refs/heads/main` et les runners auto-hébergés sont refusés.

Le premier artefact, `ghcr.io/nclsppr/surplasse/vps-integration`, utilise le contrat commun `vps-infra.application-integration.v1`. Il contient les couches `integration.tar.gz` et `inventory.json`, avec les mêmes media types que Parkventory. Le tar gzip déterministe place les fichiers sous `integration/` et son inventaire canonique lie chaque chemin, taille et hash. Le contenu est strictement limité au contrat applicatif, au Compose, aux références d'images exactes, à la route Caddy, à Prometheus, à Grafana, à l'inventaire de migrations et aux sondes. Les secrets sont seulement nommés ou montés par chemin. Aucune valeur sensible n'entre dans le bundle.

Le second artefact, `ghcr.io/nclsppr/surplasse/application-release`, est l'unique signal pour Atlas. Son descripteur suit `vps-infra.application-release.v1`. Il lie le SHA source, les cinq digests d'image, le digest du bundle, la politique de migration dédiée et les digests des octets canoniques de `migrations.json` et `probes.json`. La découverte utilise le tag `sha-<SHA>`, mais l'admission et le déploiement utilisent uniquement la référence `@sha256`.

Chaque artefact passe un aller-retour ORAS, une validation stricte de son manifeste, une comparaison octet par octet de ses couches et une attestation GitHub. Le workflow revérifie le sommet de `main` et les portes après publication. Le job final porte le nom stable `Publish immutable application release`. Une pull request exécute le job stable `Validate application release`, construit les contrats deux fois avec des références factices strictes et ne publie rien.

## Conséquences

### Positives

- Atlas reçoit un digest unique qui référence tout le contenu applicatif nécessaire.
- Un composant, une migration ou une sonde d'un autre SHA ne peut pas être admis silencieusement.
- Les artefacts sont reproductibles depuis le commit exact et indépendants du worktree courant.
- La chaîne productrice ne reçoit aucun secret VPS, aucune clé SSH et aucune autorité d'activation.
- Les migrations utilisent le digest Backend exact dans un job séparé avant le service HTTP.

### Négatives et dettes assumées

- Chaque push sur `main` reconstruit les cinq images, y compris pour une modification documentaire, afin que tout SHA publiable possède ses propres images attestées.
- Une course avec un push plus récent fait échouer la publication du SHA devenu ancien. Le nouveau sommet doit produire sa propre release.
- Atlas doit encore vérifier ce contrat, matérialiser les secrets, exécuter la migration, activer les services, sonder puis conserver le dernier digest sain.
- Le fournisseur DNS, le SMTP transactionnel, Stripe Connect live, les sauvegardes restaurables et le canal d'alerte restent des prérequis externes. Leur absence ne doit jamais être masquée par une release OCI verte.
