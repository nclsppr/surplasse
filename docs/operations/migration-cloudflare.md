---
label: Migration Cloudflare
order: 12
icon: cloud
description: Architecture hybride, coûts, candidat Worker, portes de bascule, sondes et retour arrière du bord Cloudflare.
---

# Migration du bord vers Cloudflare

Ce runbook prépare la migration décrite par l'[ADR-0048](../decisions/adr-0048-bord-cloudflare-hybride.md). Il ne transforme pas un build vert en production et ne déplace aucune donnée. Cloudflare doit servir le bord et les statiques. Atlas reste la source de vérité du Backend Quarkus, de PostgreSQL, des migrations, des secrets et des sauvegardes.

## État exact de cette préparation

Au 2026-08-25, le dépôt contient un candidat exécutable et la première tranche statique a été activée en urgence à 23:15 CEST après un incident 525 :

- `deployment/cloudflare/` porte le Worker, sa configuration, ses types générés et ses tests dans le runtime Workers ;
- `npm run cloudflare:assets:build` assemble Onboarding, Commande, Dashboard et Nimbus dans un répertoire ignoré par Git ;
- le manifeste `deployment/cloudflare/dist/manifest.json` lie chaque fichier à son SHA-256 et au commit source ;
- `npm run cloudflare:check` reconstruit le bundle avec le profil de domaines production, refuse toute URL `.test`, exécute les tests et produit deux dry runs Wrangler sans contacter la production ;
- `.github/workflows/cloudflare.yml` publie seulement un artefact CI conservé sept jours, jamais une version Cloudflare ;
- `workers_dev` et les URL de prévisualisation sont désactivés dans les deux environnements Wrangler ; la configuration produit ne contient volontairement aucune Route ;
- le Worker `surplasse-edge` est uploadé, avec la version active `704d108f-f873-4236-98fc-f605ae409400` ;
- les seules Routes actives sont `surplasse.com/*` et `www.surplasse.com/*` ; elles ont été attachées par Wrangler depuis la session OAuth opérateur déjà présente ;
- aucun nouveau token, abonnement payant, Tunnel, bucket R2 ou enregistrement DNS n'a été créé pendant cette intervention ;
- `api`, `dashboard`, `docs` et le wildcard restent fermés.

Les sondes publiques refaites le 2026-08-25 à 23:15 CEST montrent un Onboarding statique exploitable et une production dynamique toujours fermée :

| Vérification | Observation datée |
|---|---|
| Serveurs de noms | `armfazh.ns.cloudflare.com` et `uma.ns.cloudflare.com` |
| Apex | enregistrement proxifié Cloudflare présent |
| `www.surplasse.com` | enregistrement proxifié présent |
| `dashboard`, `docs`, `api` et un slug de sonde | aucun enregistrement A résolu |
| `http://surplasse.com` | HTTP 308 vers HTTPS, en IPv4 et IPv6 |
| `https://surplasse.com` | HTTP 200 depuis Workers Static Assets, en IPv4 et IPv6 |
| `https://www.surplasse.com/test?x=1` | HTTP 308 vers l'apex en conservant chemin et query |
| `/.well-known/surplasse-edge` | HTTP 200 et `X-Surplasse-Edge: cloudflare` |
| `/.well-known/surplasse-manifest.json` | HTTP 200, sans cache, commit `3024278c068823343d04d776318791ddc36057c1` |
| `/stripe-connect/config` | HTTP 503 intentionnel |
| chemin Onboarding inconnu | HTTP 404 |
| IP Atlas avec SNI `surplasse.com` | négociation TLS en échec |

Cette photographie doit être refaite avant toute nouvelle mutation. La Route statique corrige l'indisponibilité publique sans rendre sain le retour Atlas et sans ouvrir le Backend, Stripe, Dashboard, Nimbus ou un mini-site.

## Architecture cible KISS

```text
Navigateurs et Stripe
         |
         v
Cloudflare DNS, TLS et règles de sécurité
         |
         v
Worker unique sur l'apex et le wildcard
         |
         +--> Workers Static Assets
         |      Onboarding
         |      Commande
         |      Dashboard
         |      Nimbus
         |
         +--> api.surplasse.com, requête inchangée
                    |
                    v
             Cloudflare Tunnel
                    |
                    v
             Caddy puis Quarkus
                    |
                    v
              PostgreSQL 17
```

