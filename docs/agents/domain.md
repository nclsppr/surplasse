---
label: Documentation du domaine
order: 30
icon: book
description: Sources à lire et vocabulaire à respecter lorsque les skills explorent le domaine Surplasse.
---

# Documentation du domaine

Le monorepo Surplasse utilise le mode `single-context`. Ses applications
partagent le même produit, le même vocabulaire métier et le même registre de
décisions.

## Avant l'exploration

Lire d'abord les instructions du dépôt, puis les sources qui concernent le
travail :

- `docs/AGENTS.md` définit la terminologie canonique, la stack et la préséance
  documentaire.
- `CONTEXT.md` à la racine complète le glossaire du domaine s'il existe.
- `docs/decisions/` contient les ADR. Lire les décisions qui touchent la zone
  explorée et suivre l'ADR de remplacement lorsqu'une décision est remplacée.
- Les pages pertinentes sous `docs/produit/` et `docs/architecture/` décrivent
  le produit et l'état visé. Vérifier le code et la configuration pour connaître
  l'état réellement implémenté.

Si `CONTEXT.md` n'existe pas, continuer sans signaler son absence. Le skill de
modélisation du domaine le crée uniquement lorsqu'un terme ou une décision
résolus doivent y être consignés.

## Vocabulaire

Employer les termes de `docs/AGENTS.md`, puis ceux de `docs/glossaire.md` et de
`CONTEXT.md` lorsqu'il existe. Ne pas remplacer un terme défini par un synonyme
proscrit. Si le terme nécessaire manque, vérifier d'abord que le travail ne
réintroduit pas un vocabulaire déjà écarté.

## Conflits avec une décision

Signaler toute proposition qui contredit un ADR accepté dans
`docs/decisions/`. Nommer l'ADR et expliquer pourquoi la décision mérite une
nouvelle étude. Ne pas la remplacer silencieusement.
