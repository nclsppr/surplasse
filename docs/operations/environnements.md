---
label: Environnements
order: 20
icon: stack
description: "Deux environnements seulement (local et production) : domaines, DNS wildcard, certificats et variables d'environnement par service."
---

# Environnements

Surplasse ne connaît que deux environnements : le poste de développement local et la production. Cette page décrit ce que chacun contient, les domaines et certificats de la production, et les variables d'environnement attendues par chaque service. Le pourquoi de l'absence de staging est argumenté dans [CI/CD](../developpement/ci-cd.md) ; la topologie des services est décrite dans [Exploitation](index.md).

!!! warning État réel au 2026-07-19
Le Backend, y compris le module `identity`, Commande et le Dashboard minimal sont exécutables localement. La topologie `surplasse.test`, Caddy local et le cockpit de modules sont implémentés sous `infra/local/` et `scripts/`. Le Dashboard lit et fait avancer les commandes par REST, puis actualise la file par un flux SSE authentifié par établissement. La documentation et la préfiguration statique de l'Onboarding sont publiées sur GitHub Pages. La pile VPS, les images de production, l'Onboarding React, l'IA, MinIO, le Caddy de production et le fournisseur SMTP de production ne sont pas encore implémentés ou sélectionnés. Toutes les mentions de production ci-dessous décrivent donc une cible, pas un déploiement disponible.
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

En local, Caddy reproduit les domaines de production avec la racine `surplasse.test`. Les ports distincts restent internes :

| Application | Statut | Local | Production cible |
|---|---|---|---|
| Onboarding | Préfiguration statique seulement | `https://surplasse.test` vers 4173 | `surplasse.com` |
| Commande | Exécutable localement | `https://{slug}.surplasse.test` vers 5173 | `{slug}.surplasse.com` |
| Dashboard | Exécutable localement, lecture REST | `https://dashboard.surplasse.test` vers 5174 | `dashboard.surplasse.com`, non déployé |
| Backend | Exécutable localement | `https://api.surplasse.test` vers 8080 | `api.surplasse.com` |

Ces ports sont la convention fixée dans le [setup](../developpement/index.md) (section « Ports conventionnels »). Vite refuse de déplacer silencieusement le Dashboard vers un autre port si 5174 est occupé. Le navigateur ne doit pas utiliser ces ports HTTP : les cookies restaurateur sont `Secure` en local comme en production.

Le Dashboard utilise `dashboard.surplasse.test` et l'API `api.surplasse.test`. Ce sont deux origines du même site HTTPS, avec une politique CORS explicite. Le magic link place son jeton dans `#token=...` : le fragment n'atteint ni Vite ni ses journaux d'accès et le Dashboard le retire avant son POST d'échange.

## Les domaines

| Production cible | Développement local | Application | Certificat |
|---|---|---|---|
| `surplasse.com` | `surplasse.test` | Onboarding (vitrine et embarquement) | apex et wildcard |
| `www.surplasse.com`, redirection cible vers l'apex | `www.surplasse.test`, redirection 308 vers l'apex | Alias du site public | wildcard |
| `{slug}.surplasse.com` | `{slug}.surplasse.test` | Commande (un sous-domaine par établissement) | wildcard |
| `dashboard.surplasse.com` | `dashboard.surplasse.test` | Dashboard | wildcard |
| `api.surplasse.com` | `api.surplasse.test` | Backend | wildcard |
| GitHub Pages, cible `docs.surplasse.com` non provisionnée | `docs.surplasse.test` | Documentation | géré par GitHub en production, mkcert en local |
| absent | `local.surplasse.test` | Cockpit de développement | mkcert |
| fournisseur SMTP externe | `mail.surplasse.test` | Mailpit | mkcert |

Quatre points d'attention :

