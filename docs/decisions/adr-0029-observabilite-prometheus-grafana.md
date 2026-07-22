---
label: "ADR-0029 : Prometheus et Grafana"
order: 290
icon: law
description: Une chaîne de métriques Prometheus et Grafana facultative, privée et sans dépendance du Backend vers sa supervision.
---

# ADR-0029 : observabilité Prometheus et Grafana non bloquante

## Statut

Accepté, 2026-07-22.

## Contexte

Le pilote doit détecter une dégradation avant qu'un restaurateur ou un client la signale. Les healthchecks de Docker Compose et les smokes Playwright prouvent respectivement la santé instantanée des conteneurs et quelques parcours publics. Ils ne conservent pas les séries temporelles nécessaires pour observer une hausse des erreurs HTTP, une chute des paiements confirmés, un pool JDBC saturé ou une JVM sous pression.

Surplasse reste exploité par une seule personne sur un VPS Ubuntu LTS. La supervision ne doit donc ni multiplier les composants obligatoires du chemin de requête, ni rendre le Backend indisponible lorsque son interface de visualisation ou son stockage de métriques tombe. Les métriques d'exploitation ne doivent pas non plus devenir une seconde base de données métier ni exposer des identifiants de commande, d'établissement ou de personne dans des labels.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Journaux et healthchecks seulement | Aucun nouveau service | Pas d'historique chiffré, détection tardive des dérives et des échecs métier |
| Envoi de métriques du Backend vers un service externe | Stockage hors du VPS, chaîne potentiellement gérée | Dépendance réseau dans le processus applicatif, coût et fournisseur à choisir |
| Prometheus en collecte pull et Grafana dans Compose | Aucun appel du Backend vers la supervision, fichiers et tableaux de bord versionnés, exploitation connue | Deux services et deux volumes supplémentaires à maintenir |
| Suite complète avec Alertmanager, Loki et Tempo dès maintenant | Alertes, journaux et traces réunis | Charge d'exploitation disproportionnée avant le pilote |

## Décision

Nous ajoutons Prometheus 3.13.1 et Grafana 13.1.1 au socle Docker Compose, derrière le profil facultatif `observability`. Le cluster applicatif démarre sans ce profil. Le Backend, Caddy et PostgreSQL ne dépendent jamais de Prometheus ou de Grafana dans Compose, dans leur readiness ou dans leur code. Prometheus collecte les métriques en pull sur le réseau interne. L'arrêt des deux services ne modifie donc ni le traitement des requêtes, ni les paiements, ni les migrations, ni les healthchecks applicatifs.

Le Backend utilise Micrometer avec le registre Prometheus. Il expose `/q/metrics` à Prometheus sur le réseau interne Compose. Caddy refuse explicitement ce chemin sur l'hôte public de l'API. Les métriques HTTP, JVM et JDBC fournies par Quarkus sont complétées par un premier ensemble métier à faible cardinalité : commandes créées, sessions de paiement ouvertes, événements de paiement réussis ou échoués, remboursements réussis ou échoués, remises de magic link acceptées ou échouées et connexions SSE actives par type de canal. Aucun identifiant métier, hostname libre, email, jeton ou message d'exception ne devient un label.

Grafana utilise uniquement Prometheus comme source versionnée. Le Dashboard restaurateur ne lit jamais Prometheus : ses chiffres exacts restent calculés depuis PostgreSQL par le Backend et filtrés par établissement. Une source Grafana PostgreSQL directe n'est pas retenue à ce stade, afin de ne pas distribuer un nouvel identifiant de base ni de confondre exploitation et analyse produit.

Le dépôt provisionne un tableau de bord `Surplasse / Vue opérationnelle`. Il réunit disponibilité des cibles, trafic HTTP, erreurs 5xx, latence HTTP moyenne, compteurs métier, remises SMTP, connexions SSE, JVM, JDBC et santé des collectes Prometheus. Les règles Prometheus versionnées évaluent des conditions locales, mais aucune notification n'est promise : Alertmanager n'est pas installé. L'alerte externe et son canal restent une étape distincte avant la production réelle.

En développement, Grafana est servi par Caddy sur `GRAFANA_URL`, dérivée du profil central. Prometheus n'a aucune route publique. En production, ni Prometheus ni Grafana ne reçoivent de route Caddy. Grafana publie seulement son port sur la boucle locale du VPS et s'ouvre depuis un poste d'exploitation par tunnel SSH, avec authentification Grafana. Son mot de passe administrateur vient du fichier de secrets protégé. L'accès anonyme est désactivé en production.

Les volumes `prometheus_data` et `grafana_data` persistent les séries temporelles et l'état de l'interface. Ils sont considérés comme reconstructibles : les règles, la source et le tableau de bord vivent dans git, et les données métier restent dans PostgreSQL. Ils ne rejoignent pas la sauvegarde métier obligatoire. Leur perte supprime l'historique opérationnel et les réglages non versionnés, puis leur recréation reprovisionne le contenu canonique.

## Conséquences

Conséquences positives :

- la supervision peut être ajoutée, arrêtée ou recréée indépendamment de la pile applicative ;
- aucun incident Prometheus ou Grafana ne fait tomber le Backend ni sa readiness ;
- les mêmes métriques, règles et tableaux de bord sont exercés localement avant leur utilisation sur Ubuntu LTS ;
- l'endpoint de métriques et l'interface Grafana ne sont pas exposés à Internet en production ;
- les labels bornés protègent la mémoire de Prometheus et évitent de copier des données métier ou personnelles ;
- les tableaux de bord sont versionnés et reproductibles sans configuration manuelle.

Conséquences négatives et dettes assumées :

- activer le profil consomme de la mémoire, du disque et du CPU sur le VPS unique ;
- la perte des volumes supprime l'historique des séries et les préférences Grafana non versionnées ;
- les règles Prometheus n'envoient encore aucune notification faute d'Alertmanager ;
- la latence HTTP initiale est affichée en moyenne, les histogrammes et p95 par parcours restent à instrumenter ;
- les temps Stripe et webhook, les jobs IA, les métriques hôte, les journaux centralisés et les traces distribuées restent à ajouter quand un besoin mesuré les justifie ;
- les métriques exactes par établissement restent un chantier produit sur PostgreSQL, distinct de cette chaîne d'exploitation.
