---
label: Opérations
order: 40
icon: tools
description: "La production de Surplasse : philosophie d'exploitation d'un développeur seul, inventaire des services, topologie, sauvegardes et gestion des incidents."
---

# Exploitation

Cette section décrit la cible d'exploitation de Surplasse : ce qui tourne en production, où, comment c'est sauvegardé et comment on réagit quand ça casse. Rien de tout cela n'est encore provisionné ; ces pages fixent la référence que l'infrastructure devra suivre.

Les pages de la section :

- [Environnements](environnements.md) : local et production, domaines, DNS, variables d'environnement.
- [Outillage de l'opérateur](outillage-operateur.md) : accès à la base, logs, résultats de tests, exploration de l'API.
- [Observabilité](observabilite.md) : logs, métriques, sondes et alertes.
- [RGPD](rgpd.md) : données personnelles, rétention, droits des personnes.

Le déploiement lui-même (workflows GitHub Actions, images, rollback) est décrit dans [CI/CD](../developpement/ci-cd.md).

## Règle d'entrée en production

Tout nouveau module ou logiciel tiers est classé dès son introduction : développement seulement, build ou CI, ou service de production. Cette classification est consignée dans le [guide de développement](../developpement/index.md), même quand le composant ne tourne jamais sur le VPS.

Un composant destiné à la production n'est pas considéré comme documenté tant que les opérations suivantes ne sont pas décrites pour Ubuntu LTS : provisionnement ou construction de l'image, configuration et secrets, démarrage et redémarrage, contrôle de santé, mise à jour et retour arrière. Un composant qui conserve des données documente aussi ses volumes, sa sauvegarde et sa restauration. Ces informations arrivent dans le même commit que le service ou la dépendance.

Un outil réservé au développement ou à la CI indique explicitement qu'il est absent de la production. Quand un autre service remplit ce rôle en production, comme le fournisseur SMTP à la place de Mailpit, l'équivalent est nommé. Une description de cible au futur ne suffit plus dès que le composant est ajouté à `infra/` ou utilisé par une application déployée.

## Philosophie : l'exploitation d'un développeur seul

Surplasse est développé et exploité par une seule personne. Ce fait dicte toute l'architecture de production, avant même les considérations techniques :

- **Le moins de pièces mobiles possible.** Chaque service qui tourne est un service à mettre à jour, superviser, sauvegarder et déboguer à trois heures du matin. Un composant n'entre en production que s'il paie son coût d'entretien.
- **Tout dans Docker Compose, sur un VPS unique.** Pas d'orchestrateur, pas de cluster, pas de cloud managé au lancement. Un seul VPS, une seule pile Compose versionnée dans `infra/`, un seul endroit où regarder. Kubernetes résout des problèmes que Surplasse n'a pas.
- **Tout redéployable depuis git.** Le VPS ne contient aucun état de configuration qui ne soit pas reconstructible : les fichiers Compose et la configuration du reverse proxy vivent dans `infra/`, les images sont taggées par SHA dans le registre, les secrets sont les seuls éléments provisionnés à la main (et documentés dans [Environnements](environnements.md)). Perdre le VPS doit coûter une restauration de sauvegarde et un déploiement, pas une archéologie.

Les seules dépendances externes sont des services SaaS qui portent leur propre exploitation : Stripe pour le paiement, l'API OpenAI pour l'extraction de carte, le futur fournisseur SMTP transactionnel pour les emails, GitHub pour le code, la CI et la documentation.

## Inventaire des services en production

La documentation et la préfiguration statique de l'Onboarding sont actuellement publiées sur GitHub Pages. La pile VPS ci-dessous n'est pas encore provisionnée. Le commit qui introduira `infra/` remplacera chaque statut cible par une procédure exécutable.

| Service | Techno | Statut | Rôle | Exposition |
|---|---|---|---|---|
| Site public actuel | GitHub Pages | En service | Documentation, marque et préfiguration statique de l'Onboarding | URL GitHub Pages |
| Reverse proxy | Caddy | Cible non provisionnée | Terminaison TLS et routage par domaine | Ports 80 et 443, seul service du VPS exposé |
| Backend | Quarkus (Java 21) | Exécutable localement, non déployé | API REST, logique métier, temps réel SSE et intégrations | `api.surplasse.com`, via Caddy |
| Onboarding | Conteneur statique | Cible non construite | Vitrine produit et tunnel d'embarquement | `surplasse.com`, via Caddy |
| Commande | Conteneur statique | Exécutable localement, non déployé | Mini-site, carte, commande et paiement | `{slug}.surplasse.com`, via Caddy |
| Dashboard | Conteneur statique | Module absent | Suivi des commandes en temps réel | `dashboard.surplasse.com`, via Caddy |
| PostgreSQL | PostgreSQL 17 | Dev Services local, cible Compose absente | Base de données unique | Réseau interne Compose uniquement |
| MinIO | MinIO | Module absent | Stockage objet des images | Réseau interne Compose uniquement |
| Supervision | À trancher | Cible non provisionnée | Sondes, logs, métriques et alertes | Interface d'administration privée |

Le module Maven `identity` n'apparaît pas comme un service dans ce tableau : il est compilé dans l'image Backend. Il ne possède aucun processus, port, conteneur, volume ni health check distinct. Mailpit n'apparaît pas non plus : c'est un outil local jetable, absent de la CI et de la production. En production, le Backend remet les emails à un fournisseur SMTP transactionnel externe encore à sélectionner.

### Cycle de vie de l'identité sous Ubuntu LTS

L'identité suit exactement le cycle de vie du Backend. La pile `infra/` n'est pas encore provisionnée ; les commandes ci-dessous fixent le contrat opérationnel du futur service Compose `backend` :

```bash
# Vérifier le Backend avant de construire son image
cd backend
./mvnw -B verify
./mvnw -B package

# Lancer sur le VPS depuis le futur répertoire infra/
docker compose up -d backend
docker compose restart backend
curl --fail https://api.surplasse.com/q/health/ready

# Arrêt de maintenance, qui coupe toute l'API
docker compose stop backend
```

Le démarrage exige PostgreSQL, les migrations Flyway, les clés JWT RS256 montées hors image et la configuration SMTP décrite dans [Environnements](environnements.md#backend-quarkus). Flyway applique V5 avec le reste du schéma avant que la readiness passe à `UP`. Une mise à jour ou un retour arrière redéploie l'image Backend entière : il n'existe aucune opération propre à `identity`. Ubuntu LTS fait foi.

Sur le choix du reverse proxy : Traefik excelle dans la découverte dynamique de conteneurs et brille dans des environnements où les services vont et viennent, au prix d'une configuration par labels plus verbeuse et d'un modèle mental plus riche. Caddy fait la même chose ici avec un fichier de configuration court et lisible, et gère le certificat wildcard par défi DNS-01 via un module DNS provider (build Caddy personnalisé, à prévoir dans l'image de `infra/`). La topologie de Surplasse étant statique (les mêmes services, tout le temps), la référence retient **Caddy** pour sa simplicité ; ce choix sera consigné en ADR avec la mise en place de `infra/`.

Chaque front est empaqueté dans une image minimale servant ses fichiers statiques, construite et taggée par SHA par la CI (voir [CI/CD](../developpement/ci-cd.md)). L'alternative (Caddy servant directement les fichiers depuis un volume) économiserait trois conteneurs mais casserait l'uniformité « un déploiement = un jeu d'images » ; elle reste ouverte si la première approche s'avère lourde.

## Topologie

```
                            Internet
                               |
                          80 / 443 (TLS)
                               |
  .............................|........................... VPS
                               v
                        +-------------+
                        |    Caddy    |   certificat wildcard
                        +------+------+   *.surplasse.com
                               |
         +----------+---------+---------+----------+
         v          v                   v          v
   +----------+ +----------+     +-----------+ +----------+
   |Onboarding| | Commande |     | Dashboard | | Backend  |
   |(statique)| |(statique)|     | (statique)| | (Quarkus)|
   +----------+ +----------+     +-----------+ +----+-----+
                                                    |
                                       +------------+-----------+
                                       v                        v
                                +------------+           +-----------+
                                | PostgreSQL |           |   MinIO   |
                                +------------+           +-----------+

   +-------------+
   | Supervision |   sondes internes, hors du chemin des requêtes
   +-------------+
```

Seul Caddy écoute sur l'extérieur. PostgreSQL et MinIO ne sont joignables que depuis le réseau interne Compose ; le backend est le seul à leur parler. Les appels sortants (Stripe, API OpenAI, envoi des magic links) partent du backend.

Le routage de Caddy est purement par nom d'hôte : `api.surplasse.com` vers le backend, `dashboard.surplasse.com` vers le Dashboard, `surplasse.com` vers l'Onboarding, et tout autre sous-domaine `*.surplasse.com` vers Commande, qui résout le slug côté application. La correspondance entre domaines et certificats est détaillée dans [Environnements](environnements.md).

## Le VPS lui-même

Le dimensionnement initial est volontairement modeste : la charge d'un lancement (quelques établissements, quelques dizaines de commandes simultanées aux heures de pointe) tient très largement sur un VPS milieu de gamme. Le premier levier de croissance est vertical (plus gros VPS, migration par restauration de sauvegarde), et il suffira longtemps.

L'entretien du système suit la même logique de sobriété :

- **Ubuntu LTS** comme distribution, mises à jour de sécurité automatiques ; le reste des mises à jour système se fait manuellement, à intervalle régulier. C'est aussi le système de référence du projet : en cas de comportement divergent entre macOS, Windows et Linux, Ubuntu fait foi.
- Accès SSH par clé uniquement, deux comptes : un compte d'administration et le compte de déploiement restreint utilisé par la CI (voir [CI/CD](../developpement/ci-cd.md)).
- Pare-feu : seuls les ports 22, 80 et 443 sont ouverts.
- Aucun logiciel installé hors Docker, le moteur Docker et l'outillage de sauvegarde exceptés.

Le choix de l'hébergeur reste à trancher (contrainte principale : localisation des données dans l'Union européenne, voir [RGPD](rgpd.md)) et sera consigné en ADR avec la mise en place de `infra/`.

## Sauvegardes

La base de données est le seul état qui ne se reconstruit pas. Le régime de sauvegarde cible :

| Quoi | Fréquence | Méthode |
|---|---|---|
| PostgreSQL | Quotidienne | `pg_dump` complet, chiffré (age ou GPG), horodaté |
| Copie hors VPS | Quotidienne, après le dump | Transfert du dump chiffré vers un stockage tiers, hors du VPS et hors du même hébergeur |
| Contenu MinIO | Hebdomadaire | Synchronisation des buckets vers le même stockage tiers |
| Exercice de restauration | Trimestriel | Restauration complète du dernier dump sur un environnement local, vérification que l'application démarre et que les données sont cohérentes |

Le dump PostgreSQL inclut les tables d'identité ajoutées par V5 : restaurateurs, magic links et refresh tokens hachés. Aucune sauvegarde ni aucun volume distinct ne leur est nécessaire. L'exercice de restauration vérifie aussi le rattachement entre restaurateurs et établissements ainsi que l'état Flyway de V5.

Le contenu MinIO est moins critique que la base : les images de produits sont re-téléversables et la carte extraite vit en base, seule la photo originale de la carte serait perdue. La rétention exacte des dumps (nombre de jours, paliers hebdomadaires et mensuels) reste à trancher, en cohérence avec les durées de [RGPD](rgpd.md).

!!! warning Une sauvegarde non testée n'existe pas
L'exercice trimestriel de restauration n'est pas optionnel. C'est lui qui transforme un fichier de dump en sauvegarde : tant qu'une restauration complète n'a pas été rejouée, rien ne prouve que le dump est exploitable, que la clé de chiffrement est accessible et que la procédure est à jour.
!!!

## Gestion des incidents en solo

Il n'y a pas d'astreinte, pas d'équipe, pas de rotation : il y a une personne, qui dort parfois. Le dispositif en tient compte.

**Une page de statut simple.** Une page de statut publique, hébergée hors du VPS (pour rester joignable quand le VPS ne l'est pas), indique l'état des services principaux. Elle est alimentée par les sondes externes décrites dans [Observabilité](observabilite.md). Son URL est communiquée aux restaurateurs lors de l'embarquement.

**Une hiérarchie de priorités explicite.** Quand tout casse en même temps, l'ordre de rétablissement est fixé d'avance :

1. **La prise de commande et le paiement** (Commande, Backend, connectivité Stripe) : c'est le service en salle des établissements, chaque minute d'indisponibilité est un client qui ne commande pas.
2. **Le Dashboard** : les restaurateurs doivent voir les commandes arriver ; une dégradation courte est tolérable si les commandes sont bien enregistrées.
3. **L'Onboarding** : la vitrine et l'embarquement de nouveaux restaurateurs peuvent attendre la fin de l'incident.

**Des réflexes plutôt que des runbooks épais.** Trois gestes couvrent l'essentiel : redéployer le dernier SHA sain (rollback décrit dans [CI/CD](../developpement/ci-cd.md)), redémarrer un service via Compose, restaurer la dernière sauvegarde. Chaque incident notable donne lieu à une note post-mortem courte (cause, détection, correction, prévention) conservée dans le dépôt.

Ce qui reste à trancher : l'outil de page de statut (service SaaS ou page statique alimentée par les sondes) et le canal d'alerte (voir [Observabilité](observabilite.md)).
