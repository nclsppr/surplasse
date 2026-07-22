---
label: Observabilité
order: 30
icon: pulse
description: Healthchecks, métriques Micrometer, collecte Prometheus, tableau de bord Grafana, règles et exploitation non bloquante de Surplasse.
---

# Observabilité

Surplasse dispose d'une première chaîne de métriques reproductible : le Backend expose Micrometer, Prometheus collecte les séries et Grafana provisionne leur visualisation. L'[ADR-0029](../decisions/adr-0029-observabilite-prometheus-grafana.md) fixe sa séparation avec le chemin applicatif.

!!! info État réel au 2026-07-22
Le code, les configurations, les règles et le tableau de bord sont livrés dans le dépôt et peuvent être exercés avec le profil Compose facultatif `observability`. Aucun VPS de production n'est encore provisionné. Les règles Prometheus sont évaluées localement, mais elles n'envoient aucune notification car Alertmanager n'est pas installé. La sonde externe et son canal d'alerte restent une porte du premier déploiement.
!!!

## Principe non bloquant

Prometheus fonctionne en collecte pull. Le Backend met à jour un registre Micrometer en mémoire et répond à `/q/metrics`. Il ne connaît ni l'adresse, ni l'état, ni les identifiants de Prometheus ou de Grafana. Aucun thread métier n'envoie de métrique sur le réseau.

```text
Internet
   |
   v
+-------+       routes applicatives       +-------------------+
| Caddy | ------------------------------> | Backend Quarkus   |
+---+---+                                 | /q/health         |
    |                                     | /q/metrics interne|
    | refuse /q/metrics public            +---------+---------+
    |                                               ^
    |                                               | scrape pull
    |                                     +---------+---------+
    |                                     | Prometheus        |
    |                                     +---------+---------+
    |                                               ^
    |                                               | requêtes PromQL
    |                                     +---------+---------+
    +-- Grafana local seulement --------> | Grafana           |
                                          +-------------------+
```

Cette séparation est vérifiable dans la topologie :

- `backend`, `edge` et `postgresql` n'ont aucune dépendance Compose vers `prometheus` ou `grafana` ;
- la readiness du Backend vérifie PostgreSQL, jamais la supervision ;
- Prometheus et Grafana appartiennent au profil facultatif `observability` et peuvent rester arrêtés ;
- une erreur de mise à jour d'un compteur est journalisée puis ignorée par l'instrumentation ;
- l'arrêt des services de supervision fait perdre la collecte et l'affichage pendant l'incident, pas les commandes ni les paiements.

Pour le prouver en local, garder une requête applicative ouverte ou contrôler la readiness, arrêter les deux services, puis recommencer le contrôle :

```bash
scripts/compose.sh development stop prometheus grafana
curl --fail https://api.surplasse.test/q/health/ready
```

## Services et exposition

| Composant | Version | Rôle | Exposition |
|---|---:|---|---|
| Registre Micrometer Prometheus | fourni par Quarkus 3.25.4 | Produit les métriques automatiques et métier dans le processus Backend | `/q/metrics` sur le réseau Compose, refusé par Caddy depuis le domaine API |
| Prometheus | 3.13.1, variante `busybox` | Collecte, conserve et évalue les règles | Réseau Compose seulement, aucune route Caddy ni port hôte |
| Grafana | 13.1.1 | Affiche le tableau de bord provisionné | `GRAFANA_URL` derrière Caddy en développement ; port loopback et tunnel SSH en production |

Le catalogue `config/deployment/images.env` épingle les deux images par tag et digest. Prometheus utilise `prometheus_data`, Grafana `grafana_data`. La rétention Prometheus est de 7 jours en développement et de 15 jours dans l'exemple de production. Ces volumes sont persistants mais reconstructibles : les configurations, règles, sources et tableaux de bord canoniques vivent dans `infra/observability/`. PostgreSQL reste l'unique sauvegarde métier obligatoire.

## Healthchecks

Le Backend expose les endpoints standards de Quarkus :

| Endpoint | Question | Usage |
|---|---|---|
| `/q/health/live` | La JVM répond-elle ? | Diagnostic de vivacité |
| `/q/health/ready` | Le Backend et sa dépendance PostgreSQL sont-ils prêts ? | Healthcheck Compose et porte de déploiement |
| `/q/health` | Quel est l'état agrégé ? | Sonde externe future |

