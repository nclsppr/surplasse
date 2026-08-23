---
label: Labels de triage
order: 20
icon: tag
description: Correspondance entre les cinq rôles de triage des skills et les labels utilisés dans GitHub Issues.
---

# Labels de triage

Les skills d'ingénierie utilisent cinq rôles de triage canoniques. Chaque rôle
correspond directement au même label GitHub dans ce dépôt.

| Label dans `mattpocock/skills` | Label dans GitHub | Signification |
|---|---|---|
| `needs-triage` | `needs-triage` | Un mainteneur doit évaluer le ticket |
| `needs-info` | `needs-info` | La personne qui a ouvert le ticket doit apporter des informations |
| `ready-for-agent` | `ready-for-agent` | Le ticket est assez précis pour un agent autonome |
| `ready-for-human` | `ready-for-human` | Une personne doit réaliser le ticket |
| `wontfix` | `wontfix` | Le dépôt ne traitera pas le ticket |

Lorsqu'un skill nomme un rôle de triage, utiliser le label GitHub de la deuxième
colonne. Modifier cette colonne uniquement si le dépôt change son vocabulaire
de labels.