Le Worker ne contient aucune règle métier. Il force HTTPS, classe le nom d'hôte, protège les chemins techniques, sert les assets ou transmet la requête à l'origine. `fetch(request)` conserve le corps Stripe et la réponse originelle, donc le SSE n'est ni lu ni mis en tampon. La configuration conserve explicitement `global_fetch_private_origin` afin qu'un appel vers la zone atteigne l'origine au lieu de reboucler sur la Route Worker. Ce sous-appel ignore aussi les autres Workers et les règles de sécurité ou de cache de la zone. Le bord doit donc appliquer toute la politique publique une seule fois, avant le relais, et l'origine ne doit jamais compter sur un second passage WAF.

Le bundle statique possède quatre préfixes internes :

```text
/onboarding/
/commande/
/dashboard/
/docs/
```

Ils ne sont jamais exposés comme routes produit. Les URL publiques restent celles de `config/domains/production.env`.

## Pourquoi le Backend ne migre pas maintenant

Le Backend utilise des transactions PostgreSQL, des verrous pessimistes, `pg_advisory_xact_lock`, des webhooks Stripe dédupliqués, des cookies rotatifs, Flyway et un replay SSE persistant. Passer à Workers et D1 demanderait de redéfinir la concurrence, les transactions, les migrations, JPA et le temps réel. Ce serait une réécriture fonctionnelle, pas une migration d'hébergement.

Workers Containers ne retire pas cette difficulté : Quarkus aurait toujours besoin d'un PostgreSQL externe, de migrations séparées, d'une stratégie de démarrage et d'une exploitation supplémentaire. Hyperdrive accélère les connexions PostgreSQL ouvertes par un Worker, mais ne devient pas un endpoint JDBC transparent pour Quarkus.

## Coût mensuel attendu

Tarifs consultés le 2026-08-25, en USD hors taxes. La cible garde la zone sur le plan Application Services Free. Aucun plan Pro n'est requis. Le [plan Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/) coûte 5 USD par compte et inclut 10 millions de requêtes et 30 millions de millisecondes CPU. Le plan Workers Free pourrait suffire à un essai fermé avec 100 000 requêtes par jour et 10 ms CPU par invocation, mais son plafond journalier dur est un mauvais garde-fou pour une production testeurs. Paid est donc la base prudente à l'activation.

Les requêtes de fichiers sont gratuites quand elles évitent le Worker, mais le routage Surplasse par hôte impose `run_worker_first` et compte chaque invocation. [R2 Standard](https://developers.cloudflare.com/r2/pricing/) inclut mensuellement 10 Go-mois, 1 million d'opérations de classe A et 10 millions de classe B. [Cloudflare Images](https://developers.cloudflare.com/images/pricing/) inclut 5 000 transformations uniques par mois ; le dépassement demande Images Paid et coûte 0,50 USD par millier. [Turnstile](https://developers.cloudflare.com/turnstile/plans/) est gratuit dans les limites du plan. Le coeur d'[AI Gateway](https://developers.cloudflare.com/ai-gateway/reference/pricing/) est gratuit, mais OpenAI reste facturé.

| Scénario indicatif | Hypothèses Cloudflare | Coeur Cloudflare |
|---|---|---:|
| MVP fermé | 250 000 requêtes, aucune donnée R2, aucun média dynamique | 5,00 USD |
| Pilote | 3 millions de requêtes, 100 Go-mois R2 Standard, opérations sous les quotas gratuits, 6 000 transformations uniques dans le mois avec Images Paid | 6,85 USD |
| Traction | 30 millions de requêtes à 6 ms CPU moyen, 1 000 Go-mois R2 Standard, 5 millions d'opérations A, 50 millions d'opérations B, 60 000 transformations uniques | environ 88,75 USD |

Le pilote vaut `5 + (100 - 10) x 0,015 + (6 000 - 5 000) / 1 000 x 0,50`, soit 6,85 USD. Le scénario traction additionne 14,00 USD Workers, 14,85 USD de stockage R2, 18,00 USD d'opérations A, 14,40 USD d'opérations B et 27,50 USD Images. Les 6 ms représentent du CPU Worker moyen, pas l'attente réseau de l'origine ou du SSE. Les opérations R2 sont arrondies selon les unités de facturation.

Workers Logs et Traces sont désactivés dans le candidat, car certaines URL de suivi contiennent encore un jeton et un identifiant de commande. S'ils sont activés après correction de ce contrat, leur [enveloppe de 20 millions d'événements](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) par compte et par mois, puis leurs dépassements, devront rejoindre le modèle.