Prometheus expose `/-/healthy` et `/-/ready` sur son réseau interne. Grafana expose `/api/health`. Leurs healthchecks servent à `up --wait` lorsqu'ils sont démarrés explicitement. Ils ne remontent jamais dans la santé du Backend.

Quatre contrôles restent complémentaires :

| Contrôle | Ce qu'il prouve | Limite |
|---|---|---|
| Healthcheck Compose | Le conteneur et sa dépendance immédiate répondent | Reste interne au VPS |
| Prometheus | La cible est collectable et ses séries évoluent | Tombe avec le VPS s'il est hébergé dessus |
| Playwright horaire | Caddy, TLS, JavaScript et écrans publics fonctionnent depuis l'extérieur | Une planification GitHub peut être retardée |
| Sonde externe future | Le service et son certificat répondent indépendamment du VPS | Outil et canal encore à sélectionner |

## Métriques automatiques

Le registre Quarkus et Prometheus fournissent les métriques techniques utilisées par le tableau de bord :

| Nom Prometheus | Type | Unité | Labels utiles | Panneau |
|---|---|---|---|---|
| `up` | Jauge 0 ou 1 | booléen | `job`, `instance` | Disponibilité du Backend, disponibilité de Prometheus |
| `http_server_requests_seconds_count` | Compteur | requêtes | `method`, `outcome`, `status`, `uri` normalisée | Ratio d'erreurs 5xx, requêtes HTTP par statut, durée moyenne |
| `http_server_requests_seconds_sum` | Compteur | secondes cumulées | `method`, `outcome`, `status`, `uri` normalisée | Durée moyenne des requêtes HTTP |
| `jvm_memory_used_bytes` | Jauge | octets | `area`, `id` | Pression mémoire du tas JVM |
| `jvm_memory_max_bytes` | Jauge | octets | `area`, `id` | Pression mémoire du tas JVM |
| `process_cpu_usage` | Jauge de 0 à 1 | ratio | aucune avant les labels de cible Prometheus | CPU du processus Backend |
| `jvm_threads_live_threads` | Jauge | threads | aucune avant les labels de cible Prometheus | Threads JVM |
| `agroal_active_count` | Jauge | connexions | `datasource` | Connexions du pool JDBC |
| `agroal_awaiting_count` | Jauge | demandes en attente | `datasource` | Connexions du pool JDBC |
| `scrape_duration_seconds` | Jauge | secondes | `job`, `instance` | Durée de collecte Prometheus |
| `scrape_samples_scraped` | Jauge | échantillons par scrape | `job`, `instance` | Échantillons collectés par cible |

Les routes HTTP doivent rester normalisées par le binder. Un chemin contenant un identifiant de commande ou d'établissement ne devient jamais une série distincte. Une nouvelle métrique automatique n'est ajoutée au tableau de bord qu'après contrôle de sa cardinalité.

## Métriques métier livrées

Les noms ci-dessous sont le contrat opérationnel initial. Les compteurs Prometheus portent le suffixe `_total`. Ils sont remis à zéro avec le processus, donc les graphiques utilisent `rate()` ou `increase()` et non la valeur brute comme vérité comptable.

