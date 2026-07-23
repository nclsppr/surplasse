---
label: "ADR-0026 : Compose commun"
order: 260
icon: law
description: Un socle Docker Compose commun au poste local et au VPS, configuré par profils et surcharges explicites.
---

# ADR-0026 : une pile Docker Compose commune

## Statut

Accepté, 2026-07-22.

## Contexte

Surplasse doit reproduire localement la topologie publique par domaines, puis déployer les mêmes composants sur un VPS Ubuntu LTS. Deux infrastructures indépendantes feraient dériver les routes Caddy, les dépendances et les contrôles de santé. Des domaines codés dans les images rendraient en plus un artefact ambigu et risqueraient de mélanger `.test` et `.com`.

Le projet est exploité par une seule personne. La charge du pilote ne justifie ni Kubernetes, ni plusieurs machines, ni plusieurs instances actives du Backend. Le Backend possède encore des états en mémoire, notamment pour certaines limites et connexions SSE. Deux réplicas demanderaient une coordination distribuée qui n'est pas livrée.

Les frontends Commande et Dashboard sont des artefacts statiques Vite. Leurs URL publiques sont intégrées au build. Le Backend relit son profil au démarrage et l'Onboarding reçoit un fichier de configuration généré. Ces différences ne doivent pas créer deux recettes de déploiement ni placer les deux environnements dans une image de production.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Processus natifs en local, Compose seulement en production | Rechargement à chaud immédiat | Deux topologies, deux Caddyfiles, dérive probable avant chaque déploiement |
| Minikube local et Kubernetes en production | API d'orchestration complète, réplication intégrée | Coût d'exploitation disproportionné, état distribué non résolu, VPS simple inutilement complexifié |
| Un Compose commun avec une surcharge par environnement | Même graphe de services, même routage, commandes simples, différences visibles | Reconstruction des fronts par profil, dépendance à Docker pour le cluster d'intégration |
| Installation native Java et Node sur le VPS | Peu de fichiers d'infrastructure | Versions et retours arrière plus fragiles, services système à maintenir, isolation réduite |

## Décision

Nous retenons un fichier `compose.yaml` commun et deux surcharges : `compose.development.yaml` et `compose.production.yaml`. `scripts/compose.sh` sélectionne toujours explicitement `development` ou `production`, charge le catalogue d'images, puis appelle le chargeur central de domaines. Un fichier de secrets ne peut pas redéfinir les variables du profil de domaines.

Le socle commun contient un Caddy de bord, PostgreSQL 17, le Backend et les trois fronts. Caddy est le seul service public. Les trois fronts sont servis en production par NGINX non privilégié. L'Onboarding utilise son serveur Node allowlisté uniquement en développement, où il porte la courte session Stripe test. Mailpit et la documentation statique appartiennent uniquement à la surcharge de développement.

Le profil de développement monte le certificat mkcert et publie seulement le port HTTPS sur la boucle locale. Le profil de production publie 80 et 443, monte les clés JWT et construit Caddy avec le module DNS choisi pour le défi DNS-01. Le choix du fournisseur DNS reste une condition explicite du premier déploiement, jamais une valeur de repli dans le dépôt.

Les images de base sont centralisées dans `config/deployment/images.env` avec un tag lisible et un digest multi-plateforme. Les images applicatives de production portent le SHA git. Les quatre images applicatives sont construites avec un profil explicite et conservent seulement le fichier de domaine utile quand elles en ont besoin à l'exécution. Le profil de construction Backend de production exclut physiquement le seed de démonstration et vérifie son absence dans le JAR. Commande et Dashboard intègrent leur configuration publique par Vite ; l'Onboarding génère son `runtime-config.js` pour ce seul profil. Son Dockerfile choisit ensuite le serveur Node pour l'image development et NGINX pour l'image production. Ces quatre images utilisent exactement les mêmes Dockerfiles dans le cluster local.

Le lancement commence avec un seul conteneur Backend. Une seconde instance ne sera envisagée qu'après externalisation des états partagés, validation des flux SSE derrière plusieurs réplicas et besoin mesuré de disponibilité ou de capacité.

## Conséquences

Conséquences positives :

- le graphe de production est exercé quotidiennement sous `surplasse.test` ;
- les routes, healthchecks, versions de base et dépendances restent communes ;
- le passage de `.test` à `.com` sélectionne un profil au lieu de remplacer des littéraux ;
- une mise à jour et un retour arrière sélectionnent un tag d'image ;
- Minikube et Kubernetes restent hors du périmètre tant que leur coût n'est pas justifié.

Conséquences négatives et dettes assumées :

- le cluster d'intégration reconstruit les fronts et ne fournit pas le rechargement à chaud de Vite ;
- le mode natif reste utile pour une boucle frontend ou Quarkus courte, mais ne constitue plus la preuve de parité de déploiement ;
- les images applicatives de développement et de production sont distinctes afin de ne conserver que leur profil public ;
- le premier déploiement reste bloqué jusqu'au choix du fournisseur DNS, du module Caddy correspondant et du fournisseur SMTP ;
- un seul Backend implique une courte interruption lors d'une recréation de conteneur ;
- PostgreSQL est persistant et exige une sauvegarde hors VPS avant toute production réelle.
