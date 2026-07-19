---
label: Observabilité
order: 30
icon: pulse
description: Health checks, logs structurés, métriques Micrometer, alerting minimal et objectifs de niveau de service de la plateforme Surplasse.
---

# Observabilité

Cette page décrit comment Surplasse s'observe en production : ce qui est mesuré, où cela s'affiche, et qui est réveillé quand quelque chose casse. Elle complète la page [sécurité](../architecture/securite.md) (dont elle partage la philosophie de sobriété), la page [backend](../architecture/backend.md) (qui liste les extensions Quarkus concernées) et la page [RGPD](rgpd.md) (qui encadre ce que les logs et les métriques ont le droit de contenir).

!!! info Documentation de référence
Le Backend est exécutable localement et expose déjà ses endpoints de santé. Aucune infrastructure de production n'est déployée et Micrometer n'est pas encore installé. Cette page distingue ce qui existe de la cible du premier déploiement et des briques à poser plus tard.
!!!

## Le principe : observer d'abord ce qui coûte

L'observabilité de Surplasse ne commence pas par des graphiques de CPU. Elle commence par une question : qu'est-ce qui, en cas de panne silencieuse, fait perdre de l'argent ou des commandes sans que personne ne s'en aperçoive ?

Les réponses ordonnent tout le reste :

| Panne silencieuse | Conséquence | Ce qui doit la révéler |
|---|---|---|
| Le paiement échoue systématiquement | Zéro chiffre d'affaires, clients qui abandonnent au pire moment | Métrique d'échecs de paiement, alerte sur seuil |
| La carte ne se charge pas ou trop lentement | Le client scanne, attend, renonce : la commande n'existe jamais | Latence p95 de l'API carte, sonde de disponibilité |
| Le flux SSE est mort | Les commandes payées n'arrivent plus en salle : clients servis en retard ou pas du tout | Compteur de connexions SSE actives, fraîcheur des événements |
| Les jobs d'extraction échouent en boucle | Les embarquements se bloquent, les restaurateurs abandonnent le tunnel | Compteur de jobs d'extraction en échec |

La règle de priorisation qui en découle : une mesure qui protège une commande ou un paiement se pose au premier déploiement ; une mesure de confort (dashboards détaillés, traces distribuées) se pose quand un problème réel la réclame. L'empilement d'outils d'observation est un coût d'exploitation comme un autre, et la [posture générale du projet](../architecture/index.md) est la simplicité opérationnelle.

## Les health checks

Le Backend expose les endpoints de santé standards de Quarkus via l'extension `quarkus-smallrye-health` (voir [les extensions prévues](../architecture/backend.md#les-extensions-quarkus-prévues)) :

| Endpoint | Question posée | Répond « UP » quand |
|---|---|---|
| `/q/health/live` | Le processus est-il vivant ? | La JVM répond. Un « DOWN » ou une absence de réponse signifie qu'un redémarrage est la bonne réaction. |
| `/q/health/ready` | Le service peut-il traiter du trafic ? | La connexion PostgreSQL est vérifiée et les migrations Flyway sont passées. Un « DOWN » signifie : ne pas envoyer de trafic, mais ne pas redémarrer non plus. |
| `/q/health` | Agrégat des deux | Tous les checks individuels sont « UP ». |

Deux consommateurs sondent ces endpoints :

- **Le superviseur** : le `healthcheck` Docker Compose interroge `/q/health/live` à intervalle court et redémarre le conteneur après plusieurs échecs consécutifs. C'est la première ligne de défense, elle fonctionne sans aucun outil supplémentaire.
- **Le déploiement** : le workflow de déploiement (voir [environnements](environnements.md)) attend que `/q/health/ready` réponde « UP » sur la nouvelle version avant de la considérer comme déployée. Un déploiement dont la readiness ne monte jamais est un déploiement échoué, pas un déploiement lent.

```
                    ┌──────────────────────┐
                    │   Backend Quarkus    │
                    │                      │
   Docker Compose ──►  /q/health/live      │   échec répété = redémarrage
                    │                      │
   Déploiement ─────►  /q/health/ready     │   pas de UP = déploiement échoué
                    │                      │
   Uptime Kuma ─────►  /q/health           │   DOWN = alerte email / mobile
                    └──────────────────────┘
```

