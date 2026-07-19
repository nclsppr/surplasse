---
label: Environnements
order: 20
icon: stack
description: "Deux environnements seulement (local et production) : domaines, DNS wildcard, certificats et variables d'environnement par service."
---

# Environnements

Surplasse ne connaît que deux environnements : le poste de développement local et la production. Cette page décrit ce que chacun contient, les domaines et certificats de la production, et les variables d'environnement attendues par chaque service. Le pourquoi de l'absence de staging est argumenté dans [CI/CD](../developpement/ci-cd.md) ; la topologie des services est décrite dans [Exploitation](index.md).

!!! warning État réel au 2026-07-19
Le Backend, y compris le module `identity`, et Commande sont exécutables localement. La documentation et la préfiguration statique de l'Onboarding sont publiées sur GitHub Pages. La pile VPS, `infra/`, le Dashboard, l'Onboarding React, l'IA, MinIO, Caddy et le fournisseur SMTP de production ne sont pas encore implémentés ou sélectionnés. Toutes les mentions de production ci-dessous décrivent donc la cible à rendre exécutable dans le commit qui introduira `infra/`.
!!!

## Deux environnements, pas un de plus

| | Local | Production |
|---|---|---|
| Usage | Développement quotidien, tests, démos | Le service réel, pour les restaurateurs et leurs clients |
| Où | Poste de travail (Quarkus en mode dev, Vite, Dev Services) | VPS unique, pile Docker Compose (voir [Exploitation](index.md)) |
| Données | Jeu de données de démonstration (seed), réinitialisable à volonté ; jamais de données réelles | Données réelles des établissements et des commandes |
| Base de données | PostgreSQL éphémère via Dev Services, ou conteneur local | PostgreSQL 17, sauvegardé quotidiennement |
| Stripe | **Mode test** exclusivement (cartes de test, webhooks relayés par la CLI Stripe) | **Mode live** |
| IA (extraction de carte) | Cible future : réponses enregistrées par défaut et appel réel activable | Cible future : API OpenAI réelle |
| Magic links | Implémentés : capturés par Mailpit, sans email réel | Fournisseur SMTP transactionnel à sélectionner avant le pilote |
| Déployé par | Personne : lancé à la main | Cible future : CI à chaque push sur `main` (voir [CI/CD](../developpement/ci-cd.md)) |

La règle d'étanchéité est absolue : aucune clé live, aucune donnée réelle et aucun secret de production ne se trouve jamais sur un poste local. Le mode simulé de l'IA sert aussi les tests : il rend les parcours d'embarquement rejouables sans coût ni latence d'appel.

Deux environnements seulement, cela signifie aussi qu'il n'existe aucun endroit intermédiaire où « essayer en vrai » : ce qui doit être vérifié l'est en local (Stripe test, IA simulée, données de seed), puis part en production derrière un feature flag si le risque le justifie. Les raisons de ce choix, et le seuil au-delà duquel il serait revu, sont détaillés dans [CI/CD](../developpement/ci-cd.md).

En local, les applications tournent sur des ports distincts plutôt que sur des domaines :

| Application | Statut | Local | Production cible |
|---|---|---|---|
| Onboarding | Préfiguration statique seulement | `localhost:4173/frontends/onboarding/` | `surplasse.com` |
| Commande | Exécutable localement | `localhost:5173` | `{slug}.surplasse.com` |
| Dashboard | Module absent | port 5174 réservé | `dashboard.surplasse.com` |
| Backend | Exécutable localement | `localhost:8080` | `api.surplasse.com` |

Ces ports sont la convention fixée dans le [setup](../developpement/index.md) (section « Ports conventionnels »). Les ports des modules absents restent réservés jusqu'à leur création.

## Les domaines

| Domaine | Application | Certificat |
|---|---|---|
| `surplasse.com` | Onboarding (vitrine et embarquement) | Certificat Let's Encrypt couvrant l'apex et le wildcard (deux SAN sur le même certificat) |
| `{slug}.surplasse.com` | Commande (un sous-domaine par établissement) | Wildcard `*.surplasse.com` |
| `dashboard.surplasse.com` | Dashboard | Wildcard `*.surplasse.com` |
| `api.surplasse.com` | Backend | Wildcard `*.surplasse.com` |
| Documentation | Ce site, sur GitHub Pages | Géré par GitHub |

Quatre points d'attention :

