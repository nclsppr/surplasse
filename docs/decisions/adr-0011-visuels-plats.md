---
label: "ADR-0011 : Visuels de plats générés"
order: 110
icon: law
description: "La politique de génération de visuels de plats : sources maîtrisées, choix du restaurateur produit par produit, fidélité à l'assiette réellement servie."
---

# ADR-0011 : Visuels de plats générés

## Statut

Remplacé par [ADR-0025](adr-0025-visuels-plats-a-la-demande.md), 2026-07-22.

## Contexte

Beaucoup de restaurants indépendants n'ont aucune photo exploitable de leurs plats. Or une carte illustrée convertit mieux qu'une carte de texte. Un test d'amorçage a montré que l'API OpenAI génère, à partir de photos de plats existantes, des visuels harmonisés et appétissants exploitables sur un mini-site.

La documentation de référence interdisait initialement toute génération d'images, au nom de la fidélité à l'assiette réellement servie. Cette interdiction totale est trop large : elle prive le produit d'un levier de valeur réel alors que le risque est maîtrisable par un cadrage précis. Mais la génération soulève deux risques qu'on ne peut pas ignorer :

- **la tromperie du consommateur** : un visuel présenté comme la photo réelle d'un plat qui ne lui ressemble pas peut constituer une pratique commerciale trompeuse ;
- **les droits sur les images sources** : générer à partir de photos de tiers (touristes, plateformes d'avis) est juridiquement fragile, ces photos ayant des auteurs et des conditions d'utilisation.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Génération encadrée (retenue)** | Illustre les cartes sans photo, à partir des seules images du restaurateur, sous son contrôle produit par produit | Nécessite un cadre clair (sources, étiquetage, validation) et un modèle de données pour les visuels candidats |
| Interdiction totale de génération | Aucun risque de tromperie ni de droits | Prive un grand nombre de restos d'illustrations, à rebours d'un besoin réel et d'une capacité validée |
| Génération libre, toutes sources | Volume et facilité maximum | Risque juridique sur les photos de tiers, risque de tromperie, perte de contrôle du restaurateur |

## Décision

Surplasse **génère des visuels de plats**, sous trois conditions strictes et non négociables.

1. **Sources maîtrisées uniquement.** La génération part exclusivement des photos fournies à l'embarquement par le restaurateur (ou la personne qui l'embarque). Jamais de photos de tiers (touristes, plateformes) : la source doit être une image dont l'établissement a les droits.
2. **Choix du restaurateur, produit par produit.** À la configuration de la carte depuis le Dashboard, chaque produit peut porter soit une photo téléversée, soit un visuel proposé par Surplasse, soit aucune image. Rien de généré n'est publié sans le choix explicite du restaurateur.
3. **Fidélité.** Un visuel illustre un plat réellement servi, à partir d'une photo de ce plat ; il ne l'invente pas, n'ajoute pas d'ingrédient absent, et est présenté comme une suggestion de présentation, jamais comme la photo littérale de l'assiette servie.

Concrètement, à l'embarquement, un job de génération produit des `MediaAsset` au statut `proposed` (source `generated`), rattachés à l'établissement et à leur photo source. Le restaurateur en retient, ou en écarte, un par produit (voir [le modèle de données](../architecture/donnees.md) et [les intégrations](../architecture/integrations.md)).

## Conséquences

### Positives

- Les restaurants sans photo obtiennent une carte illustrée, un vrai gain de conversion, sans séance photo.
- Le cadre (sources du restaurateur, choix explicite, étiquetage « suggestion de présentation ») neutralise le risque de tromperie et le risque de droits sur les images.
- Le restaurateur garde le contrôle total : c'est lui qui décide, image par image.

### Négatives et dettes assumées

- Un modèle de données pour les visuels candidats (`MediaAsset`, statuts `proposed` / `selected` / `archived`) et une interface de choix dans le Dashboard sont à construire.
- Le coût de génération s'ajoute au budget IA de l'embarquement, à mesurer et plafonner (voir [ADR-0010](adr-0010-fournisseur-ia.md)).
- L'étiquetage « suggestion de présentation » et la formulation exacte côté client restent à valider (produit et, au besoin, juridiquement).
- La conservation des photos sources et des visuels non retenus relève de la politique de rétention (voir [RGPD](../operations/rgpd.md)).