La distinction liveness / readiness n'est pas un raffinement gratuit : sans elle, un incident PostgreSQL transitoire provoquerait des redémarrages en boucle du Backend, qui n'y peut rien et ne ferait qu'aggraver la situation.

## Les logs

### Structurés en JSON en production

En production, le Backend émet ses logs en JSON structuré (une ligne par événement, horodatage, niveau, logger, message, identifiants de corrélation). Le JSON n'est pas un choix esthétique : il rend chaque champ filtrable le jour où un agrégateur est posé, sans reformatage rétroactif. En développement, les logs restent au format texte lisible de Quarkus.

Chaque requête HTTP porte un identifiant de corrélation, propagé dans tous les logs qu'elle déclenche : retrouver l'histoire complète d'une requête en erreur se fait par un seul filtre.

### Consultation : simple d'abord

Au premier déploiement, la consultation des logs passe par `docker logs` (et `docker compose logs -f`) sur le VPS. C'est volontairement rudimentaire, et suffisant tant que le trafic est faible et l'équipe réduite.

Un agrégateur léger sera posé quand le besoin réel apparaîtra (chercher dans l'historique, croiser plusieurs services, suivre les logs sans SSH). Deux candidats, à comparer le moment venu : Dozzle est une simple interface web temps réel sur les logs Docker, sans stockage ni recherche historique, posée en cinq minutes. Loki (avec Grafana) indexe et conserve les logs avec un vrai langage de requête, au prix d'une brique d'exploitation supplémentaire à héberger et à maintenir.

Le choix sera consigné dans un ADR le moment venu ; d'ici là, `docker logs` fait le travail.

### Aucune donnée personnelle dans les logs

!!! warning Règle absolue de non-journalisation
Aucune donnée personnelle ne doit jamais apparaître dans les logs : pas d'adresse email, pas de prénom de client, pas de jeton de session ni de magic link, pas de charge utile complète de webhook. Les logs référencent des identifiants techniques (identifiant de commande, identifiant d'établissement, identifiant d'événement Stripe), jamais les données qu'ils désignent. Cette règle est vérifiée en revue de code, et son fondement RGPD est détaillé dans la page [RGPD](rgpd.md) : un log est une copie de données qui échappe aux durées de conservation maîtrisées.
!!!

Les logs techniques sont conservés 30 jours au maximum (rotation par Docker, taille et nombre de fichiers plafonnés), une durée cohérente avec leur seul usage : le diagnostic d'incidents récents.

## Les métriques

### Micrometer et Prometheus dès le premier déploiement

Le Backend expose ses métriques via `quarkus-micrometer` au format Prometheus, sur `/q/metrics`, dès le premier déploiement. Le coût est presque nul (une extension, quelques compteurs métier) et le bénéfice est décisif : le jour où un tableau de bord devient nécessaire, l'historique des mesures existe déjà dans le format que tout l'écosystème sait lire.

La chaîne se construit en deux temps :

| Étape | Quoi | Quand |
|---|---|---|
| 1 | Micrometer expose `/q/metrics` (format Prometheus), endpoint non exposé publiquement (accessible depuis le réseau interne Docker uniquement) | Premier déploiement |
| 2 | Un Prometheus scrape l'endpoint et un Grafana affiche les tableaux de bord | Posé plus tard, quand le suivi visuel devient un besoin réel ; consigné dans un ADR |

Micrometer fournit gratuitement les métriques techniques standards (latence par endpoint HTTP, pool de connexions JDBC, JVM). S'y ajoutent les métriques métier, instrumentées explicitement dans les services.

### Les métriques métier prioritaires

| Métrique | Type | Ce qu'elle révèle |
|---|---|---|
| Commandes créées | Compteur, par établissement | Le pouls de la plateforme : sa chute brutale est le premier signal d'un incident, avant toute plainte |
| Taux de conversion panier vers paiement | Dérivée de deux compteurs (paniers validés, paiements confirmés) | Une chute signale un problème de paiement ou d'ergonomie au moment le plus coûteux du parcours |
| Échecs de paiement | Compteur, par cause (refus carte, erreur Stripe, expiration) | Distingue le refus bancaire normal d'une panne d'intégration Stripe |
| Latence p95 de l'API carte | Histogramme sur les endpoints de lecture de la carte | La carte est la première page vue après le scan : sa lenteur tue la commande avant qu'elle n'existe |
| Connexions SSE actives | Jauge, par type de canal (établissement, commande) | Une jauge à zéro en plein service signifie que les Dashboards sont aveugles (voir [le temps réel](../architecture/backend.md#le-temps-réel--sse-via-mutiny)) |
| Jobs d'extraction en échec | Compteur, avec la jauge des jobs en attente | Des embarquements bloqués et un budget d'API OpenAI qui brûle pour rien |

Ces six mesures couvrent les quatre pannes silencieuses du tableau d'ouverture. Toute métrique métier supplémentaire se justifie par le même critère : quelle perte détecte-t-elle ?

## L'alerting minimal

Au MVP, l'alerting repose sur Uptime Kuma, un outil de supervision auto-hébergé et léger, installé de préférence hors du VPS de production (sinon il tombe avec ce qu'il surveille ; un hébergement séparé minimal ou un service de sonde externe reste à trancher).

| Sonde | Cible | Alerte quand |
|---|---|---|
| Santé de l'API | `https://api.surplasse.com/q/health` | Réponse DOWN, erreur ou délai dépassé |
| Mini-site Commande | La page d'un établissement témoin sur `{slug}.surplasse.com` | La page ne répond plus ou répond en erreur |
| Dashboard | `https://dashboard.surplasse.com` | La page ne répond plus ou répond en erreur |
| Certificat TLS | Le wildcard `*.surplasse.com` | Expiration à moins de 14 jours |

Les notifications partent par email et par notification mobile (Uptime Kuma sait pousser vers la plupart des canaux courants ; le canal exact reste à trancher). Il n'y a pas d'astreinte formelle à ce stade : l'objectif est qu'aucune indisponibilité ne dure des heures faute d'avoir été vue.

Les alertes sur seuils de métriques (taux d'échec de paiement, jobs en échec) arriveront avec Prometheus, qui sait les évaluer nativement ; d'ici là, ces compteurs sont consultés manuellement sur `/q/metrics` lors des diagnostics.

## SLI et objectifs pragmatiques

Sans engagement contractuel de niveau de service, Surplasse se fixe des objectifs internes, mesurables avec l'outillage décrit plus haut. Ils servent de seuil d'action : un objectif manqué déclenche une investigation, pas une pénalité.

| SLI | Mesure | Objectif |
|---|---|---|
| Disponibilité de l'API de commande | Part des requêtes des endpoints de commande et de paiement répondues sans erreur 5xx, sur 30 jours glissants | 99,5 % (environ 3 h 40 d'indisponibilité tolérée par mois) |
| Latence de la carte | p95 du temps de réponse des endpoints de lecture de la carte, mesuré côté Backend | Inférieure à 300 ms |
| Fraîcheur du flux SSE | Délai entre le commit d'un changement de statut de commande et son émission sur le canal SSE | Inférieur à 2 secondes ; battement de cœur reçu au moins toutes les 60 secondes par connexion active |

Ces valeurs sont des cibles de départ, calibrées pour un VPS unique et une volumétrie de lancement. Elles seront révisées avec les premières mesures réelles ; un durcissement significatif (haute disponibilité, multi-instances) serait une décision d'architecture, donc un ADR.

## Observabilité technique et métriques produit

Le Dashboard affiche aux restaurateurs des métriques d'activité : chiffre d'affaires, nombre de commandes, panier moyen, produits les plus commandés (voir [le parcours Dashboard](../produit/parcours/dashboard-restaurateur.md)). Ces chiffres ressemblent aux métriques d'observabilité, mais les deux familles ne se confondent jamais :

| | Observabilité technique | Métriques produit du Dashboard |
|---|---|---|
| Source | Compteurs Micrometer, en mémoire, remis à zéro au redémarrage | Requêtes SQL sur les données de domaine dans PostgreSQL |
| Exactitude | Approximative par nature (agrégats, pertes au redéploiement) : suffisante pour détecter une anomalie | Exacte au centime : un restaurateur rapproche ces chiffres de sa comptabilité |
| Audience | L'exploitant de la plateforme | Le restaurateur, pour son établissement uniquement |
| Chemin | `/q/metrics`, Prometheus, Grafana | Le contrat, endpoints de métriques du domaine engagement, filtrés par établissement (voir [sécurité](../architecture/securite.md#autorisations)) |

La règle qui en découle : le Dashboard ne lit jamais Prometheus, et l'observabilité ne lit jamais les endpoints du contrat. Un chiffre montré à un restaurateur vient de la base, par le contrat, ou n'est pas montré.

## Le pouls : les indicateurs métier des opérateurs et des fondateurs

Troisième famille, distincte des deux précédentes : le **pouls de la plateforme**, destiné à ceux qui l'exploitent et la portent. Voir les commandes défiler et les heures de pointe se dessiner remplit deux fonctions : la détection d'incident la plus fiable qui soit (plus aucune commande en plein service du midi est une alerte, quel que soit l'état des health checks) et la motivation de voir le produit vivre réellement.

L'orientation de référence tient en un outil, Grafana, avec deux sources :

| Besoin | Source Grafana | Pourquoi |
|---|---|---|
| Graphe des commandes dans le temps, heures de pointe, volumes par établissement | **PostgreSQL en source de données directe** (requêtes sur `order`, lecture seule) | Chiffres exacts, historiques complets dès le premier jour, aucun code à écrire : la table des commandes est déjà la vérité |
| Fil des dernières commandes (le produit « vit ») | Panneau tableau Grafana sur la même source, rafraîchi | Même exactitude ; un vrai fil temps réel poussé (SSE) reste possible plus tard comme page interne dédiée si le rafraîchissement ne suffit plus |
| Alerte « zéro commande en heures de service » | **Prometheus** sur le compteur Micrometer de commandes créées | C'est le rôle de Prometheus : évaluer des seuils dans le temps et alerter ; le compteur existe déjà dans les métriques métier prioritaires |

Autrement dit : Prometheus n'est pas le bon endroit pour des chiffres métier exacts (compteurs approximatifs, remis à zéro au redéploiement), mais il est le bon endroit pour l'alerte d'absence. Grafana réunit les deux mondes sur un même écran : les tableaux métier lisent PostgreSQL, les seuils lisent Prometheus. Un compte Grafana en lecture seule suffit aux fondateurs ; l'accès reste privé (jamais exposé publiquement, voir [la sécurité](../architecture/securite.md)). La pose concrète (conteneurs Grafana et Prometheus sur le VPS) se décide avec `infra/`, dans l'ADR déjà prévu ci-dessous.

## Ce qui reste à trancher

| Sujet | Piste | Où sera consignée la décision |
|---|---|---|
| Agrégateur de logs | Dozzle (simplicité) ou Loki (recherche et rétention) | ADR le moment venu |
| Hébergement d'Uptime Kuma | Petit hébergement séparé du VPS de production, ou service de sonde externe | Documentation d'exploitation |
| Canal de notification mobile | Selon les intégrations d'Uptime Kuma | Documentation d'exploitation |
| Pose de Prometheus et Grafana | Quand le suivi visuel des métriques devient un besoin réel | ADR |
| Traces distribuées OpenTelemetry | Extension déjà prévue côté Backend, activée avec la chaîne de collecte | ADR, avec le point précédent |

## Pour aller plus loin

| Page | Contenu |
|---|---|
| [Environnements](environnements.md) | Le VPS, Docker Compose, le workflow de déploiement qui consomme la readiness |
| [RGPD et confidentialité](rgpd.md) | Le fondement de la règle de non-journalisation et les durées de conservation |
| [Le backend](../architecture/backend.md) | Les extensions health, micrometer et opentelemetry, le SSE et le worker de jobs |
| [Sécurité](../architecture/securite.md) | La posture générale et le filtrage par établissement des métriques produit |