- Le wildcard est ce qui rend le produit possible : chaque établissement reçoit son sous-domaine (`{slug}.surplasse.com`) à la création de son espace, sans aucune opération DNS par établissement. C'est le mini-site que le QR code à table pointe.
- `dashboard` et `api` sont couverts par le même wildcard ; ce sont des sous-domaines réservés, exclus des slugs attribuables aux établissements (la liste des sous-domaines réservés est définie avec les règles de slug, voir [Frontends](../architecture/frontends.md)).
- La documentation reste sur GitHub Pages, hors du VPS. `docs.surplasse.com` est son URL cible canonique, déjà réservée dans le profil de domaines, mais le CNAME et le domaine personnalisé Pages ne sont pas encore provisionnés. Un enregistrement DNS explicite primera sur le wildcard, sans conflit.
- En production cible, Caddy redirige tout trafic HTTP vers HTTPS. En local, Caddy n'expose que HTTPS sur 443 ; les ports HTTP internes restent liés à la boucle locale.

Les noms `www`, `api`, `dashboard`, `docs`, `app`, `admin`, `local` et `mail` sont réservés. `app` et `admin` ne correspondent encore à aucun module. Le détail exécutable de la topologie locale vit dans [Domaines locaux](../developpement/domaines-locaux.md).

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

Lorsque la pile de production sera ajoutée sous `infra/`, ses secrets vivront dans un fichier d'environnement sur le VPS, hors git, référencé par Compose. Ils seront provisionnés à la main et ne transiteront jamais par la CI : celle-ci ne détiendra que ses propres secrets de déploiement, listés dans [CI/CD](../developpement/ci-cd.md). `infra/local/` ne contient aucun secret de production.

Les noms d'identité et de SMTP ci-dessous sont stabilisés par le module `identity`. Les autres lignes restent l'inventaire cible de leur intégration. Le commit qui introduira chaque composant devra confirmer ses noms dans un `.env.example` et documenter ceux qui sont obligatoires. Les valeurs réelles ne figurent évidemment nulle part dans la documentation.

### Backend (Quarkus)

| Variable | Rôle |
|---|---|
| `APP_SCHEME` | `https` dans les deux environnements |
| `APP_BASE_DOMAIN` | domaine racine, `surplasse.com` en production |
| `APP_BASE_URL` | URL de l'Onboarding et base des URL publiques |
| `DASHBOARD_URL` | origine publique du Dashboard |
| `API_URL` | origine publique du Backend et émetteur JWT obligatoire |
| `PROBLEM_TYPE_BASE` | base canonique des identifiants RFC 9457, identique dans tous les environnements |
| `RESERVED_SUBDOMAINS` | noms exclus des slugs d'établissement |
| `COOKIE_DOMAIN` | vide par décision de sécurité ; les cookies restent hôte uniquement |
| `CORS_PUBLIC_ORIGINS` | apex et motif du sous-domaine direct, dérivés de `APP_BASE_DOMAIN` par le wrapper de profil, toujours sans credentials côté Quarkus |
| `QUARKUS_DATASOURCE_JDBC_URL` | URL JDBC de PostgreSQL (réseau interne Compose) |
| `QUARKUS_DATASOURCE_USERNAME` | Utilisateur applicatif de la base |
| `QUARKUS_DATASOURCE_PASSWORD` | Mot de passe associé |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (live) |
| `STRIPE_PAYMENT_WEBHOOK_SECRET` | Secret de la destination snapshot des paiements Connect |
| `STRIPE_ACCOUNT_WEBHOOK_SECRET` | Secret distinct de la destination fine Accounts v2 |
| `STRIPE_LIVE_MODE` | `true` obligatoire en production ; le Backend acquitte sans effet tout événement signé d'un autre mode |
| `OPENAI_API_KEY` | Clé de l'API OpenAI (extraction de carte, enrichissement) |
| `S3_ENDPOINT_URL` | Endpoint MinIO (réseau interne Compose) |
| `S3_ACCESS_KEY` | Identifiant d'accès MinIO du backend |
| `S3_SECRET_KEY` | Secret d'accès associé |
| `AUTH_JWT_PRIVATE_KEY_PATH` | Chemin du fichier PEM de la clé privée RS256 courante, monté en lecture seule hors image |
| `AUTH_JWT_KEY_ID` | Identifiant `kid` de la clé de signature courante |
| `AUTH_JWT_JWKS_PATH` | Chemin du JWKS public de vérification, avec les clés courante et précédente pendant une rotation |
| `AUTH_JWT_AUDIENCE` | Audience exigée pour les JWT du Dashboard |
| `SMTP_HOST` | Hôte du fournisseur SMTP transactionnel |
| `SMTP_PORT` | Port SMTP du fournisseur |
| `SMTP_USERNAME` | Identifiant SMTP |
| `SMTP_PASSWORD` | Mot de passe SMTP |
| `SMTP_FROM` | Adresse expéditrice validée sur `surplasse.com` |
| `SMTP_TLS` | Activation du TLS direct, selon le port retenu par le fournisseur |
| `SMTP_START_TLS` | Politique STARTTLS exigée par le fournisseur ; aucun SMTP en clair en production |