| Nom Micrometer | Nom Prometheus | Type, unité et labels | Point d'instrumentation | Panneau et lecture |
|---|---|---|---|---|
| `surplasse.orders.created` | `surplasse_orders_created_total` | Compteur d'événements, aucun label | `OrderCreated`, après commit d'une nouvelle commande | Commandes créées : arrêt ou chute du flux |
| `surplasse.payment.sessions.opened` | `surplasse_payment_sessions_opened_total` | Compteur d'événements, aucun label | `PaymentSessionOpened`, après commit d'une session activée chez le fournisseur | Sessions de paiement : progression des commandes vers le paiement |
| `surplasse.payment.intent.events` | `surplasse_payment_intent_events_total` | Compteur d'événements, `outcome="succeeded|failed"` | `OrderPaid` ou `PaymentFailed`, après rapprochement et commit du webhook signé | Paiements par résultat : succès confirmés et échecs |
| `surplasse.refunds` | `surplasse_refunds_total` | Compteur d'événements, `outcome="succeeded|failed"` | `PaymentRefunded` ou `PaymentRefundFailed`, après commit de l'état terminal | Remboursements par résultat : réussite ou incident |
| `surplasse.magic.link.deliveries` | `surplasse_magic_link_deliveries_total` | Compteur d'événements, `outcome="accepted|failed"` | `MagicLinkDeliveryCompleted`, lorsque le mailer accepte ou refuse la remise | Magic links par résultat : panne ou configuration SMTP invalide |
| `surplasse.sse.connections.active` | `surplasse_sse_connections_active` | Jauge de connexions, `channel="order|establishment"` | `SseConnectionChanged`, à l'abonnement et à la terminaison du flux autorisé | Connexions SSE : perte du suivi client ou restaurant |

Les événements transactionnels sont observés en `TransactionPhase.AFTER_SUCCESS`. Une transaction annulée ne gonfle donc pas les compteurs de commande, session de paiement, paiement ou remboursement. La remise SMTP et le cycle d'une connexion SSE ne sont pas des transactions métier : leur résultat est mesuré au moment où le mailer ou le flux le connaît.

### Politique de labels

Seuls les ensembles fermés et très courts sont acceptés comme labels. Aujourd'hui, il s'agit de `outcome` et `channel` avec les valeurs listées ci-dessus.

Sont interdits dans les labels et descriptions :

- identifiant ou slug d'établissement ;
- identifiant de commande, de paiement, de session, de restaurateur ou d'événement Stripe ;
- email, IP, URL libre ou user agent ;
- classe ou message d'exception libre ;
- montant, produit ou texte saisi par un utilisateur.

Cette règle protège à la fois la mémoire de Prometheus, la confidentialité et la possibilité d'agréger les séries. Un besoin exact par établissement appartient aux métriques produit sur PostgreSQL.

## Tableau de bord versionné

Grafana provisionne le dossier `Surplasse` et le tableau de bord `Vue opérationnelle`. Ses 18 panneaux sont listés ci-dessous. Le JSON versionné est la source de vérité. Une modification faite seulement dans l'interface est jetable et sera remplacée lors d'une recréation. La vue initiale couvre les 6 dernières heures et se rafraîchit toutes les 30 secondes.

| Panneau | Donnée affichée | Question posée |
|---|---|---|
| Disponibilité du Backend | `up` de la cible `surplasse-backend` | Prometheus collecte-t-il encore le Backend ? |
| Commandes créées sur 1 h | Somme de `increase(surplasse_orders_created_total[1h])` | Des commandes entrent-elles encore ? |
| Paiements confirmés sur 1 h | Augmentation des événements `succeeded` | Les paiements aboutissent-ils ? |
| Ratio d'erreurs 5xx sur 5 min | Pourcentage des requêtes serveur répondant en 5xx | Le trafic applicatif se dégrade-t-il ? |
| Requêtes HTTP par statut | Débit par code HTTP | Quelle famille de réponses évolue ? |
| Durée moyenne des requêtes HTTP | Durée cumulée divisée par le nombre de requêtes, en millisecondes | La réponse moyenne ralentit-elle ? |
| Commandes et sessions de paiement | Débits comparés des créations et ouvertures de session | Le parcours se bloque-t-il avant Stripe ? |
| Résultats des paiements | Débit par `outcome` | Les succès ou échecs de paiement augmentent-ils ? |
| Résultats des remboursements | Débit par `outcome` | Les remboursements aboutissent-ils ? |
| Livraisons de magic links | Débit par `outcome` | Le Backend remet-il les emails au SMTP ? |
| Connexions SSE actives | Jauge par `channel` | Les suivis client et restaurant restent-ils connectés ? |
| Durée de collecte Prometheus | `scrape_duration_seconds` du Backend | La collecte devient-elle lente ? |
| Pression mémoire du tas JVM | Mémoire heap utilisée divisée par son maximum | La JVM approche-t-elle de sa limite mémoire ? |
| CPU du processus Backend | `process_cpu_usage` en pourcentage | Le processus sature-t-il le CPU ? |
| Threads JVM | `jvm_threads_live_threads` | Le nombre de threads dérive-t-il ? |
| Connexions du pool JDBC | `agroal_active_count` et `agroal_awaiting_count` | Le pool PostgreSQL est-il actif ou en attente ? |
| Disponibilité de Prometheus | `up` de la cible `prometheus` | Le collecteur observe-t-il encore sa propre cible ? |
| Échantillons collectés par cible | Somme de `scrape_samples_scraped` par `job` | Une cible cesse-t-elle soudain d'exposer ses séries attendues ? |

