---
label: "ADR-0024 : deux registres visuels complémentaires"
order: 240
icon: law
description: Le design system distingue le registre de service Surplasse du registre éditorial propre aux établissements.
---

# ADR-0024 : deux registres visuels complémentaires

## Statut

Accepté, 2026-07-21.

## Contexte

La direction « Bistro premium » donne aux cartes et mini-sites une présence chaleureuse, éditoriale et adaptée à la restauration. Appliquée sans distinction à la vitrine Surplasse, au Dashboard et aux écrans opérationnels, elle rend cependant moins visible la promesse centrale du produit : un circuit de commande direct, rapide et fiable.

La vitrine doit attirer l'attention de restaurateurs très sollicités sans imiter une marketplace, un terminal technique ou le décor d'un établissement particulier. Le Dashboard doit partager cette clarté opérationnelle. Les mini-sites, au contraire, doivent continuer à laisser parler l'identité de chaque établissement.

La marque dispose déjà d'éléments stables : les quatre SVG canoniques, l'orange `#FA550C`, Archivo, Space Mono et une géométrie presque droite. Ils permettent de construire un second registre sans créer une nouvelle identité.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Appliquer « Bistro premium » à toutes les surfaces | Système unique, ambiance cohérente | Distinction faible entre la marque produit et les établissements, lisibilité opérationnelle moins directe |
| Remplacer entièrement « Bistro premium » par un brutalisme de service | Signature forte et lisible | Perte de chaleur pour les cartes, rupture avec la personnalisation des établissements |
| Maintenir deux registres dans le même système | Chaque surface exprime son rôle tout en partageant la marque et les tokens | Davantage de règles de composition et nécessité de choisir explicitement le bon scope |

## Décision

Nous retenons deux registres complémentaires dans un design system unique.

Le registre **Service direct**, activé par le scope `.theme-service`, s'applique à la vitrine Surplasse et aux surfaces opérationnelles de la marque. Il utilise des fonds neutres, une encre presque noire, l'orange signature en accent, des bordures nettes, des angles droits, Archivo en casse naturelle pour les grands messages et Space Mono uniquement pour les statuts et métadonnées. Son imagerie principale représente un flux produit réel. Le pixel art reste sémantique, peu animé et compréhensible sans mouvement.

Le registre **Bistro premium** reste la base des cartes, mini-sites et contenus propres aux établissements. Il conserve l'ivoire, les accents éditoriaux, les noms d'établissement en Parisienne et la capacité à recevoir les couleurs extraites pendant l'embarquement.

Les deux registres emploient les SVG canoniques sans recoloration et partagent l'orange de marque, les composants accessibles, les règles de contraste et les états sémantiques. Les marques de paiement restent les assets officiels de leurs propriétaires. Leur taille, leur zone de protection et leur fond peuvent être intégrés à la composition, mais leurs tracés ne sont pas altérés.

## Conséquences

Conséquences positives :

- La vitrine exprime plus clairement le circuit court de la commande.
- Les écrans opérationnels gagnent en densité utile et en hiérarchie.
- Les établissements conservent un espace éditorial chaleureux et personnalisable.
- Les deux registres restent reconnaissables comme Surplasse grâce au logo, à l'orange et à la typographie commune.

Conséquences négatives et dettes assumées :

- Chaque nouvelle surface doit déclarer le registre qu'elle utilise.
- Les composants partagés doivent être vérifiés dans les deux scopes.
- Le passage du Dashboard au registre Service direct devra être progressif pour éviter une migration visuelle sans validation fonctionnelle.
