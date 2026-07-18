---
label: "ADR-0010 : Fournisseur IA (OpenAI derrière interface)"
order: 100
icon: law
description: "Pourquoi Surplasse retient l'API OpenAI comme fournisseur d'IA (extraction de carte par vision et génération de visuels), placée derrière une interface qui la garde interchangeable."
---

# ADR-0010 : Fournisseur IA (OpenAI derrière interface)

## Statut

Accepté, 2026-07-18.

## Contexte

Deux capacités du produit reposent sur un modèle d'IA :

- **l'extraction de carte par vision** : lire une photo de carte et en produire une structure (catégories, produits, options, prix), ainsi que l'enrichissement à partir de données publiques ;
- **la génération de visuels de plats** : produire, à partir des photos fournies à l'embarquement, des images de plats harmonisées (cadrée par l'[ADR-0011](adr-0011-visuels-plats.md)).

La documentation de référence mentionnait initialement un fournisseur donné pour la seule extraction. Un test d'amorçage a été mené : des photos de carte fournies à l'API OpenAI ont été correctement reconnues et structurées, et la même API a généré des visuels de plats exploitables à partir de photos existantes. Le chemin est donc validé de bout en bout sur un seul fournisseur.

Le fournisseur d'IA est une dépendance externe payante et évolutive (modèles, tarifs, disponibilité). L'engager sans précaution d'architecture créerait un couplage difficile à défaire.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **API OpenAI, derrière une interface** | Extraction et génération d'images validées par un test d'amorçage sur un seul fournisseur ; un seul contrat, une seule clé, une seule facture à suivre ; écosystème outillé | Dépendance à un fournisseur unique ; coût à modéliser et à plafonner |
| Deux fournisseurs spécialisés (un pour la vision, un pour l'image) | Choisir le meilleur de chaque | Deux intégrations, deux contrats, deux budgets, plus de surface d'exploitation pour un solo dev ; aucun besoin avéré |
| Modèle auto-hébergé | Pas de dépendance externe, données non transmises | Coût d'infrastructure et d'exploitation sans commune mesure avec la charge ; qualité en retrait ; hors de portée d'un solo dev au MVP |

## Décision

Surplasse retient l'**API OpenAI** comme fournisseur d'IA pour l'extraction (vision) et la génération de visuels de plats.

Ce fournisseur est **toujours placé derrière une interface** du domaine `generation`, par exemple `MenuExtractor` et `DishImageGenerator`, dont l'implémentation OpenAI est un détail remplaçable. Aucun code métier n'appelle le SDK du fournisseur directement : changer de fournisseur, ou en ajouter un second pour une capacité donnée, se limite à une nouvelle implémentation de l'interface.

La règle de confidentialité reste absolue : aucune donnée de client final n'est jamais transmise à l'IA. Les photos de carte et les données publiques d'établissements sont des données professionnelles, destinées à l'affichage public (voir [RGPD](../operations/rgpd.md)).

## Conséquences

### Positives

- Un seul fournisseur, un seul point d'intégration, un seul budget à suivre pour les deux capacités.
- Le chemin est déjà validé par un test d'amorçage réel, ce qui lève le principal risque du produit.
- L'interface d'abstraction garde la porte ouverte à un changement de fournisseur sans réécriture du métier.

### Négatives et dettes assumées

- Dépendance à un fournisseur unique : sa disponibilité et sa tarification deviennent un paramètre d'exploitation à surveiller.
- Le coût par embarquement (appels de vision et de génération d'images) doit être mesuré et plafonné par établissement.
- Le choix du modèle exact, les seuils de qualité et la localisation des traitements restent à affiner et à encadrer contractuellement (DPA) avant la mise en production.