- Le wildcard est ce qui rend le produit possible : chaque établissement reçoit son sous-domaine (`{slug}.surplasse.com`) à la création de son espace, sans aucune opération DNS par établissement. C'est le mini-site que le QR code à table pointe.
- `dashboard` et `api` sont couverts par le même wildcard ; ce sont des sous-domaines réservés, exclus des slugs attribuables aux établissements (la liste des sous-domaines réservés est définie avec les règles de slug, voir [Frontends](../architecture/frontends.md)).
- La documentation reste sur GitHub Pages, hors du VPS. Un domaine dédié (`docs.surplasse.com` en CNAME vers GitHub Pages) est envisageable : un enregistrement DNS explicite prime sur le wildcard, il n'y a donc pas de conflit. Le choix reste à trancher.
- Tout le trafic HTTP est redirigé vers HTTPS par Caddy ; aucun service ne répond en clair.

## DNS et certificats

Le zonage DNS cible est minimal :

```
surplasse.com.        A      <IP du VPS>
*.surplasse.com.      A      <IP du VPS>
```

Un enregistrement apex, un enregistrement wildcard, tous deux vers le VPS. Caddy fait ensuite le routage par nom d'hôte (voir la [topologie](index.md)).

Le certificat wildcard `*.surplasse.com` est obtenu auprès de Let's Encrypt par défi **DNS-01** : c'est le seul type de défi qui autorise un wildcard. Concrètement, Caddy prouve le contrôle du domaine en créant un enregistrement TXT `_acme-challenge.surplasse.com` au moment de l'émission et du renouvellement.

!!! info Le choix du fournisseur DNS n'est pas neutre
Le défi DNS-01 exige que Caddy puisse créer cet enregistrement TXT automatiquement, donc que le fournisseur DNS expose une API supportée par un module Caddy. Le fournisseur DNS doit être choisi sur ce critère (Cloudflare, OVH, deSEC et d'autres conviennent). Le choix précis reste à trancher et sera consigné avec la mise en place de `infra/` ; le jeton d'API DNS devient alors un secret de production comme un autre.
!!!

Le renouvellement est entièrement automatique : Caddy renouvelle le certificat avant expiration sans intervention. La seule supervision nécessaire est une sonde d'expiration de certificat (voir [Observabilité](observabilite.md)), au cas où le jeton d'API DNS serait révoqué ou expiré.

## Variables d'environnement de la production cible

Lorsque `infra/` existera, les secrets de production vivront dans un fichier d'environnement sur le VPS, hors git, référencé par la pile Compose. Ils seront provisionnés à la main et ne transiteront jamais par la CI : celle-ci ne détiendra que ses propres secrets de déploiement, listés dans [CI/CD](../developpement/ci-cd.md).

Les noms d'identité et de SMTP ci-dessous sont stabilisés par le module `identity`. Les autres lignes restent l'inventaire cible de leur intégration. Le commit qui introduira chaque composant devra confirmer ses noms dans un `.env.example` et documenter ceux qui sont obligatoires. Les valeurs réelles ne figurent évidemment nulle part dans la documentation.

### Backend (Quarkus)

| Variable | Rôle |
|---|---|
| `QUARKUS_DATASOURCE_JDBC_URL` | URL JDBC de PostgreSQL (réseau interne Compose) |
| `QUARKUS_DATASOURCE_USERNAME` | Utilisateur applicatif de la base |
| `QUARKUS_DATASOURCE_PASSWORD` | Mot de passe associé |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (live) |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature des webhooks Stripe |
| `OPENAI_API_KEY` | Clé de l'API OpenAI (extraction de carte, enrichissement) |
| `S3_ENDPOINT_URL` | Endpoint MinIO (réseau interne Compose) |
| `S3_ACCESS_KEY` | Identifiant d'accès MinIO du backend |
| `S3_SECRET_KEY` | Secret d'accès associé |
| `AUTH_MAGIC_LINK_LANDING_URL` | URL HTTPS du Dashboard qui reçoit le magic link et l'échange par POST |
| `AUTH_SECURE_COOKIES` | Obligatoirement `true` en production, active `Secure` sur les cookies restaurateur |
| `AUTH_JWT_PRIVATE_KEY_PATH` | Chemin du fichier PEM de la clé privée RS256 courante, monté en lecture seule hors image |
| `AUTH_JWT_KEY_ID` | Identifiant `kid` de la clé de signature courante |
| `AUTH_JWT_JWKS_PATH` | Chemin du JWKS public de vérification, avec les clés courante et précédente pendant une rotation |
| `AUTH_JWT_ISSUER` | Émetteur exigé pour les JWT, normalement `https://api.surplasse.com` |
| `AUTH_JWT_AUDIENCE` | Audience exigée pour les JWT du Dashboard |
| `SMTP_HOST` | Hôte du fournisseur SMTP transactionnel |
| `SMTP_PORT` | Port SMTP du fournisseur |
| `SMTP_USERNAME` | Identifiant SMTP |
| `SMTP_PASSWORD` | Mot de passe SMTP |
| `SMTP_FROM` | Adresse expéditrice validée sur `surplasse.com` |
| `SMTP_TLS` | Activation du TLS direct, selon le port retenu par le fournisseur |
| `SMTP_START_TLS` | Politique STARTTLS exigée par le fournisseur ; aucun SMTP en clair en production |

Les variables JWT de chemin, de `kid` et de JWKS ainsi que les variables SMTP sont obligatoires en production. Les fichiers de clés et les secrets SMTP sont provisionnés sur Ubuntu LTS hors de l'image Backend. Ils sont montés en lecture seule ou injectés par le fichier d'environnement protégé du VPS. Ubuntu LTS fait foi en cas de divergence de chemins ou de permissions.

### Rotation des clés JWT

La rotation RS256 conserve une double vérification temporaire, jamais deux clés de signature actives :

1. Générer une nouvelle paire hors du conteneur et attribuer un nouveau `kid`.
2. Construire le JWKS avec la nouvelle clé publique courante et la clé publique précédente.
3. Remplacer le montage privé pointé par `AUTH_JWT_PRIVATE_KEY_PATH`, mettre à jour `AUTH_JWT_KEY_ID` et le fichier pointé par `AUTH_JWT_JWKS_PATH`, puis redémarrer le Backend.
4. Attendre plus de 15 minutes, durée maximale d'un JWT d'accès, puis retirer l'ancienne clé publique du JWKS et redémarrer le Backend.

Avant et après chaque redémarrage, `curl --fail https://api.surplasse.com/q/health/ready` doit répondre avec un état `UP`. La clé privée précédente est retirée du VPS après validation, mais sa copie maîtresse reste protégée selon la politique de gestion des secrets. Une suspicion de fuite déclenche la même procédure immédiatement.

### PostgreSQL

| Variable | Rôle |
|---|---|
| `POSTGRES_DB` | Nom de la base |
| `POSTGRES_USER` | Superutilisateur du conteneur |
| `POSTGRES_PASSWORD` | Mot de passe associé |

### MinIO

| Variable | Rôle |
|---|---|
| `MINIO_ROOT_USER` | Compte d'administration MinIO |
| `MINIO_ROOT_PASSWORD` | Mot de passe associé |

### Caddy

| Variable | Rôle |
|---|---|
| `DNS_API_TOKEN` | Jeton d'API du fournisseur DNS, pour le défi DNS-01 du certificat wildcard |

### Les trois fronts

Aucune variable à l'exécution : Onboarding, Commande et Dashboard sont des fichiers statiques. Leur configuration (URL de l'API, clé publique Stripe) est injectée au moment du build par la CI via des variables `VITE_*`, et fait donc partie de l'image taggée par SHA. Changer une de ces valeurs, c'est reconstruire.

