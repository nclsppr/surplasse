---
label: Opérations
order: 40
icon: tools
description: "La production hybride Cloudflare et Atlas de Surplasse : responsabilités, sauvegardes, preuves et incidents."
---

# Exploitation

Surplasse possède une seule production logique et deux candidats séparés : le Worker et les statiques Cloudflare pour le bord, puis l'`application-release` Atlas pour le coeur transactionnel. `vps-infra` admet et active leurs références exactes. Le Compose racine appartient uniquement au développement local. L'état live ne se déduit jamais d'un push, d'un artefact CI ou d'une publication OCI. Il se prouve sur Cloudflare, Atlas et les routes publiques.

!!! warning Rappel obligatoire avant toute ouverture publique
La production et les commandes peuvent être ouvertes aux testeurs avec Stripe test et des sauvegardes locales au VPS. Avant l'ouverture publique, il reste absolument à qualifier Stripe live et le SMTP transactionnel, restaurer une sauvegarde chiffrée hors VPS, fermer les CSP de Commande et du Dashboard, puis raccorder une sonde publique indépendante à un canal d'alerte.
!!!

Les pages de cette section :

- [Environnements](environnements.md) : domaines, variables et secrets locaux, Cloudflare ou Atlas ;
- [Migration Cloudflare](migration-cloudflare.md) : architecture, coûts, candidat Worker, portes, sondes et retour arrière ;
- [Déploiement Atlas](deploiement-compose.md) : publication, admission, migration, activation, reprise et sauvegarde ;
- [Outillage de l'opérateur](outillage-operateur.md) : base, journaux, métriques, tests et API ;
- [Observabilité](observabilite.md) : healthchecks, métriques, tableaux de bord, sondes et alertes ;
- [Bootstrap du pilote](bootstrap-pilote-production.md) : manifeste protégé, commande one-shot et contrôles Stripe test ;
- [Pilote de phase 2](pilote.md) : portes Go ou No-Go, répétition, service réel et repli ;
- [Preuve Stripe Connect du 2026-07-20](preuve-stripe-connect-2026-07-20.md) : preuve historique et condition de reprise ;
- [RGPD](rgpd.md) : données personnelles, rétention et droits des personnes.

Les commandes qui mutent Atlas, DNS, les Routes Worker ou Tunnel appartiennent au plan de contrôle `vps-infra`. Aucun guide Surplasse ne doit s'attribuer une seconde autorité de production. L'activation opérateur d'urgence de l'apex et de `www` du 2026-08-25 est une exception d'incident documentée dans le [runbook Cloudflare](migration-cloudflare.md). Elle doit être importée dans l'état désiré `vps-infra` avant toute nouvelle Route, sans installer une seconde autorité durable dans le dépôt produit.

## Règle d'entrée en production

Tout nouveau module ou logiciel tiers est classé dès son introduction : développement seulement, build ou CI, candidat du bord Cloudflare, service de la release Surplasse, ou service du plan de contrôle. Cette classification est consignée dans le [guide de développement](../developpement/index.md).

Un composant destiné à la production documente dans la même révision :

- sa construction ou son provisionnement sous Ubuntu LTS ;
- sa configuration et ses secrets ;
- son cycle de démarrage, contrôle de santé, mise à jour, reprise et arrêt ;
- ses volumes, sa sauvegarde et sa restauration lorsqu'il conserve des données ;
- le propriétaire de chaque action entre Surplasse et `vps-infra`.

Un outil local ou de CI indique explicitement qu'il est absent du VPS. Mailpit, mkcert, dnsmasq, Playwright et Allure ne deviennent jamais des services de production.

## Principes d'exploitation

Surplasse est exploité par une seule personne. L'architecture privilégie donc peu de pièces mobiles, des preuves reproductibles et une autorité bornée.

- **Une seule production logique.** Cloudflare fournit le bord et les statiques. Atlas fournit Quarkus, PostgreSQL, les secrets, les sauvegardes et l'observabilité. `vps-infra` porte l'état désiré des deux plateformes.
- **Des sources immuables.** Le dépôt produit un manifeste statique lié au commit, les images, `vps-integration` et `application-release` par digest. `vps-infra` porte l'admission et l'activation.
- **Aucun secret dans Git.** Les secrets sont matérialisés par fichiers protégés sur Atlas et leurs copies maîtresses restent dans le gestionnaire de mots de passe.
- **Pas de preuve par implication.** Une CI verte prouve le producteur. Seules la version Worker active, la convergence Atlas, la santé des conteneurs et les sondes publiques prouvent la production.

Les dépendances externes restent Stripe pour le paiement, l'API OpenAI derrière l'interface du domaine `generation`, un relais SMTP transactionnel géré à qualifier et GitHub pour le code, la CI et le miroir documentaire Pages.

## Inventaire de production

| Composant | Propriétaire | Rôle | Exposition |
|---|---|---|---|
| DNS, TLS et Routes Worker | Cloudflare, état désiré `vps-infra` | Bord public, wildcard et activation | Ports 80 et 443 du réseau Cloudflare |
| Worker `surplasse-edge` | Candidat Surplasse, activé par `vps-infra` | Routage par nom d'hôte, gardes et relais API | Apex et wildcard |
| Onboarding | Workers Static Assets | Vitrine et embarquement | `surplasse.com` |
| Commande | Workers Static Assets | Mini-site, carte, commande et paiement | `{slug}.surplasse.com` |
| Dashboard | Workers Static Assets | Connexion, suivi SSE et gestion des commandes | `dashboard.surplasse.com` |
| Documentation | Workers Static Assets | Nimbus canonique | `docs.surplasse.com` |
| Caddy | Atlas | Proxy d'origine et retour statique pendant la migration | Cloudflare Tunnel à la cible |
| Backend | Release Surplasse | API REST, métier, SSE et intégrations | `api.surplasse.com` via Worker et Tunnel |
| Migrateur | Release Surplasse, exécuté par Atlas | Flyway avant le Backend | Aucun port, réseau base uniquement |
| Bootstrap pilote | Release Surplasse, exécuté par Atlas | Graphe initial des testeurs | Aucun port, profils et réseaux bornés |
| PostgreSQL | Atlas | Base unique et historique Flyway | Réseau interne uniquement |
| Prometheus et Grafana | Atlas | Collecte et tableau de bord | Aucun DNS public, Grafana par tunnel privé |
| Surveillance fonctionnelle | GitHub Actions ou poste d'exploitation | Smokes Playwright et rapport Allure | Extérieure au VPS |

Le module Maven `identity` est compilé dans le Backend et n'a aucun processus propre. Le stockage objet R2 n'est pas encore un service actif et aucun contenu média de production n'existe.

GitHub Pages publie la préfiguration statique canonique de l'Onboarding, les ressources de marque, la documentation Nimbus sous `/docs/` et le rapport E2E development sous `/local-tests/`. Il reste un site de démonstration et ne remplace aucune Route Worker ni aucune origine Atlas.

## Cycle de vie des composants Surplasse

Le candidat Cloudflare assemble quatre builds statiques et un Worker dans un manifeste lié au commit. Il ne conserve aucune donnée. Pendant la migration, les cinq images applicatives Atlas restent construites et liées par digest dans l'`application-release` afin de préserver le retour arrière.

Le Backend exige PostgreSQL, les clés JWT, Stripe et le SMTP par fichiers de secrets. Atlas exécute d'abord le job de migration avec `surplasse_migrator`, prouve Flyway V1 à V15, puis démarre le Backend avec `surplasse_runtime` et les migrations automatiques désactivées. Il n'existe aucune opération propre au module `identity`.

Onboarding, Commande, Dashboard et la documentation sont des fichiers statiques servis par Workers Static Assets à la cible. Node, Vite, TypeScript, Wrangler, Vitest et les outils CSS restent dans les étapes de build. Leur mise à jour produit un nouveau candidat et un nouveau manifeste. Leur retour arrière ne demande aucune restauration de données.

La construction locale et les commandes de vérification sont documentées dans [Développement](../developpement/index.md). Le bord suit le [runbook Cloudflare](migration-cloudflare.md). Le coeur suit le [runbook Atlas](deploiement-compose.md).

## Topologie hybride cible

```text
                         Internet
                            |
                  +---------+---------+
                  | Cloudflare Worker |
                  +----+---------+----+
                       |         |
          +------------+         +----------------+
          v                                       v
   +---------------+                         +---------+
   | Static Assets |                         | Tunnel  |
   | quatre sites  |                         +----+----+
   +---------------+                              |
                                                  v
                                           +-------------+
                                           | Caddy Atlas |
                                           +------+------+
                                                  |
                                                  v
                                            +-----------+
                                            |  Backend  |
                                            +-----+-----+
                                                  |
                                                  v
                                            +------------+
                                            | PostgreSQL |
                                            +------------+
```

Cloudflare est le seul bord public à la cible. Tunnel ouvre une connexion sortante depuis Atlas et Caddy reste privé. Le Backend est le seul service applicatif qui joint PostgreSQL. Prometheus collecte le Backend, jamais l'inverse. Grafana n'a aucune route publique. Les appels vers Stripe et le SMTP sortent du Backend.

## Le VPS Atlas

Ubuntu LTS fait foi. Atlas est hébergé chez OVHcloud et son exploitation système appartient à `vps-infra` : accès SSH par clé, pare-feu, Docker, Caddy, mises à jour et contrôleur de déploiement. Aucun runtime Surplasse n'est installé directement sur l'hôte.

Le dimensionnement initial est volontairement modeste. Le premier levier de croissance est vertical. Tout nouveau service doit justifier son coût d'exploitation avant d'entrer sur le VPS.

## Sauvegardes

PostgreSQL est le seul état métier actuel. Pour la phase MVP testeurs, un dump conservé sur le VPS ne bloque ni la production ni l'ouverture des commandes. Cette dette doit être rappelée à chaque point d'ouverture.

Avant l'ouverture publique, le régime obligatoire est :

| Quoi | Fréquence | Preuve attendue |
|---|---|---|
| Dump PostgreSQL chiffré | Quotidienne | Fichier horodaté et contrôlé |
| Copie hors VPS | Quotidienne après le dump | Copie hors Atlas et hors du même risque d'hébergement |
| Restauration isolée | Trimestrielle | Application saine, Flyway V15 et cohérence métier prouvés |
| Contenu objet, après son ajout | Selon sa criticité | Copie hors VPS et procédure de restitution |

Les volumes Prometheus et Grafana sont reconstructibles et ne rejoignent pas la sauvegarde métier du MVP. Une sauvegarde non restaurée n'est pas une preuve.

## Gestion des incidents en solo

L'ordre de rétablissement est fixé :

1. Commande, Backend et Stripe ;
2. Dashboard ;
3. Onboarding ;
4. documentation et surfaces secondaires.

La reprise s'appuie sur trois gestes : mettre la prise de commandes à `paused` si l'API reste disponible, publier une release descendante qui corrige la panne, puis laisser Atlas la migrer et la réconcilier. Une restauration de données reste une opération planifiée distincte. Une migration n'est jamais annulée automatiquement et le runtime précédent ne redémarre que si sa compatibilité de schéma est attestée.

Chaque incident notable produit une note courte : cause, détection, correction et prévention. Les règles Prometheus ne notifient personne tant qu'un canal d'alerte n'est pas raccordé. Cet écart reste obligatoire à fermer avant l'ouverture publique.
