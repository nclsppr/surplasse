---
label: "ADR-0044 : frontends canoniques uniques"
order: 440
icon: law
description: "Pourquoi Surplasse retire les variantes UI2 et limite chaque dépendance CSS aux applications qui la consomment réellement."
---

# ADR-0044 : frontends canoniques uniques et CSS par usage

## Statut

Accepté, 2026-08-23.

Remplace l'[ADR-0012](adr-0012-tailwind-shadcn.md) et l'[ADR-0033](adr-0033-frontends-alternatifs-untitled-ui.md). Les tokens de marque, les primitives accessibles déjà utiles et les trois applications définies par l'[ADR-0004](adr-0004-trois-frontends-react.md) restent inchangés.

## Contexte

L'expérience UI2 a permis de comparer une seconde direction sur Onboarding, Commande et Dashboard sans exposer ces variantes en production. Elle a aussi créé quatre packages, des images, des routes locales, des jobs CI et des démonstrations Pages. Cette surface dépasse vingt-cinq mille lignes suivies alors que les trois applications canoniques restent les seules routes produit et les seules images du VPS.

Le Dashboard canonique charge par ailleurs Tailwind CSS et son plugin Vite sans employer de classe utilitaire. Ses styles sont déjà écrits en CSS nommé. Maintenir un outil de transformation inutilisé augmente le graphe de dépendances sans réduire le code applicatif.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Maintenir les deux familles de frontends | Comparaison toujours disponible | Parité, dépendances, CI et documentation doublées sans chemin de promotion décidé |
| Promouvoir UI2 | Une seule direction après migration | Parité incomplète de l'Onboarding et migration sans preuve suffisante |
| Retirer UI2 et conserver les applications canoniques | Chemin produit unique, CI plus courte, aucune migration de données | La comparaison publique disparaît |

## Décision

Nous retirons `frontends/design-system2/`, `frontends/onboarding2/`, `frontends/commande2/` et `frontends/dashboard2/`. Leurs routes Caddy, services Compose, images, commandes, contrôles CI et démonstrations Pages disparaissent dans la même révision. Cette opération applique la procédure d'arrêt prévue par l'ADR-0033 et ne demande aucune migration du Backend ou des données.

Onboarding, Commande et Dashboard restent les seules implémentations maintenues. Une nouvelle exploration visuelle commence par une preuve bornée. Elle ne duplique un parcours complet qu'après avoir défini ses critères de promotion ou d'arrêt.

Les tokens de marque restent partagés. Une application ajoute Tailwind, shadcn/ui, Radix ou une autre dépendance visuelle seulement lorsqu'elle en consomme effectivement les capacités. Commande conserve Tailwind parce qu'elle emploie ses classes utilitaires. Le Dashboard conserve son CSS nommé et retire Tailwind tant qu'aucune utilité mesurée ne le justifie.

## Conséquences

### Positives

- les routes produit, les builds de revue et le code maintenu désignent la même famille d'interfaces ;
- les corrections fonctionnelles ne doivent plus être reproduites dans une variante ;
- la CI et GitHub Pages ne construisent plus quatre packages facultatifs ;
- chaque dépendance CSS correspond à un usage visible dans son application.

### Négatives

- les démonstrations UI2 publiées disparaissent au prochain déploiement Pages ;
- toute reprise de cette direction repart d'une preuve ciblée plutôt que du code retiré ;
- les applications peuvent employer des techniques CSS différentes lorsque leurs besoins diffèrent.
