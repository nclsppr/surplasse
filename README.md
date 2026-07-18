# Surplasse

**Le circuit court de la commande.** Vos commandes. Vos clients. Votre restaurant.

Surplasse permet aux restaurants indépendants de créer leur propre canal de commande directe, simplement, rapidement et sans projet informatique. Une photo de la carte suffit : Surplasse génère un mini-site élégant, une carte numérique structurée, un système de commande et des paiements intégrés. Le client scanne un QR code à table, commande et paie depuis son téléphone, sans application ni compte.

## Documentation

Toute la documentation (vision produit, architecture, conventions, roadmap) vit dans [`docs/`](docs/) et est publiée sur **[nclsppr.github.io/surplasse](https://nclsppr.github.io/surplasse/)**.

```bash
npm install
npm run docs:watch   # prévisualisation locale
npm run docs:build   # build de vérification
```

## Monorepo

| Répertoire | Contenu | État |
|---|---|---|
| `docs/` | Documentation Retype | En cours |
| `api/` | Contrat OpenAPI, source de vérité de l'API | À venir |
| `backend/` | API Quarkus | À venir |
| `frontends/` | Onboarding, Commande, Dashboard (React) | À venir |
| `infra/` | Docker Compose, VPS | À venir |

Les conventions de contribution et la terminologie canonique sont dans [`docs/AGENTS.md`](docs/AGENTS.md).
