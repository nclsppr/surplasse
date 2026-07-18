---
label: "ADR-0006 : SSE pour le temps réel"
order: 60
icon: law
description: "Pourquoi Surplasse retient les Server-Sent Events pour le flux des commandes du Dashboard et le suivi de commande du client, plutôt que WebSockets ou du polling."
---

# ADR-0006 : SSE pour le temps réel

## Statut

Accepté, 2026-07-18.

## Contexte

Deux parcours exigent du temps réel :

| Besoin | Application | Sens du flux | Exigence |
|---|---|---|---|
| Flux des commandes d'un établissement | Dashboard | Serveur vers client | Une commande payée apparaît en salle en quelques secondes, sans rechargement |
| Suivi de commande | Commande | Serveur vers client | Le client voit l'état de sa commande évoluer (payée, acceptée, en préparation, prête) sur son téléphone |

Le point structurant : **le besoin est strictement unidirectionnel, du serveur vers le client**. Les actions, elles, remontent par l'API REST classique décrite dans [le contrat](../architecture/api.md) : le client crée sa commande par un `POST`, le restaurateur change un statut par un `POST` depuis le Dashboard. Aucun parcours du MVP n'exige un canal montant persistant. Analyser les parcours (voir [le parcours de commande du client](../produit/parcours/commande-client.md) et [le parcours du restaurateur au Dashboard](../produit/parcours/dashboard-restaurateur.md)) confirme que le navigateur n'a jamais rien à pousser en continu vers le serveur : il agit ponctuellement, puis attend d'être notifié.

Les contraintes d'environnement pèsent aussi :

- le front Commande tourne sur des téléphones, derrière des réseaux mobiles instables et des proxys divers ; les coupures et reconnexions sont la norme, pas l'exception ;
- le Dashboard tourne en salle, souvent sur un réseau Wi-Fi partagé, et doit retrouver son flux seul après une microcoupure, sans intervention du restaurateur en plein service ;
- le backend est du Quarkus derrière le reverse proxy du VPS ; tout protocole exotique est une configuration de plus à maintenir ;
- l'équipe est réduite : chaque mécanisme d'infrastructure supplémentaire a un coût d'exploitation récurrent.

La question à trancher : quel transport pour pousser ces événements vers les navigateurs ?

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **SSE (Server-Sent Events)** | Conçu pour l'unidirectionnel serveur vers client ; du HTTP standard, qui traverse proxys et reverse proxys sans protocole particulier ; reconnexion automatique native dans le navigateur, avec reprise via `Last-Event-ID` ; simple à servir depuis Quarkus avec Mutiny (un flux `Multi` d'événements) | Pas de canal montant ; limite de connexions simultanées par domaine en HTTP/1.1 |
| **WebSockets** | Bidirectionnel, latence minimale ; adapté aux usages interactifs denses | Upgrade de protocole à faire passer par le reverse proxy ; reconnexion, keep-alive et reprise d'état à écrire soi-même ; puissance inutile pour un besoin purement descendant ; surface d'exploitation et de test plus large |
| **Polling court** | Trivial à implémenter, aucun état côté serveur | Latence perçue (le « temps réel » devient un intervalle) ; charge inutile de requêtes à vide sur le backend et la base ; consommation réseau et batterie côté téléphone client |

Le critère décisif est l'adéquation au besoin : les trois options savent techniquement livrer un événement à un navigateur, mais une seule est dimensionnée exactement pour un flux descendant sur du HTTP ordinaire. SSE offre en standard ce que WebSockets obligerait à réécrire (reconnexion, reprise) et ce que le polling ne peut offrir du tout (la latence d'une notification poussée).

## Décision

Surplasse retient **SSE, servi nativement par Quarkus avec Mutiny**, comme unique transport temps réel du MVP.

Le backend expose deux flux :

| Flux | Consommateur | Portée | Contenu |
|---|---|---|---|
| Commandes d'un établissement | Dashboard | Un établissement, restaurateur authentifié | Nouvelles commandes, changements de statut, annulations |
| État d'une commande | Commande (mini-site) | Une seule commande, accès par jeton porté par l'URL de suivi | Changements de statut de cette commande |

Chaque événement porte un nom de type et un identifiant d'événement, ce qui permet au navigateur de reprendre le flux après une coupure en renvoyant `Last-Event-ID`. Le backend rejoue alors les événements manqués depuis cet identifiant. Toutes les actions restent sur l'API REST : le temps réel ne transporte que des notifications d'état, jamais des commandes au sens applicatif.

Les deux flux sont décrits dans [le contrat](../architecture/api.md) au même titre que les endpoints REST : noms d'événements, schémas de payloads et règles d'autorisation y font foi. Le flux du Dashboard est protégé par l'authentification restaurateur (magic link, session) ; le flux de suivi client ne demande aucun compte, conformément au principe que le client n'a jamais de compte, mais reste limité à la seule commande concernée.

