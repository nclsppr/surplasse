---
label: "ADR-0023 : système de logo vectoriel fourni"
icon: law
description: Les quatre SVG fournis deviennent les sources canoniques du logo Surplasse et du symbole central des QR codes.
---

# ADR-0023 : système de logo vectoriel fourni

## Statut

Accepté, 2026-07-21.

## Contexte

L'ADR-0021 avait fixé une première traduction vectorielle de l'identité Surplasse. Elle composait encore certaines signatures dans le DOM avec Bodoni Moda et dessinait une simplification géométrique spécifique pour le centre des QR codes.

Quatre SVG vectoriels finis sont désormais disponibles : un symbole transparent, un mot-symbole, une icône d'application et un logo horizontal. Ils portent les proportions, les tracés et les couleurs définitives de l'identité. Les reproduire ou les recolorer dans les interfaces créerait des variantes non maîtrisées.

Les supports concernés sont hétérogènes : la navigation demande une signature lisible, le favicon une forme carrée, le support de table un mot-symbole compact et le QR code une marque centrale suffisamment petite pour préserver la lecture.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Conserver les SVG et la composition HTML de l'ADR-0021 | Peu de modifications immédiates | Proportions, couleurs et tracés différents de la signature livrée |
| Remplacer seulement le logo horizontal | Mise à jour limitée | Favicons, support de table et QR code restent incohérents |
| Adopter les quatre SVG fournis comme sources canoniques | Une identité exacte et des usages explicites pour chaque format | Les interfaces et les assets dérivés doivent être migrés ensemble |

## Décision

Nous adoptons les quatre SVG fournis comme seules sources canoniques du logo :

- brand/surplasse-logo-horizontal.svg pour les en-têtes, l'identité principale et les écrans où le nom doit être lu ;
- brand/surplasse-app-icon.svg pour les favicons et les icônes d'application ;
- brand/surplasse-wordmark.svg pour les supports imprimés ou compacts qui nécessitent le nom sans pictogramme ;
- brand/surplasse-symbol.svg pour les petits repères de marque et le centre des QR codes.

Les interfaces insèrent les SVG entiers. Elles ne reconstituent plus le mot-symbole avec une police, ne déplacent pas le symbole et ne recolorent pas ses tracés. L'orange #FA550C, l'encre #181818 et l'ivoire #FAF7F2 deviennent les valeurs de référence de la signature.

Le générateur QR rastérise le symbole fourni dans une zone ivoire protégée, avec correction d'erreur haute et modules arrondis. Le logo horizontal ne doit pas être utilisé au centre d'un QR code : son format trop large réduirait la fiabilité de lecture.

## Conséquences

Conséquences positives :

- Les applications, les favicons, les supports de table et la documentation emploient les mêmes tracés.
- Le QR code porte le vrai symbole de marque tout en conservant une zone de lecture sûre.
- Les SVG restent autonomes, nets et indépendants des polices installées chez le visiteur.
- Chaque contexte possède une variante nommée, sans heuristique ni recoloration locale.

Conséquences négatives et dettes assumées :

- Toute évolution future de la marque exige la livraison explicite de ses quatre variantes ou une décision qui redéfinit leur équivalence.
- Le rastériseur QR supporte le sous-ensemble de chemins employé par le symbole fourni. Un SVG de structure différente exigera son adaptation et la régénération des PNG.
- Bodoni Moda reste disponible comme référence typographique, mais elle ne doit plus servir à reconstituer le mot-symbole dans les interfaces.
