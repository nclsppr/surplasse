---
label: "ADR-0021 : identité et logo vectoriel"
icon: law
description: Le symbole table et repère, le mot-symbole Bodoni Moda et leurs variantes deviennent la signature visuelle de Surplasse.
---

# ADR-0021 : identité et logo vectoriel

## Statut

Accepté, 2026-07-20.

## Contexte

L'identité initiale reposait uniquement sur le mot « Surplasse » composé en Parisienne. Cette signature était chaleureuse, mais ne fournissait ni icône d'application distinctive, ni marque compacte pour les favicons et les centres de QR codes. Elle associait aussi le produit et les noms d'établissements à la même écriture.

La nouvelle proposition réunit un repère de localisation, une table et deux chaises. Elle exprime directement la promesse du produit : commander sur place, depuis sa table, par un canal numérique direct. Le lettrage associé est une serif à fort contraste, plus éditoriale que le script initial.

Les assets doivent rester nets à toutes les tailles, fonctionner sur fond clair ou coloré, être utilisables sans service tiers et ne pas dépendre d'une police installée sur la machine du visiteur.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Conserver le mot Parisienne seul | Aucun nouvel asset ni nouvelle police | Pas d'icône distinctive, faible fidélité à la proposition, confusion avec les noms de restaurants |
| Découper directement les planches JPEG | Résultat immédiat et très proche des images reçues | Fond et compression intégrés, mauvaise netteté aux petites tailles, variantes difficiles, texte inaccessible |
| Redessiner le symbole en SVG et composer le mot-symbole en Bodoni Moda | Assets nets, variantes contrôlées, texte web accessible, police auto-hébergée, cohérence avec la direction éditoriale | Une famille de police supplémentaire et plusieurs dérivés à maintenir |

## Décision

Nous retenons un système de logo vectoriel composé du symbole table et repère, accompagné du mot « Surplasse » en Bodoni Moda 400.

La version principale utilise un carré espresso, un symbole ivoire et un point orange. Une variante orange et une version monochrome couvrent les fonds alternatifs et les très petites tailles. `brand/logo.svg` fournit le verrouillage horizontal autonome avec un mot-symbole converti en tracés. Les interfaces composent la même signature avec `.sp-brand`, le symbole SVG et un texte réel en Bodoni Moda auto-hébergée.

Parisienne reste réservée aux noms d'établissements et aux accents éditoriaux. Le centre des QR codes utilise une simplification géométrique du nouveau symbole sur un fond ivoire protégé.

## Conséquences

Conséquences positives :

- Surplasse dispose d'une icône reconnaissable pour les favicons, les applications et les supports imprimés.
- Le logo reste net en SVG et le verrouillage horizontal autonome ne dépend pas des polices du système.
- Le nom Surplasse et les noms de restaurants ont désormais des voix typographiques distinctes.
- Les versions sombre, orange et monochrome couvrent les principaux contextes de contraste.

Conséquences négatives et dettes assumées :

- Bodoni Moda ajoute deux sous-ensembles `woff2` aux assets statiques.
- Le symbole compact des QR doit rester synchronisé avec les SVG de référence lors de chaque évolution.
- Les usages futurs devront choisir explicitement la variante adaptée au fond au lieu de recolorer arbitrairement le logo.