Les variables JWT de chemin, de `kid` et de JWKS ainsi que les variables SMTP sont obligatoires en production. Les fichiers de clés et les secrets SMTP sont provisionnés sur Ubuntu LTS hors de l'image Backend. Ils sont montés en lecture seule ou injectés par le fichier d'environnement protégé du VPS. Ubuntu LTS fait foi en cas de divergence de chemins ou de permissions.

Le futur conteneur Backend utilisera `scripts/run-with-domain-profile.sh production` comme point d'entrée avant la commande Java. Le wrapper source uniquement `config/domains/production.env`, puis dérive `CORS_PUBLIC_ORIGINS` et la valeur de repli de `SMTP_FROM`. Quarkus construit le magic link depuis `DASHBOARD_URL`, l'émetteur JWT depuis `API_URL` et impose les cookies `Secure` hors tests. Il produit `Access-Control-Allow-Credentials: false`, y compris en `%prod`. Le Caddy du VPS devra supprimer cet en-tête pour les origines publiques et le remplacer par `true` seulement quand `Origin` correspond exactement à `DASHBOARD_URL` ou `ONBOARDING_URL`. Les secrets du VPS peuvent remplacer uniquement les variables prévues. Sans profil, le Backend échoue au démarrage au lieu de choisir silencieusement `.test` ou `.com`.

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

Aucune variable secrète à l'exécution : Onboarding, Commande et Dashboard sont ou seront des fichiers statiques. Les valeurs publiques communes viennent de `config/domains/production.env` au build. Des variables `VITE_*` peuvent les remplacer explicitement dans la CI. Changer une de ces valeurs impose une reconstruction.

| Application | Variable de build | État et valeur de production cible |
|---|---|---|
| Dashboard | `VITE_API_BASE_URL` | Implémentée ; `https://api.surplasse.com` dans le build de production |
| Commande | `VITE_API_BASE_URL` | Implémentée ; `https://api.surplasse.com` dans le build de production |
| Commande | `VITE_STRIPE_PUBLISHABLE_KEY` | Implémentée ; clé publique live injectée au build |
| Commande | `VITE_ESTABLISHMENT_SLUG` | Développement local seulement ; le sous-domaine fournit le slug en production |
| Onboarding | À confirmer avec le module React | Cible non implémentée |

Le fichier `config/domains/development.env` fait foi pour le développement et fournit `VITE_API_BASE_URL=https://api.surplasse.test` au build Vite. Les fichiers `.env.example` documentent les overrides propres à chaque frontend. Ces valeurs ne sont pas des secrets. Le Dashboard n'a aucune donnée ni aucun volume propre : ses données viennent du Backend avec les cookies hôte uniquement de l'API.

## Reproduire la topologie de production en local

La reproduction par domaines est maintenant l'environnement de développement canonique. dnsmasq fournit l'apex et le wildcard `surplasse.test`, mkcert fournit un certificat approuvé et `infra/local/Caddyfile` route chaque hostname vers le processus local. Le cockpit rend les URL et les états visibles.

La procédure complète, y compris macOS, Linux et WSL2, vit dans [Domaines locaux](../developpement/domaines-locaux.md). Elle n'ajoute aucune entrée par établissement à `/etc/hosts` et n'utilise pas `tls internal` : le certificat est généré explicitement par mkcert pour l'apex et le wildcard.

Cette topologie reste l'environnement local, pas un staging. Elle partage la forme des domaines et les noms de variables avec la production, mais pas son DNS, son autorité de certification, ses secrets, ses images ou son cycle de vie. `infra/local/` ne doit jamais être copié tel quel sur le VPS.
