---
label: Opérations
order: 40
icon: tools
description: "La production de Surplasse : philosophie d'exploitation d'un développeur seul, inventaire des services, topologie, sauvegardes et gestion des incidents."
---

# Exploitation

Cette section décrit la cible d'exploitation de Surplasse : ce qui tourne en production, où, comment c'est sauvegardé et comment on réagit quand ça casse. Atlas et sa plateforme partagée sont provisionnés. La pile applicative Surplasse n'y est pas activée. Le dépôt publie un candidat OCI immuable, mais le contrat protégé de `vps-infra` conserve Surplasse avec `enabled: false`.

Les pages de la section :

- [Environnements](environnements.md) : local et production, domaines, DNS, variables d'environnement.
- [Déploiement Compose](deploiement-compose.md) : images, Ubuntu LTS, démarrage, mise à jour, retour arrière et sauvegarde.
- [Outillage de l'opérateur](outillage-operateur.md) : accès à la base, logs, résultats de tests, exploration de l'API.
- [Observabilité](observabilite.md) : logs, métriques, sondes et alertes.
- [Pilote de phase 2](pilote.md) : portes Go ou No-Go, métriques, répétition, service réel et repli.
- [Preuve Stripe Connect du 2026-07-20](preuve-stripe-connect-2026-07-20.md) : premier contrôle API test, blocage d'inscription Connect et condition de reprise.
- [RGPD](rgpd.md) : données personnelles, rétention, droits des personnes.

La publication productrice et la frontière Atlas sont décrites dans [Déploiement Compose](deploiement-compose.md). [CI/CD](../developpement/ci-cd.md) décrit comment `main` publie le candidat exact sans l'activer. Les décisions et commandes d'exploitation qui mutent Atlas appartiennent au [runbook `vps-infra`](https://github.com/nclsppr/vps-infra/blob/main/docs/deployment.md#deploy-a-compose-application).

## Règle d'entrée en production

Tout nouveau module ou logiciel tiers est classé dès son introduction : développement seulement, build ou CI, ou service de production. Cette classification est consignée dans le [guide de développement](../developpement/index.md), même quand le composant ne tourne jamais sur le VPS.

Un composant destiné à la production n'est pas considéré comme documenté tant que les opérations suivantes ne sont pas décrites pour Ubuntu LTS : provisionnement ou construction de l'image, configuration et secrets, démarrage et redémarrage, contrôle de santé, mise à jour et retour arrière. Un composant qui conserve des données documente aussi ses volumes, sa sauvegarde et sa restauration. Ces informations arrivent dans le même commit que le service ou la dépendance.

Un outil réservé au développement ou à la CI indique explicitement qu'il est absent de la production. Quand un autre service remplit ce rôle en production, comme le fournisseur SMTP à la place de Mailpit, l'équivalent est nommé. Une description de cible au futur ne suffit plus dès que le composant est ajouté aux fichiers Compose, à `infra/` ou utilisé par une application déployée.

## Philosophie : l'exploitation d'un développeur seul

Surplasse est développé et exploité par une seule personne. Ce fait dicte toute l'architecture de production, avant même les considérations techniques :

- **Le moins de pièces mobiles possible.** Chaque service qui tourne est un service à mettre à jour, superviser, sauvegarder et déboguer à trois heures du matin. Un composant n'entre en production que s'il paie son coût d'entretien.
- **Tout dans Docker Compose, sur un VPS unique.** Pas d'orchestrateur, pas de cluster, pas de cloud managé au lancement. Atlas fournit la plateforme partagée et le contrôleur. Le bundle Surplasse fournit uniquement ses cinq services longs et son job de migration.
- **Tout redéployable depuis des sources immuables.** Le dépôt Surplasse produit les images et le descripteur `application-release`. `vps-infra` porte l'état désiré, les routes et le contrôleur. Les secrets et les sauvegardes restent hors de Git et doivent avoir leur propre preuve de restauration.

Les seules dépendances externes sont des services SaaS qui portent leur propre exploitation : Stripe pour le paiement, l'API OpenAI pour l'extraction de carte, un relais SMTP transactionnel géré encore à sélectionner et qualifier, GitHub pour le code, la CI et le miroir documentaire Pages.

## Inventaire cible et état réel

La documentation Nimbus canonique, la préfiguration statique de l'Onboarding et les démos UI2 `noindex` sont actuellement publiées sur GitHub Pages. Nimbus utilise `docs/` comme source éditoriale et apparaît sous `/docs/`. Les aperçus UI2 ne joignent aucun Backend public et ne constituent pas des routes produit. Atlas sert déjà d'autres charges, mais aucune route publique Atlas ne sert Surplasse. La présence du VPS ne prouve donc pas la présence de l'application.

| Service | Techno | Statut | Rôle | Exposition |
|---|---|---|---|---|
| Site public actuel | GitHub Pages | En service | Documentation Nimbus, marque, préfiguration statique de l'Onboarding et preuves visuelles UI2 | `/surplasse/docs/` et autres routes Pages |
| Reverse proxy | Caddy 2.11.4 | Plateforme Atlas en service, route Surplasse désactivée | Terminaison TLS et routage par domaine | Ports 80 et 443 de la plateforme partagée |
| Documentation | Nimbus 0.8.2, Astro et NGINX interne | Image livrée, non déployée | Documentation canonique générée depuis `docs/` | `docs.surplasse.com`, via Caddy |
| Backend | Quarkus 3.37.4, Java 25 | Image livrée, non déployée | API REST, logique métier, temps réel SSE et intégrations | `api.surplasse.com`, via Caddy |
| Onboarding | Fichiers statiques, NGINX interne | Image livrée, non déployée | Vitrine produit et tunnel d'embarquement | `surplasse.com`, via Caddy |
| Commande | Build React statique, NGINX interne | Image livrée, non déployée | Mini-site, carte, commande et paiement | `{slug}.surplasse.com`, via Caddy |
| Dashboard | Build React statique, NGINX interne | Image livrée, non déployée | Authentification, suivi SSE et avancement des commandes | `dashboard.surplasse.com`, via Caddy |
| PostgreSQL | PostgreSQL 17.10 | Contrat Atlas livré, base et rôles Surplasse non activés | Base de données unique | Réseau interne Compose uniquement |
| MinIO | MinIO | Module absent | Stockage objet des images | Réseau interne Compose uniquement |
| Surveillance fonctionnelle | Playwright 1.61 et Allure 3 | Workflow livré, horaire production désactivé tant que la route Surplasse est absente | Smokes publics en lecture seule, rapport et historique par cible | Runner GitHub Actions ou poste d'exploitation, jamais dans la pile |
| Prometheus | 3.13.1 local ; Atlas 3.13.2 `busybox` | Profil local et règles ou cible Atlas livrés, intégration Surplasse désactivée | Collecte pull des métriques et évaluation de règles | Réseau interne Compose uniquement |
| Grafana | 13.1.1 local ; Atlas 13.1.3 `slim` | Profil local et tableau de bord Atlas livrés, intégration Surplasse non activée | Tableau de bord opérationnel provisionné | Développement via `GRAFANA_URL` ; cible production par port loopback et tunnel SSH |

Le module Maven `identity` n'apparaît pas comme un service dans ce tableau : il est compilé dans l'image Backend. Il ne possède aucun processus, port, conteneur, volume ni health check distinct. Mailpit n'apparaît pas non plus : c'est un outil local jetable, absent de la CI et de la production. Le Backend de production devra remettre les emails à un relais SMTP transactionnel géré. Sa sélection, son provisionnement et ses preuves de remise restent bloquants.

dnsmasq, mkcert et le cockpit Node sont eux aussi réservés au développement. Le cockpit pilote uniquement le profil Compose development, peut démarrer ou arrêter Prometheus et Grafana et sert seulement son rapport Allure local. Le DNS public remplace dnsmasq et Let's Encrypt remplace mkcert. En production, Grafana garde sa propre authentification derrière un tunnel SSH et le cockpit reste absent. Playwright et Allure restent hors du VPS : ils observent Caddy et les applications depuis un runner externe. Les rapports production et UAT restent des artefacts de CLI ou de CI. Le routage local et historique vit dans `infra/caddy/Caddyfile`. La route candidate Atlas vient de `deployment/vps/caddy/surplasse.caddy` et doit être admise puis préparée par `vps-infra`. L'inventaire local exécutable est dans [Domaines locaux](../developpement/domaines-locaux.md).

!!! warning Commandes de cycle de vie
Les exemples `scripts/compose.sh production` ci-dessous documentent le chemin historique et la forme attendue des contrôles. Ils ne doivent pas être exécutés sur Atlas. Le contrôleur et les commandes bornées de `vps-infra` sont l'unique chemin autorisé pour la production Atlas.
!!!

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

Le démarrage exige PostgreSQL, les migrations Flyway, les clés JWT RS256 montées hors image et la configuration SMTP décrite dans [Environnements](environnements.md#backend). En production Atlas, le job one-shot du même digest applique les migrations jusqu'à V14 avec `surplasse_migrator`, puis le Backend démarre avec `surplasse_runtime` et la migration automatique désactivée. Une mise à jour ou un retour arrière redéploie l'image Backend entière : il n'existe aucune opération propre à `identity`. Ubuntu LTS fait foi.

### Cycle de vie du Dashboard sous Ubuntu LTS

Le Dashboard possède maintenant une image statique, un service Compose, une route Caddy et un healthcheck. Il reste absent du runtime Atlas et de ses routes publiques. Sa vérification applicative précède la construction :

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

Une mise à jour remplace l'image par un nouveau SHA. Un retour arrière redéploie le dernier SHA sain, sans restauration de données. Le Dashboard n'a ni sauvegarde, ni restauration, ni migration propre : toute donnée métier reste dans PostgreSQL derrière le Backend. L'absence actuelle d'activation et de DNS Surplasse sur Atlas reste distincte de la disponibilité de l'artefact.

### Cycle de vie de Nimbus sous Ubuntu LTS

Nimbus 0.8.2 construit la documentation depuis `docs/` au moyen de l'adaptateur versionné dans `docs-nimbus/`. L'image finale contient seulement les fichiers statiques et NGINX non privilégié. Elle ne conserve aucune donnée ni aucun volume.

```bash
cd /path/to/surplasse
npm ci --prefix docs-nimbus
npm run docs:build

export SURPLASSE_SECRETS_FILE=/etc/surplasse/production.env
scripts/compose.sh production up --detach --wait docs
scripts/compose.sh production restart docs
curl --fail https://docs.surplasse.com/
scripts/compose.sh production stop docs
```

Une mise à jour remplace l'image par un nouveau SHA. Un retour arrière redéploie le dernier SHA sain. Le miroir GitHub Pages est construit indépendamment depuis la même source et ne remplace pas le contrôle de santé de `docs.surplasse.com`.

Sur le choix du reverse proxy : Traefik excelle dans la découverte dynamique de conteneurs et brille dans des environnements où les services vont et viennent, au prix d'une configuration par labels plus verbeuse et d'un modèle mental plus riche. Caddy fait la même chose ici avec un fichier de configuration court et lisible. Atlas possède son image Caddy partagée avec le module DNS OVH épinglé. L'identité OVH bornée à `surplasse.com`, la route wildcard et la bascule DNS Surplasse restent à provisionner et à prouver avant activation.

Chaque frontend et la documentation sont empaquetés dans une image immuable et utilisent NGINX non privilégié en production. Le serveur Node allowlisté de l'Onboarding existe seulement dans son image development afin de servir la session Stripe test locale. Les images de production sont taggées par SHA par la CI. Le détail des images et des commandes vit dans [Déploiement Compose](deploiement-compose.md).

## Topologie cible après activation

```
                            Internet
                               |
                          80 / 443 (TLS)
                               |
  .............................|........................... VPS
                               v
                        +-------------+
                        |    Caddy    |   certificats
                        +------+------+   *.surplasse.com
                               |          docs.surplasse.com
         +----------+----------+----------+----------+
         v          v          v          v          v
   +----------+ +----------+ +---------+ +--------+ +----------+
   |Onboarding| | Commande | |Dashboard| |  Docs  | | Backend  |
   |(statique)| |(statique)| |(statique)| |(Nimbus)| | (Quarkus)|
   +----------+ +----------+ +---------+ +--------+ +----+-----+
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

Le routage de Caddy est purement par nom d'hôte : `api.surplasse.com` vers le backend, `dashboard.surplasse.com` vers le Dashboard, `surplasse.com` vers l'Onboarding, `docs.surplasse.com` vers Nimbus et tout autre sous-domaine `*.surplasse.com` vers Commande, qui résout le slug côté application. La correspondance entre domaines et certificats est détaillée dans [Environnements](environnements.md).

## Le VPS lui-même

Le dimensionnement initial est volontairement modeste : la charge d'un lancement (quelques établissements, quelques dizaines de commandes simultanées aux heures de pointe) tient très largement sur un VPS milieu de gamme. Le premier levier de croissance est vertical (plus gros VPS, migration par restauration de sauvegarde), et il suffira longtemps.

L'entretien du système suit la même logique de sobriété :

- **Ubuntu LTS** comme distribution, mises à jour de sécurité automatiques ; le reste des mises à jour système se fait manuellement, à intervalle régulier. C'est aussi le système de référence du projet : en cas de comportement divergent entre macOS, Windows et Linux, Ubuntu fait foi.
- Accès SSH par clé uniquement, deux comptes : un compte d'administration et le compte de déploiement restreint utilisé par la CI (voir [CI/CD](../developpement/ci-cd.md)).
- Pare-feu : seuls les ports 22, 80 et 443 sont ouverts.
- Aucun runtime Surplasse installé directement sur l'hôte : Java, Node et NGINX restent dans les images. Les services et contrôleurs hôte d'Atlas appartiennent à `vps-infra`.

Atlas est hébergé chez OVHcloud. Surplasse n'y est pas encore activé. Avant le pilote, le registre RGPD doit recevoir la région contractuelle exacte, le DPA et les responsabilités applicables à l'hébergement des données Surplasse (voir [RGPD](rgpd.md)).

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

**Des réflexes plutôt que des runbooks épais.** Trois gestes couvrent l'essentiel : publier un commit descendant qui restaure le code sain puis laisser Atlas appliquer sa politique de reprise, réconcilier le runtime par les commandes bornées de `vps-infra`, restaurer la dernière sauvegarde seulement selon une procédure de données planifiée. Après migration, le runtime précédent ne redémarre que si sa compatibilité de schéma est attestée ; sinon la reprise avance explicitement. Chaque incident notable donne lieu à une note post-mortem courte (cause, détection, correction, prévention) conservée dans le dépôt.

Ce qui reste à trancher : l'outil de page de statut (service SaaS ou page statique alimentée par les sondes), la sonde externe et le canal d'alerte. Les règles Prometheus livrées ne notifient personne tant qu'Alertmanager ou un service externe n'est pas configuré (voir [Observabilité](observabilite.md)).