```
Client (Commande)              backend Quarkus                Dashboard
      |                              |                            |
      | POST /commandes  (REST)      |                            |
      |----------------------------->|                            |
      |                              |  event: commande.creee     |
      |                              |  (SSE) -------------------->|
      |                              |                            |
      |                              |   POST .../statut  (REST)  |
      |                              |<---------------------------|
      |  event: commande.statut      |                            |
      |<---------------------- (SSE) |                            |
      |                              |                            |
   coupure reseau                    |                            |
      |  GET flux + Last-Event-ID    |                            |
      |----------------------------->|                            |
      |  rejeu des evenements manques|                            |
      |<-----------------------------|                            |
```

Les deux autres options sont écartées explicitement :

- **Le polling court est écarté.** La latence perçue et la charge de requêtes à vide sont incompatibles avec un flux de commandes en salle : soit l'intervalle est court et le backend encaisse un trafic inutile permanent, soit il est long et le restaurateur découvre les commandes en retard. Le polling reste toutefois le comportement de repli acceptable côté client si un flux SSE ne peut s'établir.
- **Les WebSockets sont écartés au MVP.** Leur complexité (upgrade de protocole à travers le reverse proxy, reconnexion et reprise d'état à écrire soi-même, tests plus lourds) n'est justifiée par aucun besoin bidirectionnel avéré. Ce choix sera réévalué si un tel besoin apparaît, par exemple une interaction continue entre le Dashboard et un périphérique en cuisine (voir la ligne impression thermique de la [roadmap](../roadmap.md), qui fera l'objet de son propre ADR).

!!! info Périmètre de l'ADR
Cet ADR fixe le transport. Le format détaillé des événements (noms, payloads, versionnement) relève [du contrat](../architecture/api.md) et de [l'architecture du backend](../architecture/backend.md) ; la politique de rétention des événements pour le rejeu reste à trancher lors de la conception du flux.
!!!

## Conséquences

### Positives

- Le transport traverse l'infrastructure existante : du HTTP ordinaire à travers le reverse proxy, sans upgrade de protocole. Seule précaution : désactiver la mise en tampon des réponses sur les routes de flux.
- La reconnexion est fournie par le navigateur : `EventSource` retente seul et renvoie `Last-Event-ID`, il n'y a pas de logique de reconnexion à écrire ni à maintenir côté front.
- L'implémentation côté Quarkus reste petite : un flux Mutiny par besoin, testable comme n'importe quelle ressource REST.
- La frontière des responsabilités est nette : REST pour agir, SSE pour être notifié. Le raisonnement sur la sécurité et l'idempotence reste celui de l'API classique.

### Négatives et dettes assumées

- En HTTP/1.1, le navigateur limite les connexions simultanées par domaine (six en pratique), ce qui peut bloquer un onglet Dashboard multiplié. La mitigation est d'activer HTTP/2 sur le reverse proxy, où le multiplexage lève la limite ; cette activation fait partie de la configuration cible de l'infrastructure.
- Pas de canal montant : toute interaction future en aller-retour continu imposera de rouvrir la question WebSockets. C'est un choix assumé, consigné ici pour être réévalué sur un besoin réel et non par anticipation.
- Le rejeu après reconnexion suppose une rétention des événements côté backend (identifiants ordonnés, tampon borné). Cette rétention reste à concevoir ; sans elle, une reconnexion tardive impose un rechargement complet de l'état via REST, comportement de repli qui doit rester correct.
- Les connexions longues occupent des ressources serveur : l'implémentation doit rester réactive (Mutiny, pas de thread bloqué par connexion), émettre un battement de cœur périodique pour détecter les connexions mortes, et fermer les flux inactifs (un suivi de commande n'a plus de raison de rester ouvert une fois la commande servie).

Les signaux qui déclencheront une réévaluation vers WebSockets :

| Signal | Exemple concret |
|---|---|
| Besoin bidirectionnel continu avéré | Pilotage d'un périphérique en cuisine, accusés de réception en flux |
| Fréquence d'événements incompatible avec le modèle notification | Mise à jour collaborative en direct de la carte à plusieurs |

Tant qu'aucun de ces signaux n'existe, SSE reste le seul transport temps réel, et tout nouveau besoin de notification s'ajoute comme un type d'événement sur les flux existants ou comme un nouveau flux SSE.

Décisions liées : [ADR-0004 : trois applications React séparées](adr-0004-trois-frontends-react.md), [ADR-0005 : PostgreSQL comme unique moteur de données](adr-0005-postgresql.md).
