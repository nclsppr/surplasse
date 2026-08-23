---
label: "ADR-0047 : version Flyway du bootstrap pilote"
order: 470
icon: law
description: "Pourquoi le bootstrap pilote exige un historique Flyway contigu jusqu'à une version déclarée avec le code."
---

# ADR-0047 : version Flyway du bootstrap pilote

## Statut

Accepté, 2026-08-23.

Remplace l'[ADR-0043](adr-0043-bootstrap-borne-pilote-production.md). Toutes les garanties de cette décision restent applicables, notamment la commande Java et JDBC sans serveur, le manifeste protégé, la validation Stripe avant transaction, le graphe borné, l'idempotence, la transaction sérialisable, la prise de commandes initialement en pause, les réseaux restreints et le refus de toute divergence. Seul le garde-fou de version Flyway évolue ci-dessous.

## Contexte

L'ADR-0043 exigeait un historique Flyway exactement composé de V1 à V14. Cette borne explicite empêche le bootstrap d'écrire sur un schéma inattendu, mais la version inscrite dans la décision ne peut pas suivre les migrations suivantes.

La migration V15 ajoute la valeur par défaut `stripe` aux colonnes `provider` de `payment` et `payment_refund`. Elle ne change ni le manifeste du pilote, ni son graphe, ni le comportement du bootstrap. Celui-ci reste une commande Java et JDBC privée, exécutée une seule fois par Atlas.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Conserver une borne V14 fixe | Aucun changement du bootstrap | Refuse le schéma courant et bloque toute migration future |
| Accepter toute version Flyway au moins égale à V14 | Moins de maintenance | Peut autoriser un schéma que le code n'a jamais prouvé |
| Déclarer la version requise dans le code et exiger un historique contigu exact | Garde-fou strict, évolution explicite avec chaque release | Chaque migration impose une mise à jour coordonnée du bootstrap et de ses preuves |

## Décision

Le bootstrap conserve toutes les garanties et limites de l'ADR-0043. Il reste une commande Java et JDBC sans serveur HTTP, sans exécution de Flyway et sans SQL opérateur. Le manifeste et le graphe pilote restent inchangés.

Par référence à l'ADR-0043, les garanties suivantes sont reconduites sans modification :

- `PilotBootstrapCommand` reste empaquetée dans le digest Backend admis et son runner accepte exactement `status` ou `apply` ;
- le job reste one-shot, sans port, sans alias public, avec `restart: "no"` et seulement les réseaux nécessaires à PostgreSQL et à la lecture Stripe ;
- le manifeste conserve ses six UUID v4, ses champs, son chemin, sa taille maximale, son propriétaire et son mode stricts ; il ne contient aucun secret ni code de table ;
- avant l'écriture, Accounts v2 doit confirmer le compte exact, en mode test, non fermé et avec `card_payments` actif au moyen de la clé restreinte montée en fichier ;
- la sortie et les journaux ne révèlent ni secret, ni donnée du manifeste, ni détail Stripe ;
- la base doit être vide ou contenir exactement le graphe manifesté, sans autre ligne opérationnelle ;
- les six insertions utilisent une transaction sérialisable et un horodatage commun, fixent `activated_at` une seule fois, génèrent le code de table avec 128 bits aléatoires sans l'afficher et laissent la prise de commandes à `paused` ;
- un nouvel `apply` identique ne modifie rien, toute divergence échoue sans suppression, correction ou écriture partielle, et `status` relit le même contrat sans mutation ;
- le passage à `open` reste une action métier authentifiée distincte, postérieure à la preuve initiale.

Le code déclare une constante `REQUIRED_SCHEMA_VERSION`. Sa valeur courante est `15`. Avant toute mutation, le bootstrap lit `flyway_schema_history` et exige exactement une suite de migrations entières, réussies et contiguës de V1 à `REQUIRED_SCHEMA_VERSION`, sans lacune, doublon, échec ni version supplémentaire. Toute autre histoire est une divergence et provoque un refus sans écriture.

Toute nouvelle migration doit faire avancer `REQUIRED_SCHEMA_VERSION` et mettre à jour les tests, les preuves du bundle Atlas et la documentation dans la même release. Une migration non accompagnée de cette mise à jour ne peut pas être admise pour le bootstrap pilote.

V15 fixe uniquement `provider='stripe'` comme valeur par défaut de `payment.provider` et `payment_refund.provider`. Elle permet aux insertions internes qui omettent ce discriminateur de rester cohérentes avec l'unique fournisseur actuel. Elle n'ajoute aucun fournisseur, ne modifie aucune donnée du manifeste et ne change aucun invariant métier du pilote.

## Conséquences

### Positives

- le bootstrap refuse encore tout schéma qu'une release n'a pas explicitement prouvé ;
- la version exigée évolue avec le code au lieu de rester figée dans une hypothèse historique ;
- une migration manquante, en échec ou supplémentaire est détectée avant toute écriture ;
- les garanties de sécurité, d'idempotence et de bornage du pilote restent inchangées.

### Négatives et dettes assumées

- chaque migration ajoute une obligation de coordination entre le schéma, le bootstrap, ses tests et le bundle Atlas ;
- la constante doit être avancée manuellement et peut donc faire échouer une release incomplète ;
- le bootstrap continue de refuser une base ayant reçu une migration plus récente que celle admise par son image.
