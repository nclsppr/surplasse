---
label: "ADR-0028 : Cockpit Compose et rapports Allure"
order: 280
icon: law
description: Un cockpit local qui pilote uniquement le profil Compose development et publie le dernier rapport Allure local sur une URL canonique.
---

# ADR-0028 : cockpit Compose et rapports Allure

## Statut

Accepté, 2026-07-22.

## Contexte

L'ADR-0016 décrivait un cockpit propriétaire de processus natifs lancés depuis sa mémoire. Depuis, l'ADR-0026 a fait du cluster Docker Compose la preuve locale de la topologie destinée au VPS. Conserver un second cycle de vie pour le Backend, les frontends et les dépendances ferait diverger les commandes, les états de santé et les responsabilités d'arrêt.

L'ADR-0027 a aussi introduit une suite Playwright et un rapport Allure 3 par cible. Le poste local doit pouvoir lancer facilement le smoke `development` et consulter son dernier rapport sans ouvrir une URL loopback. En revanche, choisir une production ou une UAT depuis le navigateur local élargirait inutilement l'autorité du cockpit et risquerait de lancer une vérification sur la mauvaise cible.

Le cockpit reste un outil de développement exécuté sur l'hôte. Il ne doit recevoir ni socket Docker dans un conteneur, ni commande libre, ni sélecteur de profil. Caddy porte son accès HTTPS, ce qui impose aussi de ne pas rendre le service `edge` arrêtable depuis l'interface qu'il dessert.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Conserver la propriété de processus natifs | Boucles à chaud faciles, aucune commande Docker depuis le cockpit | Double cycle de vie, état incomplet du cluster réel, divergence avec la production |
| Exécuter le cockpit dans Compose avec le socket Docker | Déploiement groupé avec les autres services | Le socket donne une autorité très large au conteneur, arrêt de son propre proxy possible, outil local mêlé au graphe déployable |
| Cockpit sur l'hôte avec wrapper Compose et listes fixes | État fidèle au cluster, autorité bornée, réutilisation des commandes versionnées | Docker doit être disponible sur l'hôte et le cluster doit précéder le cockpit |

## Décision

Nous retenons un cockpit Node sur l'hôte, réservé au développement, qui pilote exclusivement le projet Docker Compose nommé par `COMPOSE_PROJECT_NAME` dans le profil de déploiement `development`. Toutes ses lectures et mutations passent par `scripts/compose.sh development`. Le navigateur ne fournit jamais une commande, un chemin, un argument, un service ou un profil.

Le registre associe chaque module pilotable à un service Compose autorisé. Le cockpit lit les états et healthchecks Compose, puis peut appeler seulement `up --detach --build --wait` ou `stop` pour cette liste fixe. Un service démarré depuis un terminal reste donc pilotable depuis le cockpit. La notion de propriété d'un processus natif est supprimée.

Caddy, représenté par le service `edge`, reste visible avec son état Compose et sa sonde HTTPS, mais il est en lecture seule dans le cockpit. dnsmasq et mkcert restent gérés sur l'hôte. Les opérations globales qui retirent le réseau, suppriment les volumes ou réinitialisent les données restent des commandes CLI explicites. Arrêter le cockpit interrompt ses vérifications et son éventuelle commande Compose en cours, sans arrêter les services du cluster.

Le cluster est démarré avant le cockpit avec `npm run local:up`. Cette commande crée le jeton local utilisé entre Caddy et le listener du cockpit. Caddy publie ensuite `LOCAL_CONTROL_URL` et `REPORTS_URL`, toutes deux dérivées du profil central. Aucun accès navigateur par le port interne du cockpit ne devient une URL alternative.

La page de tests expose une seule suite E2E fixe : `npm run e2e:test -- development`. Son lancement exige que Caddy, le Backend, Commande, le Dashboard et l'Onboarding soient sains. Le cockpit ne propose ni `production`, ni `custom`, ni argument libre. Ces cibles restent lancées par la CLI ou par `.github/workflows/e2e.yml`.

Le dernier rapport Allure 3 de la cible `development` est servi en lecture seule sur `REPORTS_URL`. Il reste stocké sur l'hôte sous `.surplasse/e2e/development/`, avec son historique, et n'entre dans aucun conteneur. L'URL de rapports existe seulement dans le profil development et le sous-domaine `reports` reste réservé dans tous les profils. Avant la première génération, cette URL répond qu'aucun rapport n'est disponible. Le workflow Pages publie séparément son propre smoke development de CI sous `/local-tests/`. Il ne lit ni ne synchronise le rapport du poste. Les rapports de production et d'une future UAT restent des artefacts de CI ou des fichiers rejoués par la CLI. Le cockpit ne les synchronise ni ne les publie.

Cette décision remplace les clauses de l'ADR-0016 relatives au cycle de vie et à la propriété des processus dans le cockpit, puis ajoute `reports` aux sous-domaines réservés. Les principes de l'ADR-0016 sur les domaines, dnsmasq, mkcert, Caddy, les cookies et CORS restent applicables.

## Conséquences

Conséquences positives :

- l'interface montre et pilote le même cluster development que les commandes terminal ;
- Caddy reste observable sans pouvoir couper l'accès HTTPS du cockpit depuis lui-même ;
- la suite Playwright locale et son dernier rapport Allure sont accessibles sans paramètre libre ni URL loopback ;
- le rapport development de CI reste public sans élargir l'autorité du cockpit ;
- la production et une future UAT conservent un lancement explicite, traçable par CLI ou CI ;
- le cockpit n'a ni socket Docker monté, ni présence dans la pile de production.

Conséquences négatives et dettes assumées :

- Docker, le plugin Compose et le cluster local doivent être disponibles avant le cockpit ;
- le cockpit ne remplace pas les boucles natives à chaud, qui restent des commandes terminal séparées ;
- `down`, la suppression des volumes et la réinitialisation de PostgreSQL restent volontairement absents de l'interface ;
- le rapport local dépend du processus cockpit et de Caddy pour être consultable par son URL canonique ;
- consulter un rapport CI de production ou d'UAT exige encore de télécharger l'artefact et de le rejouer localement.