La latence initiale est une moyenne calculée à partir de la durée cumulée et du nombre de requêtes. Elle n'est pas un p95. Les histogrammes ciblés sur la carte, Stripe et les webhooks seront ajoutés avant d'afficher des percentiles fiables.

Le tableau de bord sert à l'exploitation de la plateforme. Le Dashboard restaurateur n'y accède pas et ne consomme pas Prometheus.

## Règles Prometheus

Prometheus évalue cinq règles versionnées. Leur état est disponible dans Prometheus et sous forme de séries `ALERTS` interrogeables depuis Grafana. Le tableau de bord initial ne possède pas encore de panneau dédié aux règles :

| Règle | Condition et durée | Sévérité | Première vérification |
|---|---|---|---|
| `SurplasseBackendMetricsUnavailable` | Cible Backend à `0` pendant 5 minutes | `critical` | Distinguer une panne Backend d'un problème de réseau ou de collecte |
| `SurplasseBackendHighServerErrorRatio` | Plus de 5 % de 5xx sur la fenêtre de 5 minutes, pendant 10 minutes | `warning` | Panneaux HTTP, healthcheck, logs Backend et pool JDBC |
| `SurplasseMagicLinkDeliveryFailure` | Au moins un résultat `failed` en 10 minutes, maintenu 1 minute | `warning` | Logs mailer et état du fournisseur SMTP |
| `SurplassePaymentFailure` | Au moins un paiement rapproché `failed` en 10 minutes, maintenu 1 minute | `warning` | Panneau de résultats, événement Stripe et logs corrélés |
| `SurplasseRefundFailure` | Au moins un remboursement `failed` en 10 minutes, maintenu 1 minute | `warning` | Panneau de résultats, état Stripe et tentative persistée |

!!! warning Pas encore de notification
Prometheus évalue les règles, mais aucun Alertmanager n'est configuré. Une règle dans l'état `firing` ne prévient personne. Avant le pilote, une sonde externe et un canal de notification doivent compléter cette chaîne. Ne jamais présenter les règles actuelles comme une astreinte ou une alerte livrée.
!!!

Les seuils initiaux sont des garde-fous à calibrer avec du trafic réel. Un échec de paiement peut être un refus bancaire normal : la règle demande une inspection, pas une conclusion automatique. Toute modification de seuil ou de fenêtre passe par le fichier de règles versionné, puis par sa validation et un redémarrage ou rechargement contrôlé de Prometheus.

## Logs et données personnelles

Au premier déploiement, les logs restent consultés par `scripts/compose.sh <profil> logs`. Le Backend émet du JSON structuré en production et du texte lisible en développement. Loki n'est pas installé.

!!! warning Aucune donnée personnelle dans les logs ou métriques
Ne jamais journaliser ni étiqueter une adresse email, un prénom, un jeton, une charge utile de webhook ou une donnée de carte. Les logs peuvent porter des identifiants techniques opaques pour un diagnostic court. Les métriques restent agrégées et sans identifiant. La rétention des logs est plafonnée à 30 jours selon la page [RGPD](rgpd.md).
!!!

## Accès local et production

En développement, le profil de domaines dérive `GRAFANA_URL`. Caddy route uniquement cet hôte vers Grafana. La lecture anonyme locale est limitée au rôle `Viewer` et le compte administrateur jetable vient du profil de déploiement versionné. Le cockpit affiche le service et son lien lorsqu'il est disponible. Prometheus reste interne et se consulte par ses fichiers, ses logs ou une commande dans le conteneur, pas par une URL navigateur alternative.