Ces nombres supposent que le compte n'a pas encore Workers Paid et que ses quotas ne sont consommés par aucun autre Worker. Si le compte est déjà Paid avec assez de marge, l'abonnement marginal Surplasse peut être nul ; les quotas et dépassements restent partagés au niveau du compte. Ils ne comprennent ni Stripe, ni OpenAI, ni le fournisseur SMTP, ni les taxes. Ce sont des modèles de compteurs, pas une prévision commerciale.

Le catalogue [OVHcloud VPS](https://www.ovhcloud.com/fr/vps/) affiche le VPS-3 2027 comparable à 10,40 EUR hors taxes par mois. La facture réelle Atlas et son offre exacte n'ont pas été consultées, et aucune conversion EUR vers USD n'est pertinente sans taux daté. Atlas héberge plusieurs produits : retirer les statiques Surplasse ne baisse probablement pas sa facture. La migration ajoute donc 5 USD mensuels si elle déclenche le premier abonnement Workers Paid, 0 USD d'abonnement si le compte le paie déjà et dispose de marge, puis les seuls dépassements réels. Elle ne remplace pas le VPS tant que Quarkus et PostgreSQL restent sur Atlas.

## Installation sur macOS, WSL2 et Linux

Le Worker est un outil Node de build et un service Cloudflare, sans donnée locale, volume ou processus hôte permanent. Node 24 vient du verrou `mise`. Windows utilise Ubuntu sous WSL2. Les mêmes commandes s'appliquent sur macOS, Ubuntu et WSL2 depuis la racine du dépôt :

```bash
mise trust
mise install --locked
npm ci
npm ci --prefix docs-nimbus
npm ci --prefix frontends/shared
npm ci --prefix frontends/commande
npm ci --prefix frontends/dashboard
npm ci --prefix deployment/cloudflare
npm run cloudflare:check
```

Le Worker utilise Wrangler 4.125.0, Vitest 4.1.11 et le plugin Workers Vitest 1.0.0, tous verrouillés dans `deployment/cloudflare/package-lock.json`. Il n'est pas installé sur Ubuntu Atlas. Cloudflare exécute le service et les quatre sorties statiques sont reconstructibles depuis Git.

Pour une vérification locale interactive :

```bash
npm run cloudflare:assets:build
npm run cloudflare:dev
```

Dans un second terminal, résoudre chaque nom vers le port HTTPS local de Wrangler. Son certificat éphémère n'est pas approuvé par le poste, donc `--insecure` est limité à cette sonde locale. Modifier seulement l'en-tête `Host` provoque une requête incohérente dans le runtime local et n'est pas une sonde valide :

```bash
curl --insecure --resolve surplasse.com:8787:127.0.0.1 https://surplasse.com:8787/
curl --insecure --resolve dashboard.surplasse.com:8787:127.0.0.1 https://dashboard.surplasse.com:8787/
curl --insecure --resolve docs.surplasse.com:8787:127.0.0.1 https://docs.surplasse.com:8787/
curl --insecure --resolve bistrot-test.surplasse.com:8787:127.0.0.1 https://bistrot-test.surplasse.com:8787/
curl --insecure --resolve reports.surplasse.com:8787:127.0.0.1 https://reports.surplasse.com:8787/
curl --insecure --resolve api.surplasse.com:8787:127.0.0.1 https://api.surplasse.com:8787/q/health
```

Arrêter Wrangler avec `Ctrl+C`. Aucun état n'est à sauvegarder ou restaurer localement. Le dossier `deployment/cloudflare/dist/` peut être supprimé puis reconstruit par la commande de build.

## Secrets et autorité d'activation

La production testeurs Cloudflare demande à terme un compte Workers Paid, un identifiant de compte et un token API borné au Worker et à la zone. Leur création est une intégration persistante et exige une approbation opérateur explicite. Aucune valeur ne doit être copiée dans une discussion, un fichier suivi, un argument de commande ou un log CI.

La remise en ligne du 2026-08-25 a réutilisé la session OAuth Wrangler déjà chiffrée dans le trousseau macOS. Aucune valeur n'a été affichée ou copiée, aucun token durable n'a été installé dans GitHub ou `vps-infra` et aucun changement de plan payant n'a été exécuté. Cette session locale n'est pas le canal d'exploitation cible.

Le token, s'il est autorisé, est capturé directement dans le gestionnaire de secrets retenu puis installé dans l'environnement GitHub protégé ou dans le canal opérateur de `vps-infra`. Le dépôt Surplasse ne doit connaître que les noms `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`. La clé publique Stripe reste la variable GitHub existante `VITE_STRIPE_PUBLISHABLE_KEY`. Les clés Stripe secrètes, JWT, SMTP et PostgreSQL restent sur Atlas.

`vps-infra` possède les enregistrements DNS, les Routes Worker, Tunnel et l'état désiré de production. Une future automatisation de déploiement doit promouvoir le digest ou l'identifiant exact du candidat produit, jamais reconstruire les assets dans le plan de contrôle.

## Phase 0 : figer le contrat et réparer le retour arrière

Avant le premier upload Cloudflare :

1. Capturer les enregistrements DNS, les Routes Worker éventuelles, les certificats, la réponse de chaque hôte et la release Atlas courante.
2. Corriger la négociation TLS de l'origine Atlas et prouver les routes Caddy existantes. Un retour arrière vers une origine 525 n'est pas un retour arrière.
3. Garder les quatre conteneurs statiques Atlas et leur release immuable pendant toute la période d'observation.
4. Vérifier que `api.surplasse.com` possède une origine proxifiée avant d'ajouter une Route. Une Route Worker exige un enregistrement DNS Cloudflare proxifié.
5. Exécuter `npm run cloudflare:check`, les smokes E2E existants et `npm run backend:verify` sur le même commit.
6. Prouver les CSP de Commande, Dashboard et Onboarding, la redirection HTTP vers HTTPS et l'en-tête `Cache-Control: no-store` du manifeste.

La phase est normalement refusée si le domaine de retour n'est pas sain, si un secret manque, si le mode Stripe n'est pas `testers` sur toute la chaîne ou si le manifeste statique ne porte pas le commit attendu. Lors de l'incident 525 du 2026-08-25, le retour Atlas était précisément la surface indisponible. L'opérateur a accepté l'exception minimale consistant à attacher seulement l'apex et `www` au Worker vérifié. La réparation TLS Atlas et l'import des Routes dans `vps-infra` deviennent des dettes bloquantes avant toute extension.

## Phase 1 : créer une version sans route publique

Après approbation du compte et du token, uploader une version candidate sans la promouvoir. Les URL `workers.dev` et les Preview URLs sont volontairement désactivées par configuration. Une prévisualisation publique éventuelle doit d'abord être protégée par Cloudflare Access et décidée séparément.

La commande d'upload est exécutée depuis `deployment/cloudflare/` avec les variables capturées silencieusement par le canal opérateur. Son identifiant de version, le SHA du commit et le SHA-256 du manifeste sont enregistrés comme preuve durable dans l'admission `vps-infra`. L'artefact GitHub de sept jours n'est pas ce contrat durable. Aucun DNS et aucune Route ne changent pendant cette phase.

Cette phase a été exécutée le 2026-08-25. La version inerte `2f93d17c-59b9-4de3-986f-b1a60e86c40a` n'avait aucun target. La promotion de l'apex et de `www` a ensuite créé la version `704d108f-f873-4236-98fc-f605ae409400`, liée au manifeste du commit `3024278c068823343d04d776318791ddc36057c1`.

## Phase 2 : préparer DNS et Tunnel

Le 2026-08-25, seuls l'apex et `www` résolvent. Avant toute nouvelle promotion :

- la preuve du DPA Cloudflare, des transferts, de la localisation et de la rétention doit être jointe au registre RGPD ; tant qu'elle manque, aucun trafic testeur ni aucune nouvelle Route ne sont autorisés ;
- l'apex, `www`, le wildcard, `dashboard` et `docs` doivent avoir un chemin de retour Atlas sain ou une origine de repli explicitement préparée ;
- `api.surplasse.com` doit pointer vers Caddy Atlas par un enregistrement spécifique, puis vers Cloudflare Tunnel après qualification ;
- le wildcard ne doit jamais envoyer `api`, `dashboard`, `docs` ou un nom réservé vers Commande à l'origine ;
- le port public Atlas ne ferme qu'après preuve du Tunnel, des webhooks Stripe et du SSE ;
- aucune règle Cache Everything ne couvre `api.surplasse.com` ; les réponses d'authentification, de paiement, de webhook et SSE ne sont jamais mises en cache.

Tunnel est créé dans `vps-infra`, avec un connecteur sortant Atlas et un secret hors Git. Sa configuration doit fixer et tester le Host attendu par Caddy avec `httpHostHeader`. Si l'origine reste en HTTPS, `originServerName` et `matchSNItoHost` sont aussi explicites. Le Host, le SNI et le schéma transmis ne sont jamais supposés par défaut.

Caddy doit accepter le proxy client seulement depuis le connecteur Tunnel, lire `CF-Connecting-IP` sur ce chemin de confiance et continuer à produire un `X-Forwarded-For` et un `X-Forwarded-Proto` cohérents pour Quarkus. Une requête directe ne doit jamais pouvoir forger ces valeurs. La qualification vérifie deux IP clientes distinctes, la limitation de débit des magic links, les journaux d'origine, les cookies `Secure`, le SSE et les webhooks Stripe. Sans cette configuration et ses tests dans `vps-infra`, Tunnel reste No-Go.

Avant la Route API réelle, un éventuel hôte canari distinct doit être explicitement autorisé, protégé par Cloudflare Access, absent du wildcard public et supprimé après la qualification. Sa création est une exposition externe séparée, pas une conséquence automatique de ce runbook.

## Phase 3 : promouvoir le bord

La configuration Wrangler du produit ne contient aucune Route. `vps-infra` attache la version admise par étapes, avec une sonde et un retour arrière entre chacune :

1. apex puis `www`, uniquement pour Onboarding et sa redirection ;
2. `dashboard`, `docs` et un slug testeur nommé, sans wildcard ;
3. `api` seulement après la qualification Tunnel, IP cliente, Stripe et SSE ;
4. wildcard seulement après les étapes précédentes, puis retrait des Routes explicites devenues redondantes.

Le 2026-08-25, seule l'étape 1 est active avec les Routes exactes `surplasse.com/*` et `www.surplasse.com/*`. Les étapes 2 à 4 ne sont pas commencées. L'attachement direct par la session Wrangler opérateur est une exception de remise en ligne, pas le nouveau plan de contrôle. `vps-infra` doit réconcilier cette version et ces deux Routes avant toute suite.

La topologie finale converge vers exactement deux Routes :

```text
surplasse.com/*
*.surplasse.com/*
```

Chaque attachement modifie la production et n'est jamais exécuté par le workflow candidat. La Route wildcard ne sert pas de première expérience distante. Immédiatement après chaque étape, vérifier seulement les hôtes devenus concernés. La matrice finale est :

```bash
curl --head http://surplasse.com/
curl --head http://www.surplasse.com/test?source=probe
curl --fail --silent --show-error https://surplasse.com/.well-known/surplasse-edge
curl --head https://surplasse.com/
curl --head https://www.surplasse.com/test?source=probe
curl --head https://dashboard.surplasse.com/
curl --head https://docs.surplasse.com/
curl --head https://probe.surplasse.com/
curl --head https://reports.surplasse.com/
curl --head https://api.surplasse.com/q/health
curl --fail --silent --show-error https://surplasse.com/.well-known/surplasse-manifest.json
```

Les deux sondes HTTP attendent 308 vers le nom canonique en HTTPS. Les sondes HTTPS attendent ensuite 200, 200, 308, 200, 200, 200, 503, 404 et 200 pour le manifeste. Vérifier aussi `X-Surplasse-Edge: cloudflare`, HSTS, `X-Content-Type-Options`, les CSP des trois applications, `Cache-Control: no-store` et le SHA courant du manifeste, les vues mobile et bureau, les routes SPA et une 404 Nimbus.

Avant toute activation dynamique, ajouter les preuves suivantes :

- webhooks Stripe signés, dupliqués et reçus hors ordre ;
- création concurrente de commande et de session de paiement ;
- course entre pause et admission ;
- cookies hôte uniquement et credentials CORS limités aux origines exactes ;
- flux SSE, heartbeat, déconnexion, `Last-Event-ID` et replay après redémarrage Quarkus ;
- absence de cache sur chaque route API sensible ;
- impossibilité de contourner Cloudflare une fois le port Atlas fermé.

## Retour arrière

Avant la promotion, enregistrer la version Worker précédente, les Routes et le snapshot DNS. En cas d'écart :

1. Revenir à la version Worker précédente si elle est saine, ou détacher les Routes ajoutées par la dernière étape depuis le plan de contrôle Cloudflare.
2. Restaurer les enregistrements DNS Atlas du snapshot si la préparation Tunnel les a changés.
3. Confirmer que les conteneurs statiques et Caddy de la release Atlas conservée répondent.
4. Rejouer la matrice publique et vérifier que l'API, Stripe et le SSE n'ont jamais changé de base ni de secret.
5. Conserver les logs et identifiants de versions avant toute correction.

Ne pas supprimer le Worker, le Tunnel ou une release Atlas pendant l'incident. Le retour arrière change le routage, pas les données. Une suppression durable intervient seulement après diagnostic et nouvelle décision.

Après le retrait futur des conteneurs statiques Atlas, le retour arrière normal devient une version Worker antérieure avec ses assets immuables. La dernière `application-release` Atlas contenant les quatre statiques, ses digests OCI et sa procédure de réadmission restent néanmoins conservés et testés tant qu'une reprise hors Cloudflare est exigée. Le retrait n'est pas autorisé si cette reconstruction n'a pas été exercée.

## Phase 4 : services Cloudflare optionnels

Ces ajouts ne bloquent pas le bord initial :

| Service | Porte avant adoption |
|---|---|
| R2 | domaine `generation` implémenté, bucket privé, validation et réencodage, cycle de vie, export et restauration prouvés |
| Cloudflare Images | variantes mesurées, originaux conservés dans R2, budget d'opérations fixé |
| Turnstile | formulaire dynamique exposé, validation serveur obligatoire, test d'accessibilité |
| AI Gateway | intégration OpenAI réelle, cache et logs de contenu désactivés, registre RGPD mis à jour |
| Email Service | sortie de bêta ou risque accepté, quota connu, SPF, DKIM et DMARC validés, délivrabilité des magic links prouvée |
| Queues et Workflows | outbox PostgreSQL durable, absence de double écriture et traitement idempotent prouvés |

D1, Durable Objects et Workers Containers restent hors périmètre. Leur adoption demanderait un nouvel ADR et une migration fonctionnelle distincte.

## Retrait des services statiques Atlas

Après une période d'observation définie, un exercice de retour arrière réussi et des sondes publiques stables, un commit séparé peut retirer les quatre conteneurs statiques de `deployment/vps/compose.yaml`, leurs images, leurs sondes et leurs publications OCI courantes. La dernière release statique de secours et ses digests restent conservés selon la politique de reprise ci-dessus. Le Backend, le migrateur, le bootstrap pilote, PostgreSQL et l'observabilité restent sur Atlas.

La sortie complète du VPS n'est autorisée qu'après migration et restauration prouvées du Backend et de PostgreSQL, qualification de Stripe et de l'email, puis absence durable de trafic vers l'origine. Cette étape n'appartient pas à la migration présente.
