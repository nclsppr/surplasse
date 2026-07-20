---
target: homepage Onboarding Surplasse après amélioration UI Skills
total_score: 28
p0_count: 0
p1_count: 0
timestamp: 2026-07-20T12-03-22Z
slug: frontends-onboarding-index-html
---
## Santé du design après amélioration

| # | Heuristique | Score | Point principal |
|---|---|---:|---|
| 1 | Visibilité de l'état du système | 3/4 | Le statut pilote, les données d'exemple et l'absence de publication sont visibles au moment utile. |
| 2 | Correspondance avec le monde réel | 3/4 | La table, la carte, le ticket cuisine et la commande parlent le langage du restaurant. |
| 3 | Contrôle et liberté | 3/4 | Les sorties, retours et reprises de la démonstration sont explicites. |
| 4 | Cohérence et standards | 3/4 | Un seul appel à l'action et une grammaire Bistro cohérente structurent désormais le parcours. |
| 5 | Prévention des erreurs | 3/4 | Le traitement local, la relecture humaine et l'activation explicite encadrent les promesses. |
| 6 | Reconnaissance plutôt que mémorisation | 3/4 | Des artefacts produit réels remplacent les cadres de remplissage. |
| 7 | Flexibilité et efficacité | 2/4 | Le responsive est robuste, mais la navigation secondaire reste volontairement réduite sous 1100 px. |
| 8 | Esthétique et minimalisme | 4/4 | La palette paprika, cannelle et crème, les angles nets et les trois rôles typographiques forment une identité nette. |
| 9 | Reconnaissance et récupération des erreurs | 2/4 | La démo place le focus et explique les erreurs, sans sauvegarde de progression à ce stade. |
| 10 | Aide et documentation | 2/4 | Les objections principales sont traitées, mais aucun canal de contact ni page juridique réelle n'existe encore. |
| **Total** | | **28/40** | **Direction distinctive et crédible, encore limitée par le statut de prototype.** |

## Verdict sur les anti-patterns

La direction Bistro est préservée. Le bleu pétrole n'est pas revenu et aucune palette de startup générique ne l'a remplacée. Le paprika porte les actions, la cannelle structure les aplats et le brun espresso donne du poids aux preuves produit.

Les marqueurs 01, 02 et 03, les faux cadres rayés, les séries de cartes identiques, les labels répétés et les cinq formulations concurrentes de l'appel à l'action ont disparu. La passe déterministe finale ne retourne aucun anti-pattern sur la landing ni sur la démonstration.

## Impression générale

La page ressemble maintenant à un produit pensé pour la salle et la cuisine, pas à un assemblage de composants de landing page. Le premier écran combine proposition de valeur, preuve produit, tarif exact et propriété de la relation client sans inventer une maturité que le pilote n'a pas encore.

## Ce qui fonctionne

- Le tarif exact apparaît tôt et les frais Stripe restent séparés.
- « Pas une marketplace » est placé à côté de l'économie et de la propriété client.
- La carte Fiorella, le ticket cuisine, le QR de table et l'écran de commandes prouvent le flux sans image générée.
- « Tester la démo » est le seul libellé de conversion.
- Le parcours photo utilise de vrais formulaires, des erreurs reliées aux champs, un focus utile et une progression sémantique.
- Les largeurs 320, 390, 800, 960 et 1440 px restent sans débordement.

## Problèmes restant à traiter

### P2 : preuve encore simulée

Les artefacts sont crédibles mais statiques. Leur mention « Prototype produit, données d'exemple » doit rester jusqu'à ce que le flux backend et Dashboard soit réellement livré.

### P2 : confiance institutionnelle incomplète

Le footer n'invente ni contact, ni mentions légales, ni politique de confidentialité. Ces destinations doivent être ajoutées uniquement lorsqu'elles existent avec un contenu validé.

### P2 : continuité du parcours pilote

La démonstration ne sauvegarde pas la progression et ne traite aucun fichier sur serveur. C'est honnête pour le prototype, mais le vrai onboarding devra gérer reprise, consentement, correction et échec d'extraction.

## Signaux par persona

### Jordan, première visite

La proposition, le coût et l'action principale sont maintenant cohérents. Les preuves donnent un modèle mental avant le clic.

### Riley, test des limites

Les limites du pilote sont visibles et les erreurs de formulaire sont récupérables. La prochaine exigence sera une vraie gestion de l'échec d'extraction.

### Casey, mobile et distraite

La cible principale mesure 44 px, le contenu ne déborde pas et la preuve s'empile à 320 px. La navigation secondaire disparaît pour protéger la lisibilité.

### Marco, restaurateur indépendant

Le tarif, l'absence de marketplace, le QR de table et le ticket cuisine répondent aux objections métier dès les premières sections.

## Observations secondaires

- Le mot-symbole reste un lien de retour à l'accueil et conserve Parisienne.
- Space Mono est limité aux éléments opérationnels et aux preuves de statut.
- L'impression cuisine est présentée comme prévue, pas comme déjà livrée.
- La section de questions traite activation, photo, coût et relation client sans faux accordéon.

## Questions à garder ouvertes

- Quelle preuve issue d'un vrai restaurant pilote pourra remplacer en premier les données Fiorella ?
- Quel canal de contact sera réellement opéré avant de l'ajouter au footer ?
- À quel jalon la landing pourra-t-elle retirer le libellé de prototype sans surpromesse ?
