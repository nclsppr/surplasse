---
label: "ADR-0042 : Noms réservés sous le wildcard"
order: 420
icon: law
description: "Pourquoi les noms techniques et de messagerie restent exclus des slugs et fermés au bord sous le wildcard public."
---

# ADR-0042 : noms de service réservés sous le wildcard public

## Statut

Accepté, 2026-08-18.

## Contexte

Commande sert chaque établissement sur un sous-domaine direct. Un enregistrement
DNS wildcard dirige donc tout label qui ne possède pas de record plus précis vers
le bord public. Cette règle couvre aussi des noms techniques couramment découverts par les
clients de messagerie, même quand Surplasse ne publie aucun service correspondant.

Laisser ces noms atteindre le handler générique de Commande donnerait à un nom de
service la sémantique d'un établissement. Créer une exception DNS pour chaque nom
ferait diverger la production du profil local et alourdirait chaque bascule de zone.
La réservation doit rester une donnée publique commune aux frontends, au Backend et
aux routeurs de bord.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Transmettre tout label inconnu à Commande | Configuration minimale | Un nom de messagerie ou d'exploitation peut être interprété comme un établissement |
| Créer une exception DNS pour chaque nom technique | Le nom peut rester sans réponse A | Inventaire de zone plus fragile, comportement différent en local, nouvelle mutation DNS pour chaque ajout |
| Étendre la liste réservée commune et fermer ces hôtes au bord | Même règle dans les deux profils, aucun faux établissement, évolution versionnée avec les images et la route | Le wildcard DNS continue à résoudre ces noms et le bord HTTPS reçoit les connexions |

## Décision

Nous étendons `RESERVED_SUBDOMAINS` avec `autoconfig`, `autodiscover`,
`mta-sts`, `smtp`, `imap`, `pop`, `pop3`, `webmail` et `status`. Ces noms
s'ajoutent aux applications explicites et aux noms d'infrastructure déjà réservés.
Ils ne peuvent jamais devenir des slugs d'établissement.

Caddy en développement et le Worker Cloudflare à la cible traitent les applications publiques avant le matcher réservé. Tout nom réservé
sans service public répond 503 et n'atteint jamais Commande. La même liste alimente
les profils `development` et `production`, le Backend et les builds frontend. Un
wildcard DNS peut donc résoudre un nom réservé sans lui donner une fonction métier.

Cette décision ne crée aucun service de messagerie sur Atlas. Les MX de
`surplasse.com` restent chez leur fournisseur actuel. Aucun port SMTP, IMAP ou POP
n'est publié par le bord Surplasse.

## Conséquences

### Positives

- les noms de découverte automatique et de transport ne peuvent pas devenir des établissements ;
- le comportement local et le comportement public restent alignés ;
- la bascule DNS conserve un wildcard unique sans créer une série d'exceptions fragiles ;
- une future surface `status` peut être ajoutée sans migrer un slug déjà attribué.

### Négatives et dettes assumées

- les noms réservés résolvent vers le bord tant que le wildcard public existe ;
- un client qui tente HTTPS sur un nom technique reçoit une réponse Surplasse 503 ;
- publier ultérieurement un vrai service sous l'un de ces noms exigera une route explicite avant le matcher réservé.
