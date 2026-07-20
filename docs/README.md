---
label: Accueil
order: 1
icon: home
description: Accueil de la documentation Surplasse, pitch du produit, état du projet, carte des pages et points d'entrée par profil.
---

# Surplasse

Surplasse permet aux restaurants indépendants de créer leur propre canal de commande directe, sans projet informatique. À partir du nom de l'établissement, d'une photo de la carte et de quelques images, Surplasse génère un mini-site élégant, une carte numérique structurée, un système de commande et des paiements intégrés. Le client scanne un QR code à table, commande et paie depuis son téléphone, sans application ni compte, et la commande arrive en temps réel côté restaurateur.

Surplasse n'est pas une marketplace : le restaurant garde son identité, ses prix, ses clients et sa relation client. Slogan : « Le circuit court de la commande. »

## État du projet

| Aspect | État en juillet 2026 |
|---|---|
| Phase | Phase 2, commander et payer, en cours |
| Code applicatif | Contrat OpenAPI, Backend Quarkus jusqu'à l'identité restaurateur, package TypeScript partagé, Commande et Dashboard minimal avec suivi temps réel |
| Existant dans le dépôt | Applications locales, topologie HTTPS `surplasse.test`, cockpit de modules, documentation, marque et préfiguration statique de l'Onboarding |
| Prochaines étapes | Stripe Connect en test, production prête, paiement live fermé puis service à blanc, selon la [roadmap](roadmap.md) et le [runbook pilote](operations/pilote.md) |

!!! info Existant et cible
Les pages distinguent l'état implémenté de la cible de référence. Les points encore ouverts sont signalés explicitement dans les pages concernées, et chaque décision structurante est consignée dans un [ADR](decisions/index.md).
!!!

## Le système en un coup d'œil

Quatre applications, un backend, un contrat. Le contrat OpenAPI est la source de vérité : le backend l'implémente, les frontends consomment des clients TypeScript générés depuis lui.

```
  Onboarding               Commande                  Dashboard
  surplasse.com            {slug}.surplasse.com      dashboard.surplasse.com
  vitrine produit,         mini-site, carte,         suivi temps réel,
  embarquement             commande, paiement        gestion de la carte
       |                        |                         |
       +------------------------+-------------------------+
                                |
              clients TypeScript générés depuis le contrat
                                |
                                v
                   api/openapi.yaml : le contrat
                                |
               interfaces Java générées depuis le contrat
                                |
                                v
                  Backend Quarkus (api.surplasse.com)
                                |
                                v
                          PostgreSQL 17
```

La [vue d'ensemble de l'architecture](architecture/index.md) détaille ce schéma, les responsabilités de chaque application et les flux entre elles.

## Carte de la documentation

