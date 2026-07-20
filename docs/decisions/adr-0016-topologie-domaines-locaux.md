---
label: "ADR-0016 : Domaines locaux"
order: 160
icon: law
description: "Pourquoi le développement reproduit les domaines de production avec dnsmasq, mkcert, Caddy et surplasse.test."
---

# ADR-0016 : Topologie des domaines locaux

## Statut

Accepté, 2026-07-19.

## Contexte

Surplasse route plusieurs applications par nom d'hôte. Le domaine racine sert l'Onboarding, `api` sert le Backend, `dashboard` sert le Dashboard et chaque autre sous-domaine valide peut identifier un établissement dans Commande. Tester seulement avec des ports `localhost` masque donc des comportements essentiels : extraction du `slug`, cookies `Secure`, CORS, redirections, en-têtes de proxy et URL placée dans un QR code.

Le nombre de mini-sites n'est pas borné. Ajouter chaque établissement dans `/etc/hosts`, dans un certificat ou dans la configuration du reverse proxy rendrait la création locale différente de la production. Le développement doit accepter immédiatement tout sous-domaine direct valide.

La solution reste un outillage de poste de travail. Elle ne doit ni remplacer le Caddy de production, ni introduire une troisième configuration métier, ni partager les cookies restaurateur avec les mini-sites.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Ports `localhost` seulement | Aucun logiciel système supplémentaire | Ne teste ni les sous-domaines, ni le HTTPS réel, ni les cookies et redirections de production |
| Entrées manuelles dans `/etc/hosts` | Mécanisme connu, aucune résolution DNS locale à maintenir | Pas de wildcard, opération manuelle pour chaque établissement, certificat et routage faciles à désynchroniser |
| Domaine spécial `localhost` avec certificat interne Caddy | Résolution souvent fournie par le navigateur, configuration courte | Comportement variable selon le système, confiance propre à Caddy, nom différent de la structure publique attendue |
| **`surplasse.test`, dnsmasq, mkcert et Caddy** | Wildcard DNS, certificat reconnu localement, routage fidèle, outils explicites et remplaçables | Installation système et autorisations administrateur nécessaires sur le poste |

## Décision

Nous retenons `surplasse.test` comme domaine racine local et `surplasse.com` comme domaine racine de production. Les deux environnements consomment la même liste de variables publiques, avec des valeurs distinctes conservées dans `config/domains/`.

En local, dnsmasq résout `surplasse.test` et tous ses sous-domaines directs vers `127.0.0.1`. Sur macOS, une instance isolée écoute sur un port non privilégié et `/etc/resolver/surplasse.test` lui délègue uniquement cette zone. Aucune entrée par restaurant n'est ajoutée à `/etc/hosts`.

mkcert crée l'autorité de développement approuvée par le poste et un certificat contenant deux noms : `surplasse.test` et `*.surplasse.test`. Le certificat, sa clé privée et l'autorité locale restent hors de Git. Let's Encrypt reste réservé à la production.

Caddy termine le HTTPS local sur la boucle locale et route les noms d'hôte vers les ports de développement. Les noms `www`, `api`, `dashboard`, `docs`, `local`, `mail`, `app` et `admin` sont réservés. `app` et `admin` ne désignent aucune application actuelle et répondent explicitement comme services non implémentés. Tout autre sous-domaine direct valide est transmis à Commande, qui en extrait le `slug` à partir de `APP_BASE_DOMAIN`.

Les ports de développement sont des destinations privées de Caddy, pas des URL applicatives alternatives. Toute navigation, redirection, origine CORS, URL générée et base de test de bout en bout vient du profil central et utilise HTTPS sous `surplasse.test`. Les surfaces locales refusent un accès navigateur direct par `localhost`, `127.0.0.1` ou `::1`. La boucle locale reste limitée aux adresses d'écoute, aux reverse proxies, aux sondes techniques et aux dépendances non HTTP destinées aux outils de développement.

Un cockpit Node réservé au développement expose l'inventaire des URL et leur état. Il peut lancer et arrêter une liste fixe de modules sans privilège administrateur. Il ne pilote jamais Caddy, dnsmasq ou mkcert et ne peut arrêter qu'un processus qu'il a lui-même lancé.

Les cookies restaurateur restent hôte uniquement sur l'API, sans attribut `Domain`. `COOKIE_DOMAIN` reste vide dans la configuration publique. Cette absence est volontaire : partager `.surplasse.test` ou `.surplasse.com` exposerait la session de l'API à tous les mini-sites.

Le CORS suit la même frontière. Quarkus autorise l'apex et les sous-domaines directs comme origines publiques, sans credentials dans aucun profil. Caddy est le seul composant autorisé à ajouter `Access-Control-Allow-Credentials: true`, après une comparaison exacte de `Origin` avec les URL canoniques du Dashboard ou de l'Onboarding. Un mini-site conserve donc l'accès aux routes publiques sans pouvoir lire une réponse authentifiée. Le Caddy de production devra reprendre cette règle lors de son provisionnement.

## Conséquences

### Positives

- Un établissement tel que `restaurant-invente.surplasse.test` fonctionne sans modifier DNS, certificat, Caddy ou `/etc/hosts`.
- Les parcours locaux exercent HTTPS, HMR sécurisé, CORS, cookies, redirections et en-têtes de proxy dans une topologie proche de la production.
- Les URL publiques et générées dépendent de variables communes, pas d'un suffixe `.com` codé dans la logique métier.
- Le cockpit rend l'état de la pile visible et évite de rechercher manuellement quel port ou module manque.
- La zone dnsmasq et l'instance Caddy sont limitées à Surplasse et à la boucle locale.

### Négatives et dettes assumées

- Le premier setup macOS installe trois logiciels et demande une interaction administrateur pour le trousseau, le résolveur système et le port HTTPS.
- Le navigateur Windows ne partage pas automatiquement la résolution DNS ni la confiance mkcert de WSL2. La documentation impose une configuration complémentaire sur l'hôte Windows.
- Un certificat wildcard ne couvre qu'un niveau. Les mini-sites utilisent donc un sous-domaine direct, jamais `table.restaurant.surplasse.test`.
- Le cockpit conserve la propriété des processus uniquement en mémoire. Après son arrêt, un processus lancé hors de lui est traité comme externe et ne peut pas être arrêté depuis l'interface.
- La configuration Caddy locale ne vaut pas configuration de production. Le défi DNS-01, HSTS, les images statiques et le cycle de vie Ubuntu restent à fournir avec la pile VPS.
