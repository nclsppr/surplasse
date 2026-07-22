---
label: "ADR-0025 : visuels de plats à la demande"
order: 250
icon: law
description: "Pourquoi Surplasse étend la génération encadrée de visuels de plats à chaque mise à jour de la carte depuis le Dashboard."
---

# ADR-0025 : visuels de plats à la demande

## Statut

Accepté, 2026-07-22. Remplace l'[ADR-0011](adr-0011-visuels-plats.md).

## Contexte

L'ADR-0011 a autorisé la génération de visuels de plats pendant l'embarquement, à partir des seules photos fournies par le restaurateur et sous son contrôle produit par produit. Ce cadre protège les droits sur les images sources et évite de présenter un plat inventé comme une photographie de l'assiette servie.

La carte d'un restaurant évolue après son activation. Le restaurateur ajoute un plat du jour, change une recette, remplace une photo ou retire un produit. Limiter la génération à l'embarquement l'obligerait à solliciter Surplasse pour chaque nouveau visuel, alors que la phase de pilotage doit rendre la gestion de la carte autonome depuis le Dashboard.

Cette extension doit préserver l'image actuellement publiée pendant le traitement, rendre chaque proposition privée jusqu'au choix du restaurateur, et borner le coût d'un usage récurrent de l'API OpenAI. Elle ne change ni le fournisseur retenu par l'[ADR-0010](adr-0010-fournisseur-ia.md), ni l'interdiction absolue de transmettre des données de client final à l'IA.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Génération à la demande depuis le Dashboard, avec les mêmes garde-fous que l'embarquement (retenue)** | Le restaurateur reste autonome quand sa carte évolue ; le workflow média est identique avant et après activation | Exige des états asynchrones, une association explicite entre produit, source et candidats, ainsi que des quotas de coût |
| Génération limitée à l'embarquement | Périmètre technique et budget simples | Les nouveaux produits restent sans visuel ou demandent une intervention de Surplasse |
| Téléversement et harmonisation après l'embarquement, génération sur demande de l'équipe Surplasse | Le restaurateur peut mettre à jour ses photos sans exposer directement la génération | Crée une dépendance opérationnelle et ne tient pas la promesse de gestion autonome |
| Génération libre depuis une description, sans photo source | Parcours rapide même sans photo | Risque de plat inventé, d'ingrédients absents et de pratique commerciale trompeuse |

## Décision

Surplasse rend la génération encadrée de visuels de plats disponible pendant l'embarquement puis à tout moment depuis la fiche d'un produit dans le Dashboard.

Le workflow respecte cinq règles non négociables.

1. **Une source maîtrisée et fidèle.** Le restaurateur fournit une photo du plat réellement servi et confirme qu'il dispose des droits nécessaires. Une photo de tiers, une image issue d'une plateforme ou une génération sans photo source sont refusées.
2. **Un traitement distinct de l'harmonisation.** Recadrer, corriger l'exposition et produire des miniatures reste un traitement d'image classique. Créer un nouveau rendu avec l'IA est une génération séparée, déclenchée explicitement.
3. **Une génération asynchrone côté Backend.** Le Dashboard crée un job pris en charge par l'interface `DishImageGenerator` du domaine `generation`. Le frontend n'appelle jamais directement l'API OpenAI. L'image déjà publiée reste visible pendant le traitement et en cas d'échec.
4. **Des candidats privés jusqu'au choix.** Chaque résultat est rattaché à l'établissement, au produit, au job et à la photo source. Le restaurateur compare la photo fournie et les visuels candidats, puis choisit explicitement la photo originale, un visuel généré ou aucune image. Le remplacement de l'image publiée est atomique. Aucune proposition n'est publiée automatiquement.
5. **Une transparence et un coût borné.** Un visuel généré est présenté côté client comme une « suggestion de présentation ». Le nombre de générations est plafonné par établissement et par période, avec un suivi du coût par job. Les sources et candidats écartés suivent une politique de rétention explicite.

Les métadonnées EXIF sont retirées avant tout envoi. Les photos sources et les candidats restent dans un stockage privé, accessibles par URL signée pendant la comparaison. Aucune donnée de commande ou de client final n'entre dans ce pipeline.

## Conséquences

### Positives

- Le restaurateur peut garder une carte illustrée à jour sans intervention de Surplasse.
- Le même workflow et les mêmes garanties s'appliquent pendant l'embarquement et dans la vie courante de l'établissement.
- La photo actuellement publiée ne disparaît jamais pendant une génération ou un échec.
- Le choix explicite et l'étiquetage limitent le risque de tromperie sur l'assiette réellement servie.

### Négatives et dettes assumées

- Le modèle de données doit représenter sans ambiguïté le produit ciblé, la photo source, le job et les candidats. Les statuts actuels de `MediaAsset` devront être affinés avant l'implémentation.
- Le contrat devra couvrir le téléversement, le déclenchement, le suivi du job, la comparaison, la sélection et l'archivage des visuels.
- Les quotas, le nombre de candidats par demande et la politique de rétention restent à calibrer avec les premiers établissements.
- L'étiquetage exact et la fidélité des rendus devront être validés par des tests produit et, si nécessaire, par une revue juridique avant la production.
