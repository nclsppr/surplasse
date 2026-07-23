---
label: Opérations
order: 40
icon: tools
description: "La production de Surplasse : philosophie d'exploitation d'un développeur seul, inventaire des services, topologie, sauvegardes et gestion des incidents."
---

# Exploitation

Cette section décrit la cible d'exploitation de Surplasse : ce qui tourne en production, où, comment c'est sauvegardé et comment on réagit quand ça casse. La pile Compose, les images, le profil facultatif d'observabilité et le runbook sont maintenant versionnés et exercés en local. Aucun VPS de production n'est encore provisionné.

Les pages de la section :

- [Environnements](environnements.md) : local et production, domaines, DNS, variables d'environnement.
- [Déploiement Compose](deploiement-compose.md) : images, Ubuntu LTS, démarrage, mise à jour, retour arrière et sauvegarde.
- [Outillage de l'opérateur](outillage-operateur.md) : accès à la base, logs, résultats de tests, exploration de l'API.
- [Observabilité](observabilite.md) : logs, métriques, sondes et alertes.
- [Pilote de phase 2](pilote.md) : portes Go ou No-Go, métriques, répétition, service réel et repli.
- [Preuve Stripe Connect du 2026-07-20](preuve-stripe-connect-2026-07-20.md) : premier contrôle API test, blocage d'inscription Connect et condition de reprise.
- [RGPD](rgpd.md) : données personnelles, rétention, droits des personnes.

Le déploiement exécutable est décrit dans [Déploiement Compose](deploiement-compose.md). Son automatisation future par GitHub Actions est décrite dans [CI/CD](../developpement/ci-cd.md).

## Règle d'entrée en production

Tout nouveau module ou logiciel tiers est classé dès son introduction : développement seulement, build ou CI, ou service de production. Cette classification est consignée dans le [guide de développement](../developpement/index.md), même quand le composant ne tourne jamais sur le VPS.

Un composant destiné à la production n'est pas considéré comme documenté tant que les opérations suivantes ne sont pas décrites pour Ubuntu LTS : provisionnement ou construction de l'image, configuration et secrets, démarrage et redémarrage, contrôle de santé, mise à jour et retour arrière. Un composant qui conserve des données documente aussi ses volumes, sa sauvegarde et sa restauration. Ces informations arrivent dans le même commit que le service ou la dépendance.

Un outil réservé au développement ou à la CI indique explicitement qu'il est absent de la production. Quand un autre service remplit ce rôle en production, comme le fournisseur SMTP à la place de Mailpit, l'équivalent est nommé. Une description de cible au futur ne suffit plus dès que le composant est ajouté aux fichiers Compose, à `infra/` ou utilisé par une application déployée.

## Philosophie : l'exploitation d'un développeur seul

Surplasse est développé et exploité par une seule personne. Ce fait dicte toute l'architecture de production, avant même les considérations techniques :

- **Le moins de pièces mobiles possible.** Chaque service qui tourne est un service à mettre à jour, superviser, sauvegarder et déboguer à trois heures du matin. Un composant n'entre en production que s'il paie son coût d'entretien.
- **Tout dans Docker Compose, sur un VPS unique.** Pas d'orchestrateur, pas de cluster, pas de cloud managé au lancement. Un seul VPS, un socle `compose.yaml`, une surcharge production et un seul endroit où regarder. Kubernetes résout des problèmes que Surplasse n'a pas.
- **Tout redéployable depuis git.** Le VPS ne contient aucun état de configuration qui ne soit pas reconstructible : les fichiers Compose vivent à la racine, la configuration du reverse proxy dans `infra/caddy/`, les images sont taggées par SHA dans le registre, les secrets sont les seuls éléments provisionnés à la main (et documentés dans [Environnements](environnements.md)). Perdre le VPS doit coûter une restauration de sauvegarde et un déploiement, pas une archéologie.

Les seules dépendances externes sont des services SaaS qui portent leur propre exploitation : Stripe pour le paiement, l'API OpenAI pour l'extraction de carte, le futur fournisseur SMTP transactionnel pour les emails, GitHub pour le code, la CI et la documentation.

## Inventaire des services en production

La documentation, la préfiguration statique de l'Onboarding et les démos UI2 `noindex` sont actuellement publiées sur GitHub Pages. Les démos UI2 ne joignent aucun Backend public et ne constituent pas des routes produit. Les images et services ci-dessous sont construits et testés dans le cluster local. Ils ne prouvent pas qu'un VPS public existe.

| Service | Techno | Statut | Rôle | Exposition |
|---|---|---|---|---|
| Site public actuel | GitHub Pages | En service | Documentation, marque, préfiguration statique de l'Onboarding et preuves visuelles UI2 | URL GitHub Pages |
| Reverse proxy | Caddy 2.11.4 | Service Compose livré, VPS non provisionné | Terminaison TLS et routage par domaine | Ports 80 et 443, seul service du VPS exposé |
| Backend | Quarkus 3.37.3, Java 25 | Image livrée, non déployée | API REST, logique métier, temps réel SSE et intégrations | `api.surplasse.com`, via Caddy |
| Onboarding | Fichiers statiques, NGINX interne | Image livrée, non déployée | Vitrine produit et tunnel d'embarquement | `surplasse.com`, via Caddy |
| Commande | Build React statique, NGINX interne | Image livrée, non déployée | Mini-site, carte, commande et paiement | `{slug}.surplasse.com`, via Caddy |
| Dashboard | Build React statique, NGINX interne | Image livrée, non déployée | Authentification, suivi SSE et avancement des commandes | `dashboard.surplasse.com`, via Caddy |
| PostgreSQL | PostgreSQL 17.10 | Service Compose livré, VPS non provisionné | Base de données unique | Réseau interne Compose uniquement |
| MinIO | MinIO | Module absent | Stockage objet des images | Réseau interne Compose uniquement |
| Surveillance fonctionnelle | Playwright 1.61 et Allure 3 | Workflow livré, horaire production désactivé avant le VPS | Smokes publics en lecture seule, rapport et historique par cible | Runner GitHub Actions ou poste d'exploitation, jamais dans la pile |
| Prometheus | 3.13.1, variante `busybox` | Profil Compose facultatif livré, VPS non provisionné | Collecte pull des métriques et évaluation de règles | Réseau interne Compose uniquement |
| Grafana | 13.1.1 | Profil Compose facultatif livré, VPS non provisionné | Tableau de bord opérationnel provisionné | Développement via `GRAFANA_URL` ; production par port loopback et tunnel SSH |

Le module Maven `identity` n'apparaît pas comme un service dans ce tableau : il est compilé dans l'image Backend. Il ne possède aucun processus, port, conteneur, volume ni health check distinct. Mailpit n'apparaît pas non plus : c'est un outil local jetable, absent de la CI et de la production. En production, le Backend remet les emails à un fournisseur SMTP transactionnel externe encore à sélectionner.

dnsmasq, mkcert et le cockpit Node sont eux aussi réservés au développement. Le cockpit pilote uniquement le profil Compose development, peut démarrer ou arrêter Prometheus et Grafana et sert seulement son rapport Allure local. Le DNS public remplace dnsmasq et Let's Encrypt remplace mkcert. En production, Grafana garde sa propre authentification derrière un tunnel SSH et le cockpit reste absent. Playwright et Allure restent hors du VPS : ils observent Caddy et les applications depuis un runner externe. Les rapports production et UAT restent des artefacts de CLI ou de CI. Le routage commun vit dans `infra/caddy/Caddyfile`. Les petites inclusions de TLS et de routes portent les différences entre les profils. L'inventaire local exécutable est dans [Domaines locaux](../developpement/domaines-locaux.md).

### Cycle de vie de l'identité sous Ubuntu LTS

L'identité suit exactement le cycle de vie du Backend. Elle n'a ni image, ni port, ni healthcheck distinct. Les commandes du service Compose sont exécutables :

```bash
# Verify the Backend before building its image
cd /path/to/surplasse
npm run backend:verify

# Start on Ubuntu with the protected production environment selected
export SURPLASSE_SECRETS_FILE=/etc/surplasse/production.env
scripts/compose.sh production up --detach --wait backend
scripts/compose.sh production restart backend
curl --fail https://api.surplasse.com/q/health/ready

# Stop for maintenance, which interrupts the whole API
scripts/compose.sh production stop backend
```

Le démarrage exige PostgreSQL, les migrations Flyway, les clés JWT RS256 montées hors image et la configuration SMTP décrite dans [Environnements](environnements.md#backend). Flyway applique les migrations jusqu'à V14 avant que la readiness passe à `UP`. Une mise à jour ou un retour arrière redéploie l'image Backend entière : il n'existe aucune opération propre à `identity`. Ubuntu LTS fait foi.

### Cycle de vie du Dashboard sous Ubuntu LTS

Le Dashboard possède maintenant une image statique, un service Compose, une route Caddy et un healthcheck. Il reste absent d'un VPS public. Sa vérification applicative précède la construction :

```bash
cd frontends/shared
npm ci
npm run check
npm test

cd ../dashboard
npm ci
npm run lint
npm test
npm run build
```

Cette construction produit `frontends/dashboard/dist/`. L'image exécute la même construction avec le profil choisi. Le mode production lit `APP_BASE_DOMAIN` dans `config/domains/production.env`, puis intègre l'URL API dérivée aux fichiers. Aucun override séparé de l'API n'est accepté. Le résultat ne conserve aucune donnée et n'utilise aucun volume. React, React Router, TanStack Query et `frontends/shared` sont intégrés aux fichiers statiques. Node, Vite, Tailwind CSS, TypeScript, ESLint et Vitest restent dans l'étape de build et sont absents de l'image NGINX finale.

```bash
export SURPLASSE_SECRETS_FILE=/etc/surplasse/production.env
scripts/compose.sh production up --detach --wait dashboard
scripts/compose.sh production restart dashboard
curl --fail https://dashboard.surplasse.com/
scripts/compose.sh production stop dashboard
```

Une mise à jour remplace l'image par un nouveau SHA. Un retour arrière redéploie le dernier SHA sain, sans restauration de données. Le Dashboard n'a ni sauvegarde, ni restauration, ni migration propre : toute donnée métier reste dans PostgreSQL derrière le Backend. L'absence actuelle de VPS et de DNS public reste distincte de la disponibilité de l'artefact.

Sur le choix du reverse proxy : Traefik excelle dans la découverte dynamique de conteneurs et brille dans des environnements où les services vont et viennent, au prix d'une configuration par labels plus verbeuse et d'un modèle mental plus riche. Caddy fait la même chose ici avec un fichier de configuration court et lisible. L'image de production est prête à intégrer par `xcaddy` le module DNS du fournisseur retenu. Le choix du fournisseur et du module reste un blocage explicite avant le premier VPS.

Chaque front est empaqueté dans une image immuable et utilise NGINX non privilégié en production. Le serveur Node allowlisté de l'Onboarding existe seulement dans son image development afin de servir la session Stripe test locale. Les images de production seront taggées par SHA par la CI. Le détail des images et des commandes vit dans [Déploiement Compose](deploiement-compose.md).

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
                                                    v
                                       +------------+
                                       | PostgreSQL |
                                       +------------+

   +------------+    scrape pull    +---------+
   | Prometheus | <---------------- | Backend |
   +-----+------+                   +---------+
         ^
         | PromQL
   +-----+------+
   |  Grafana   |   profil facultatif, hors du chemin des requêtes
   +------------+
```

Seul Caddy écoute sur l'extérieur. PostgreSQL et Prometheus ne sont joignables que depuis le réseau interne Compose. Le Backend est le seul service applicatif à parler à PostgreSQL. Prometheus collecte le Backend, jamais l'inverse. Grafana rejoint le réseau interne pour lire Prometheus. Il n'a aucune route publique en production et son éventuel port hôte écoute seulement sur la boucle locale pour un tunnel SSH. MinIO n'entre pas dans la pile avant l'implémentation du domaine `generation`. Les appels sortants vers Stripe et le SMTP partent du Backend.

Le routage de Caddy est purement par nom d'hôte : `api.surplasse.com` vers le backend, `dashboard.surplasse.com` vers le Dashboard, `surplasse.com` vers l'Onboarding, et tout autre sous-domaine `*.surplasse.com` vers Commande, qui résout le slug côté application. La correspondance entre domaines et certificats est détaillée dans [Environnements](environnements.md).

## Le VPS lui-même

Le dimensionnement initial est volontairement modeste : la charge d'un lancement (quelques établissements, quelques dizaines de commandes simultanées aux heures de pointe) tient très largement sur un VPS milieu de gamme. Le premier levier de croissance est vertical (plus gros VPS, migration par restauration de sauvegarde), et il suffira longtemps.

L'entretien du système suit la même logique de sobriété :

- **Ubuntu LTS** comme distribution, mises à jour de sécurité automatiques ; le reste des mises à jour système se fait manuellement, à intervalle régulier. C'est aussi le système de référence du projet : en cas de comportement divergent entre macOS, Windows et Linux, Ubuntu fait foi.
- Accès SSH par clé uniquement, deux comptes : un compte d'administration et le compte de déploiement restreint utilisé par la CI (voir [CI/CD](../developpement/ci-cd.md)).
- Pare-feu : seuls les ports 22, 80 et 443 sont ouverts.
- Aucun logiciel installé hors Docker, le moteur Docker et l'outillage de sauvegarde exceptés.

Le choix de l'hébergeur reste à trancher (contrainte principale : localisation des données dans l'Union européenne, voir [RGPD](rgpd.md)) et sera consigné en ADR avant le provisionnement du VPS.

## Sauvegardes

La base de données est le seul état qui ne se reconstruit pas. Le régime de sauvegarde cible :

| Quoi | Fréquence | Méthode |
|---|---|---|
| PostgreSQL | Quotidienne | `pg_dump` complet, chiffré (age ou GPG), horodaté |
| Copie hors VPS | Quotidienne, après le dump | Transfert du dump chiffré vers un stockage tiers, hors du VPS et hors du même hébergeur |
| Contenu MinIO, après son ajout | Hebdomadaire | Synchronisation des buckets vers le même stockage tiers |
| Exercice de restauration | Trimestriel | Restauration complète du dernier dump sur un environnement local, vérification que l'application démarre et que les données sont cohérentes |

Les volumes Prometheus et Grafana ne rejoignent pas cette sauvegarde métier. Les séries temporelles, préférences et éventuelles modifications manuelles de l'interface sont reconstructibles et peuvent être perdues. Le dépôt reprovisionne la configuration, les règles, la source Prometheus et le tableau de bord canonique. Si l'historique opérationnel devient une exigence de conformité ou de service, son export hors VPS fera l'objet d'une décision explicite.

Le dump PostgreSQL inclut les tables d'identité ajoutées par V5, le routage Connect ajouté par V10, le snapshot financier ajouté par V11, l'état de prise de commandes ajouté par V12, les noms Accounts v2 introduits par V13 et les remboursements rapprochés par V14. Aucune sauvegarde ni aucun volume distinct ne leur est nécessaire. L'exercice de restauration vérifie aussi le rattachement entre restaurateurs et établissements, l'état Flyway de V14, la valeur `open` ou `paused` de chaque établissement et les index critiques décrits dans le [modèle de données](../architecture/donnees.md#migrations-flyway-effectivement-livrées).

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

Ce qui reste à trancher : l'outil de page de statut (service SaaS ou page statique alimentée par les sondes), la sonde externe et le canal d'alerte. Les règles Prometheus livrées ne notifient personne tant qu'Alertmanager ou un service externe n'est pas configuré (voir [Observabilité](observabilite.md)).