En production, Grafana n'a aucun nom DNS ni route Caddy. Son port est publié sur `127.0.0.1` du VPS uniquement. Depuis un poste d'exploitation :

```bash
ssh -N -L 3000:127.0.0.1:3000 <utilisateur>@<vps>
```

Le navigateur ouvre alors l'extrémité locale du tunnel. Ce loopback est un accès d'administration privé, pas une URL applicative ni une valeur à introduire dans un profil de domaines. L'accès anonyme est désactivé et les identifiants Grafana de production viennent du fichier protégé du VPS.

Le détail des commandes de démarrage, arrêt, mise à jour et recréation des volumes vit dans [Déploiement Compose](deploiement-compose.md#observabilite-facultative).

## Métriques d'exploitation et métriques produit

Les deux familles ne se confondent jamais :

| | Observabilité technique | Métriques produit du Dashboard |
|---|---|---|
| Source | Registre Micrometer collecté par Prometheus | Données de domaine dans PostgreSQL |
| Exactitude | Séries agrégées, remises à zéro au redémarrage et soumises au scrape | Valeurs exactes, rapprochables avec les commandes et paiements |
| Cardinalité | Globale, labels bornés uniquement | Filtrage obligatoire par établissement |
| Audience | Opérateur de Surplasse | Restaurateur autorisé |
| Usage | Détection et diagnostic | Pilotage de l'activité et comptabilité |

Grafana utilise seulement Prometheus dans cette première version. Une source PostgreSQL directe n'est pas ajoutée. Les futurs volumes exacts par établissement passent par le contrat et des endpoints du domaine concerné, jamais par `/q/metrics`.

## SLI de départ

Ces objectifs restent internes et seront recalibrés avec les premières données :

| SLI | Mesure | Objectif initial |
|---|---|---|
| Disponibilité de l'API de commande | Part des requêtes sans erreur 5xx sur 30 jours | 99,5 % |
| Latence de lecture de la carte | p95 futur d'un histogramme ciblé | Inférieure à 300 ms |
| Fraîcheur SSE | Délai futur du commit à l'émission et battement de coeur | Moins de 2 secondes, battement au moins toutes les 60 secondes |

Le tableau de bord actuel ne prétend pas encore mesurer les deux derniers SLI avec leur précision cible. Il fournit la latence HTTP moyenne et la jauge des connexions, utiles pour démarrer sans inventer un percentile ou une fraîcheur non instrumentés.

## Évolutions planifiées

| Besoin | Évolution, seulement quand le besoin est confirmé |
|---|---|
| Temps fournisseur | Timers ciblés pour Stripe, les webhooks et le SMTP |
| Carte et IA | Histogrammes de lecture de carte, jobs d'extraction, latence et échecs OpenAI après livraison du domaine `generation` |
| Percentiles | Histogrammes bornés et p95 sur les parcours critiques |
| Machine | Exporteur hôte pour CPU, mémoire, disque, inode et pression I/O |
| Notifications | Alertmanager ou service d'alerte externe, avec canal réellement testé |
| Journaux | Loki si la recherche historique justifie son coût |
| Traces | OpenTelemetry et Tempo si un diagnostic distribué devient nécessaire |
| Analyse par établissement | Endpoints produit exacts sur PostgreSQL, autorisés par établissement |

Uptime Kuma, Alertmanager, Loki, Tempo et un exporteur hôte ne sont pas installés aujourd'hui. Toute page ou checklist doit conserver cette distinction.

## Pour aller plus loin

| Page | Contenu |
|---|---|
| [ADR-0029](../decisions/adr-0029-observabilite-prometheus-grafana.md) | Raisons et conséquences de la chaîne facultative |
| [Déploiement Compose](deploiement-compose.md#observabilite-facultative) | Exploitation sous Ubuntu LTS et cycle de vie des volumes |
| [Environnements](environnements.md#observabilite) | Variables, accès local et tunnel de production |
| [Backend](../architecture/backend.md#les-extensions-quarkus) | Extension Micrometer et place de l'observateur applicatif |
| [Sécurité](../architecture/securite.md) | Fermeture publique de `/q/metrics` et accès privé à Grafana |
| [RGPD](rgpd.md) | Données autorisées, rétention et interdits |
