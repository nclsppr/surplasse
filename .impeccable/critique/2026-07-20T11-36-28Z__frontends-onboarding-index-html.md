---
target: homepage Onboarding Surplasse
total_score: 20
p0_count: 0
p1_count: 4
timestamp: 2026-07-20T11-36-28Z
slug: frontends-onboarding-index-html
---
## Santé du design

| # | Heuristique | Score | Point principal |
|---|---|---:|---|
| 1 | Visibilité de l'état du système | 2/4 | Le statut pilote est clair, mais la configuration du lien de connexion reste silencieuse. |
| 2 | Correspondance avec le monde réel | 3/4 | Le vocabulaire restaurant est concret, avec quelques termes encore techniques. |
| 3 | Contrôle et liberté | 3/4 | Le parcours ne piège pas, mais la navigation disparaît sur mobile. |
| 4 | Cohérence et standards | 2/4 | Cinq formulations différentes ouvrent la même démonstration. |
| 5 | Prévention des erreurs | 2/4 | Les limites de la démonstration sont dites, mais la promesse initiale reste trop large. |
| 6 | Reconnaissance plutôt que mémorisation | 2/4 | Les faux cadres ne fournissent aucune preuve produit reconnaissable. |
| 7 | Flexibilité et efficacité | 2/4 | Les ancres aident sur desktop, mais le bouton mobile ne mesure que 32 px. |
| 8 | Esthétique et minimalisme | 2/4 | La marque est distinctive, la structure de landing page reste trop répétitive. |
| 9 | Reconnaissance et récupération des erreurs | 1/4 | Aucun chemin d'aide ou de récupération visible. |
| 10 | Aide et documentation | 1/4 | Aucun point de contact ni explication contextuelle approfondie. |
| **Total** | | **20/40** | **Fondation acceptable, améliorations significatives nécessaires.** |

## Verdict sur les anti-patterns

La palette n'est pas le problème. L'orange, le paprika, la cannelle, l'espresso, les angles nets, Archivo et le mot-symbole Parisienne créent une base bistro identifiable.

Le risque de rendu généré vient de la structure : six petits labels monospace en capitales, deux cadres rayés contenant des notes internes, trois cartes de processus identiques, des titres orange traités de la même façon à chaque section et cinq appels à l'action différents vers une seule destination.

Le détecteur a retourné trois résultats bruts : deux faux positifs sur le nombre de polices et la hiérarchie typographique, puis un conseil exploitable sur les marqueurs 01, 02 et 03. Ces nombres décrivent bien une séquence réelle, mais leur présentation en trois cartes identiques participe à la répétition.

La preuve navigateur n'a pas pu être produite pendant les deux évaluations indépendantes car aucune surface navigateur n'était disponible dans leurs environnements. Le déploiement et ses ressources ont néanmoins répondu en HTTP 200, les ancres sont résolues et la validation sémantique ne retourne aucune erreur lorsque les règles purement stylistiques sont désactivées.

## Impression générale

La marque a une voix, mais la page ne prouve pas encore le produit. L'opportunité principale est de transformer les faux emplacements de capture en artefacts réels de Commande et du Dashboard, puis de laisser ces artefacts rythmer la page.

## Ce qui fonctionne

- La tarification est exacte et les frais Stripe sont explicitement séparés.
- Le vocabulaire de salle, de table, de paiement et de cuisine rend la proposition concrète.
- Le système couleur, la géométrie presque carrée, le mot-symbole et les contrastes constituent une base solide à préserver.

## Problèmes prioritaires

### P1 : faux visuels de production

Les cadres rayés affichent des notes internes là où le visiteur attend une preuve. Ils doivent être remplacés par des surfaces produit authentiques, sans photographie générée.

### P1 : intention de conversion incohérente

Les variantes « tester », « explorer » et « essayer » décrivent comme différents des liens qui ouvrent tous la même démonstration. Un seul libellé honnête doit être réutilisé, accompagné de la durée, du traitement local de la photo et de l'absence de publication.

### P1 : grammaire de landing page répétitive

La succession systématique label, titre orange, texte et carte affaiblit la personnalité. Il faut conserver les ingrédients de marque tout en variant le rythme : moins de labels, un processus continu, une section en aplat cannelle et des surfaces produit comme preuves.

### P1 : confiance trop tardive

« Pas une marketplace » répond à l'objection principale du restaurateur mais arrive presque à la fin. La propriété de la relation client et la tarification doivent apparaître ensemble dès le premier écran ou juste après.

### P2 : ergonomie mobile

Le bouton visible dans l'en-tête mesure 32 px et les ancres disparaissent. Les cibles principales doivent atteindre 44 px et le parcours mobile doit garder un accès simple aux sections importantes.

## Signaux par persona

### Jordan, première visite

Les libellés de démonstration semblent décrire plusieurs actions. Les faux visuels font croire à un site inachevé et aucun point d'aide n'est proposé.

### Riley, test des limites

La promesse « une photo suffit » paraît plus large que la simulation réelle. L'absence de chemin de récupération et de preuve produit fragilise la confiance.

### Casey, mobile et distraite

La navigation disparaît, le bouton d'en-tête est trop petit et la preuve utile se trouve sous un premier écran très textuel.

### Marco, restaurateur indépendant

Le tarif et l'absence de marketplace répondent à ses objections, mais il ne voit ni transformation de carte, ni durée, ni résultat concret avant de cliquer.

## Observations secondaires

- Le mot-symbole de l'en-tête devrait être un lien vers l'accueil.
- L'orange reste réservé aux grands textes, le paprika porte les actions accessibles.
- Space Mono doit rester un accent opérationnel et ne pas devenir la voix de chaque section.
- Le footer reste trop léger pour une surface commerciale, sans inventer de liens juridiques ou de contact indisponibles.

## Questions à garder ouvertes

- Quelle preuve doit convaincre en premier : la carte client, le flux cuisine ou l'économie face aux marketplaces ?
- Le statut pilote est-il une note de transparence ou le récit principal de la page ?
- Quel résultat concret peut clore la page sans répéter une sixième fois le même appel à la démonstration ?
