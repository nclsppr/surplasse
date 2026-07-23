---
label: "ADR-0032 : canal prépayé sans fonction de caisse"
order: 320
icon: law
description: "Pourquoi Surplasse exploite ses commandes payées en ligne de bout en bout sans enregistrer les autres encaissements du restaurant."
---

# ADR-0032 : canal prépayé sans fonction de caisse

## Statut

Accepté, 2026-07-23.

## Contexte

Le socle professionnel doit fermer la boucle d'une commande Surplasse : saisie, paiement, préparation, service, remboursement et rapprochement. Étendre cette boucle à toutes les commandes d'un restaurant paraît proche, mais change la nature du produit. Il faudrait saisir des commandes prises à la voix, enregistrer les espèces, titres-restaurant et paiements sur terminal, maintenir des additions ouvertes, produire des clôtures fiscales et s'intégrer à la comptabilité.

La vision exclut déjà un POS complet. La valeur de Surplasse est le canal direct créé sans projet informatique, pas le remplacement de la caisse. Les établissements de la cible possèdent généralement un moyen habituel pour les commandes hors Surplasse. Exiger une intégration bidirectionnelle à chaque caisse avant de pouvoir ouvrir rendrait l'embarquement dépendant d'un écosystème fragmenté.

La frontière a aussi des conséquences réglementaires. Un logiciel qui enregistre des règlements de clients peut entrer dans le champ des systèmes de caisse et de leurs obligations d'inaltérabilité, de sécurisation, de conservation, d'archivage et de certification. Les paiements exclusivement en ligne traités par un prestataire de services de paiement disposent d'un cadre distinct, mais Surplasse ne doit pas conclure seul à son applicabilité. Ajouter un bouton « payé en espèces » avant ce cadrage créerait un risque disproportionné.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Remplacer la caisse et enregistrer tous les moyens de paiement | Une seule file de commandes et des chiffres exhaustifs | Périmètre fiscal, matériel et comptable majeur, addition ouverte, espèces et titres-restaurant, détourne le produit de sa promesse |
| Exiger une intégration caisse pour chaque établissement | Une seule source opérationnelle sans devenir caisse | Embarquement long, dépendances par fournisseur, support et certification des connecteurs, bloque les indépendants non équipés d'une solution compatible |
| Être une simple couche QR sans production ni rapprochement | Périmètre applicatif minimal | Deux flux incohérents, aucune boucle de service fiable, faible valeur professionnelle |
| **Exploiter de bout en bout les commandes Surplasse prépayées et coexister avec la caisse** | Ferme la boucle du canal direct, garde un embarquement autonome, limite la surface fiscale et matérielle | Le restaurant conserve deux canaux pour une partie de son activité, les chiffres Surplasse ne représentent pas son activité totale |

## Décision

Surplasse exploite de bout en bout les commandes créées et payées en ligne dans son canal. Une commande n'entre dans la file opérationnelle qu'après la confirmation du paiement par le webhook Stripe signé. Le Dashboard ne permet pas de marquer manuellement une commande comme payée.

L'acceptation reste manuelle dans le socle afin qu'un établissement ne promette pas silencieusement une commande impossible à produire. L'ouverture exige au moins une session testée, explicitement armée pour la réception et capable d'accepter : membre `owner`, `manager` ou `service`, ou poste partagé Salle. Un poste Cuisine seul ne suffit pas. La perte prolongée de tous les réceptionnaires force une pause sans réouverture automatique et une alerte secondaire. Toute commande payée dans la fenêtre de coupure reste visible et doit être acceptée avant le délai maximal configuré, sinon Surplasse orchestre son remboursement intégral idempotent.

Le passage à `paid` crée dans la même transaction une échéance durable dédupliquée par commande. À son terme, le worker verrouille et relit la commande. Si elle est encore `paid`, il force la prise de commandes à `paused`, même si un bail de réception reste actif, crée ou retrouve une intention système de motif `acceptance_timeout` et réutilise l'orchestration Stripe de remboursement. L'acceptation ou un remboursement déjà engagé annule le job ou le rend sans effet. Le journal attribue l'action à `system` avec l'identifiant du job. Seul un `owner` ou `manager` peut rouvrir après diagnostic. Après épuisement des reprises, la prise de commandes reste en pause et une alerte P0 exige une intervention.