Le tableau fixe l'inventaire cible des composants futurs, pas encore leur forme finale. Les variables déjà utilisées par le Backend et Commande sont documentées dans le [setup local](../developpement/index.md#variables-denvironnement) et leurs fichiers `.env.example` font foi.

## Reproduire la topologie de production en local

Le développement quotidien n'a pas besoin de la topologie complète : Quarkus en mode dev, les Dev Services et les serveurs Vite suffisent, et c'est voulu (voir le [setup](../developpement/index.md)).

Quand le besoin s'en fera sentir (mise au point du routage Caddy, débogage d'un comportement propre à Compose, répétition d'une restauration de sauvegarde), la pile Compose de `infra/` doit pouvoir se lancer telle quelle sur un poste local, avec trois adaptations :

- **Le DNS wildcard** : des entrées locales (`/etc/hosts` pour quelques slugs de test, ou un résolveur local pour un vrai wildcard) remplacent la zone publique.
- **Le TLS** : Caddy émet des certificats auto-signés locaux (`tls internal`) à la place du wildcard Let's Encrypt, le défi DNS-01 n'ayant pas de sens en local.
- **Les secrets** : un fichier d'environnement local reprend les mêmes noms de variables que la production, avec des valeurs de test (Stripe en mode test, IA simulée), conformément à la règle d'étanchéité ci-dessus.

Cette reproduction locale n'est pas un troisième environnement : c'est le même `infra/` que la production, lancé ailleurs. Si les deux divergent, c'est un bug de `infra/`.