| Section | Contenu | Pages principales |
|---|---|---|
| Produit | La vision, les personas, les fonctionnalités et les trois parcours détaillés | [Vision](produit/vision.md), [Personas](produit/personas.md), [Fonctionnalités](produit/fonctionnalites.md), parcours de [commande client](produit/parcours/commande-client.md), d'[embarquement restaurateur](produit/parcours/onboarding-restaurateur.md) (dont la variante revendication) et du [quotidien avec le Dashboard](produit/parcours/dashboard-restaurateur.md) |
| Architecture | La structure technique cible : applications, API, données, intégrations, sécurité | [Vue d'ensemble](architecture/index.md), [Frontends](architecture/frontends.md), [Backend](architecture/backend.md), [API](architecture/api.md), [Données](architecture/donnees.md), [Intégrations](architecture/integrations.md), [Sécurité](architecture/securite.md) |
| Développement | Tout ce qu'il faut pour contribuer au code : environnement, domaines, cockpit, conventions, tests | [Setup](developpement/index.md), [Domaines locaux](developpement/domaines-locaux.md), [Conventions React](developpement/conventions-react.md), [Conventions Quarkus](developpement/conventions-quarkus.md), [Conventions API](developpement/conventions-api.md), [Git](developpement/workflow-git.md), [Tests](developpement/tests.md), [CI/CD](developpement/ci-cd.md) |
| Opérations | L'exploitation du système en production | [Environnements](operations/environnements.md), [Observabilité](operations/observabilite.md), [Pilote de phase 2](operations/pilote.md), [RGPD](operations/rgpd.md) |
| Décisions | Les ADR, décisions d'architecture numérotées qui font loi | [Registre des ADR](decisions/index.md) |
| Roadmap | Les phases du projet, les jalons et la priorisation du MVP | [Roadmap](roadmap.md) |
| Glossaire | Les termes métier et techniques du projet, avec renvois | [Glossaire](glossaire.md) |

## Par où commencer

### « Je découvre le produit »

1. La [vision](produit/vision.md) : le problème, le positionnement, ce que Surplasse n'est pas.
2. Les [personas](produit/personas.md) : le restaurateur et le client, leurs attentes respectives.
3. Les [fonctionnalités](produit/fonctionnalites.md) : ce que fait chaque application.
4. Les trois parcours : la [commande client](produit/parcours/commande-client.md), l'[embarquement restaurateur](produit/parcours/onboarding-restaurateur.md) (dont la variante revendication) et le [quotidien avec le Dashboard](produit/parcours/dashboard-restaurateur.md).
5. La [roadmap](roadmap.md) pour situer ce qui vient en premier.

### « Je vais développer le frontend »

1. L'[architecture des frontends](architecture/frontends.md) : les trois applications React, le package partagé, les domaines.
2. [Le contrat](architecture/api.md) : l'approche contract-first et la génération des clients TypeScript.
3. Les [conventions React](developpement/conventions-react.md) : TypeScript strict, TanStack Query, structure des packages.
4. Le [setup de l'environnement](developpement/index.md) puis les [tests](developpement/tests.md) (dont MSW pour simuler l'API).

### « Je vais développer le backend »

1. La [vue d'ensemble](architecture/index.md) puis le [backend](architecture/backend.md) : Quarkus, monolithe modulaire, Maven multi-modules.
2. Le [modèle de données](architecture/donnees.md) : entités, machine à états de la commande, migrations Flyway.
3. [Le contrat](architecture/api.md) : les interfaces Java sont générées depuis lui, jamais écrites à la main.
4. Les [conventions Quarkus](developpement/conventions-quarkus.md), le [setup](developpement/index.md) (Dev Services) et les [tests](developpement/tests.md) (Testcontainers).

### « Je cherche une décision d'architecture »

Le [registre des ADR](decisions/index.md) liste toutes les décisions structurantes, numérotées et datées. Deux règles à connaître : un ADR prime sur toute autre page en cas de contradiction, et une question structurante encore ouverte se tranche par un nouvel ADR, pas par un paragraphe au détour d'une page.

## Roadmap et glossaire

Deux pages transverses servent de repères permanents :

- La [roadmap](roadmap.md) donne les phases du projet et leurs critères de sortie ; la priorisation MoSCoW du MVP est détaillée dans les [fonctionnalités](produit/fonctionnalites.md).
- Le [glossaire](glossaire.md) définit chaque terme métier et technique du projet, avec les termes à proscrire.

## Contribuer à la documentation

Le fichier `docs/AGENTS.md` (exclu du site publié) fixe la terminologie canonique, la stack de référence, le style rédactionnel et les conventions Retype. Toute contribution le respecte ; en cas de contradiction entre une page et lui, c'est la page qui est corrigée.

En pratique :

```bash
npm install          # une fois
npm run docs:watch   # prévisualisation locale avec rechargement
npm run docs:build   # build de vérification, obligatoire avant tout push touchant docs/
```

Le workflow git est décrit dans la page [Git](developpement/workflow-git.md) : branche unique `main`, pas de PR, commits fréquents en français préfixés par le périmètre (`docs:` pour ce site). Chaque push sur `main` publie la documentation sur GitHub Pages.