Le socle n'enregistre pas les espèces, chèques, titres-restaurant, paiements sur un terminal externe ni additions payées en fin de repas. Il ne calcule pas le chiffre d'affaires total de l'établissement et ne se présente pas comme un logiciel de caisse. Les interfaces emploient « ventes via Surplasse », « rapprochement Surplasse » et « versement Stripe » lorsque la distinction est nécessaire.

Un membre en salle peut préparer une proposition de commande pour aider un client. Cette proposition persistée porte une table, une sélection de produits et d'options, une expiration et son auteur. Le client l'ouvre par lien ou QR ; elle hydrate alors un nouveau panier purement local qu'il relit puis paie sur son téléphone. La proposition ne réserve rien, ne fait jamais foi sur les prix et ne change pas de type. La validation crée une nouvelle commande après recalcul Backend, puis seul le webhook Stripe la rend `paid` et visible en cuisine.

Le Dashboard fournit l'historique, les remboursements, les composants Stripe de paiement et de versement, le rapprochement et l'export des commandes Surplasse. Ces surfaces satisfont la dette créée par `dashboard=none` dans l'[ADR-0020](adr-0020-accounts-v2-onboarding-embarque.md). Elles ne reconstruisent pas une comptabilité générale ni une clôture de caisse.

Avant la commercialisation multi-établissements, un conseil juridique et comptable confirme par écrit :

- la qualification exacte du périmètre au regard des règles applicables aux logiciels et systèmes de caisse ;
- les données fiscales à figer sur les lignes de commande et à porter sur la note ;
- les obligations de facturation électronique et de transmission de données selon le calendrier et la taille des établissements ;
- la façon dont l'export Surplasse rejoint la comptabilité et la caisse existante sans double enregistrement.

Le support papier de la carte reste obligatoire dans le produit, car un QR code ne peut pas être l'unique accès aux affichages réglementaires. La carte publiée génère un PDF daté et la commande terminée produit une note accessible au client avec les mentions validées.

Une intégration caisse pourra être ajoutée plus tard si plusieurs pilotes démontrent que la coexistence bloque l'adoption. Elle commencera par un flux unidirectionnel étroit, documenté par un nouvel ADR, et ne deviendra pas une condition générale de l'embarquement sans preuve.

Le déclencheur est explicite : si plus de deux établissements recrutés sur dix échouent uniquement parce que la coexistence impose une ressaisie ou une double surveillance intenable, l'intégration unidirectionnelle devient un bloqueur de généralisation. Un nouvel ADR en fixe alors la caisse ou le format prioritaire à partir des outils réellement observés dans la cohorte.

## Conséquences

### Positives

- Le produit ferme la boucle opérationnelle et financière de ses propres commandes sans devenir une suite de caisse générale.
- L'embarquement reste possible sans projet d'intégration ni matériel imposé.
- Aucun membre ne peut créer une fausse concordance en déclarant manuellement un paiement externe.
- Les métriques et exports portent un périmètre explicite et vérifiable contre Stripe.
- La commande assistée reste possible sans introduire de commande impayée dans la cuisine.

### Négatives et dettes assumées

- Les commandes prises et encaissées hors Surplasse ne figurent pas dans ses vues Cuisine, Salle ou analyses.
- Un établissement peut conserver deux flux opérationnels tant qu'aucune intégration caisse n'est disponible.
- Les clients souhaitant payer en espèces, titre-restaurant ou en fin de repas utilisent le parcours habituel du restaurant.
- La qualification juridique doit être obtenue avant la généralisation même si le périmètre reste exclusivement prépayé en ligne.
- Une demande forte de chiffres consolidés nécessitera une intégration ou un import contrôlé, jamais une addition implicite de données incomplètes.

## Références

- [Article 286 du Code général des impôts](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051203262)
- [Restaurants : droits et obligations des professionnels, DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/restaurants-droits-et-obligations-des-professionnels)
- [Rapprochement des versements Stripe](https://docs.stripe.com/reports/payout-reconciliation?locale=fr-FR)
- [ADR-0020 : Accounts v2 et embarquement Stripe intégré](adr-0020-accounts-v2-onboarding-embarque.md)
