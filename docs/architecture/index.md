---
label: Architecture
order: 20
icon: telescope
description: Principes directeurs, diagrammes de contexte et de conteneurs, flux critiques et découpage en domaines de l'architecture Surplasse.
---

# Vue d'ensemble de l'architecture

Cette page donne la carte générale du système : les principes qui guident chaque décision, les acteurs et les systèmes externes, les conteneurs déployés, les deux flux critiques du produit et le découpage en domaines métier. Les pages suivantes de cette section détaillent chaque bloc.

!!! info Documentation de référence
Le projet n'a pas encore de code applicatif. Cette page décrit la cible de référence, au présent de spécification. Les points non tranchés sont signalés explicitement et donneront lieu à des ADR dans [decisions](../decisions/).
!!!

## Principes directeurs

### Contract-first : le contrat précède le code

Le contrat OpenAPI (`api/openapi.yaml`) est écrit avant toute implémentation. Le Backend implémente des interfaces Java générées depuis le contrat, les frontends consomment des clients TypeScript générés depuis le même fichier. Ce choix élimine toute divergence entre ce que l'API promet et ce que les applications attendent : une modification d'endpoint commence toujours par une modification du contrat, visible en revue, versionnée en git. Pour un développeur seul, c'est aussi le moyen le plus économique de garder quatre applications synchronisées. Le détail est dans [le contrat et l'API](api.md).

### Monolithe modulaire plutôt que microservices

Le Backend est un seul déployable Quarkus, découpé en modules Maven par domaine métier. Un développeur solo n'a ni le temps ni le besoin d'opérer un système distribué : pas de réseau entre les domaines, pas d'orchestration, pas de traçage inter-services, une seule base de données, une seule pile de logs. Les frontières entre domaines existent quand même, imposées par les modules Maven : si un jour un domaine doit être extrait (la génération IA est le candidat le plus probable), la couture est déjà tracée. Le découpage est décrit dans [le backend](backend.md).

### Tout est committé et documenté

Le monorepo contient l'intégralité du système : le contrat, le backend, les trois frontends, l'infrastructure Docker Compose et cette documentation. Rien ne vit dans une console cloud ou dans la tête de quelqu'un. Toute décision structurante est consignée dans un ADR sous `docs/decisions/`. Ce principe rend le projet reprenable : n'importe qui (humain ou agent) peut reconstruire l'état complet du système depuis un clone du dépôt.

### La simplicité opérationnelle prime

La cible de déploiement est un VPS unique piloté par Docker Compose, décrit dans `infra/`. Pas de Kubernetes, pas de services managés propriétaires au-delà de Stripe et de l'API OpenAI, pas d'autoscaling. Un restaurant indépendant génère quelques dizaines de commandes par service : la charge se mesure en requêtes par seconde à un chiffre, et un VPS correctement dimensionné la tient avec une marge confortable. Chaque brique ajoutée doit justifier son coût d'exploitation, pas seulement son intérêt technique.

### Le client final ne subit jamais la complexité

Le client scanne, consulte la carte, commande et paie. Il n'a pas de compte, pas d'application à installer, pas de cookie de session à gérer, pas d'écran de consentement au-delà du strict nécessaire. Toute la complexité (génération IA, Stripe Connect, SSE, impression) vit côté restaurateur ou côté Backend. Ce principe est un filtre de conception : une fonctionnalité qui ajoute une friction côté client est refusée ou repensée, quel que soit son intérêt côté plateforme.

## Diagramme de contexte

Les deux acteurs, les quatre applications et les systèmes externes :

```
      ┌──────────────┐                                ┌──────────────┐
      │ Restaurateur │                                │    Client    │
      └──────┬───────┘                                └──────┬───────┘
             │ embarquement,                                 │ scan du QR code,
             │ revendication,                                │ consultation de la carte,
             │ gestion, suivi                                │ commande, paiement
      ┌──────┴────────────────┐                              │
      ▼                       ▼                              ▼
┌────────────┐         ┌───────────┐                  ┌────────────┐
│ Onboarding │         │ Dashboard │                  │  Commande  │
└──────┬─────┘         └─────┬─────┘                  └──────┬─────┘
       │ REST                │ REST + SSE                    │ REST + SSE
       └─────────────────────┼───────────────────────────────┘
                             ▼
                      ┌────────────┐
                      │  Backend   │
                      └──────┬─────┘
                             │
       ┌──────────┬──────────┼─────────────┬────────────────┐
       ▼          ▼          ▼             ▼                ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐ ┌───────────────┐
   │ Stripe │ │  API   │ │ Emails │ │ Imprimante │ │ DNS wildcard  │
   │        │ │ OpenAI │ │        │ │ thermique  │ │ *.surplasse.com│
   └────────┘ └────────┘ └────────┘ └────────────┘ └───────────────┘
```

| Système externe | Rôle |
|---|---|
| Stripe | Paiements client (CB, Apple Pay, Google Pay) et reversement au restaurateur via Stripe Connect ; envoie des webhooks au Backend |
| API OpenAI | Extraction de la carte depuis une photo (vision) et enrichissement de données publiques pour les espaces pré-générés |
| Emails | Magic links d'authentification restaurateur et notifications transactionnelles ; le fournisseur d'envoi reste à trancher (ADR) |
| Imprimante thermique | Impression optionnelle des tickets cuisine en ESC/POS ; le mode d'intégration reste à trancher (ADR) |
| DNS wildcard | L'enregistrement `*.surplasse.com` route chaque mini-site `{slug}.surplasse.com` vers le même point d'entrée |

## Diagramme de conteneurs

Le détail de ce qui tourne sur le VPS :

```
                                Internet
                                   │
              HTTPS                │                webhooks Stripe
   (clients, restaurateurs)        │                (entrants, signés)
                                   ▼
┌──────────────────────────── VPS · Docker Compose ────────────────────────────┐
│                                                                              │
│  ┌────────────────────────── Reverse proxy (TLS) ──────────────────────────┐ │
│  │   surplasse.com      {slug}.surplasse.com      dashboard.surplasse.com  │ │
│  │                        api.surplasse.com                                │ │
│  └───────┬───────────────────┬───────────────────┬──────────────┬──────────┘ │
│          │                   │                   │              │            │
│          ▼                   ▼                   ▼              ▼            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  ┌─────────────┐  │
│  │  Onboarding  │    │   Commande   │    │  Dashboard   │  │ API Quarkus │  │
│  │   (fichiers  │    │   (fichiers  │    │   (fichiers  │  │  (backend/) │  │
│  │   statiques) │    │   statiques) │    │   statiques) │  │             │  │
│  └──────────────┘    └──────┬───────┘    └──────┬───────┘  └──┬───────┬──┘  │
│                             │    REST + SSE     │    REST     │       │     │
│                             │  (suivi commande) │   + SSE ────┘       │     │
│                             └───────────────────┴──►                  │     │
│                                                        ┌──────────────┴──┐  │
│                                                        ▼                 ▼  │
│                                                ┌──────────────┐  ┌────────┐ │
│                                                │ PostgreSQL 17│  │Stockage│ │
│                                                │   (Flyway)   │  │ objet  │ │
│                                                └──────────────┘  │(images)│ │
│                                                                  └────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

Points saillants :

- **Les trois frontends sont des builds statiques.** Vite produit des fichiers servis par un conteneur statique minimal par application, derrière le reverse proxy, sans serveur Node en production (voir [l'exploitation](../operations/index.md)). Le mini-site Commande est une seule application : le reverse proxy route tout `{slug}.surplasse.com` vers le même bundle, qui lit le slug dans l'hôte.
- **L'API Quarkus est le seul processus applicatif.** Elle porte la logique métier, les jobs asynchrones (extraction IA) et les flux SSE ouverts par le Dashboard (nouvelles commandes) et par la page de suivi de Commande (changement de statut).
- **PostgreSQL 17 est l'unique base**, migrée par Flyway, avec des schémas par domaine si besoin.
- **Le stockage objet** héberge les images (photos de cartes envoyées, visuels des produits, ressources des mini-sites). La cible de référence est MinIO, auto-hébergé sur le VPS derrière l'API S3, avec migration possible vers un service S3 compatible ; ce choix sera confirmé par un ADR avec la mise en place de `infra/` (voir [les intégrations](integrations.md)).
- **Les webhooks Stripe entrent par `api.surplasse.com`**, signés, et sont le seul déclencheur de la confirmation d'une commande payée.
- Le reverse proxy de référence est Caddy, qui obtient et renouvelle le certificat wildcard par défi DNS-01 ; ce choix sera consigné en ADR avec la mise en place de `infra/` (voir [l'exploitation](../operations/index.md)).

## Arborescence cible du monorepo

```
surplasse/
├── docs/                    # Documentation Retype (ce site)
├── api/
│   └── openapi.yaml         # Le contrat, source de vérité de l'API
├── backend/                 # Quarkus (Maven multi-modules)
├── frontends/
│   ├── shared/              # Design system, client API généré, utilitaires
│   ├── onboarding/          # surplasse.com
│   ├── commande/            # {slug}.surplasse.com
│   └── dashboard/           # dashboard.surplasse.com
├── infra/                   # Docker Compose, configuration VPS
└── .github/workflows/       # CI/CD
```

| Répertoire | Contenu |
|---|---|
| `docs/` | La présente documentation, construite avec Retype et publiée sur GitHub Pages |
| `api/openapi.yaml` | Le contrat OpenAPI 3.1, point de départ de tout changement d'API |
| `backend/` | L'API Quarkus en Java 21, un module Maven par domaine métier |
| `frontends/shared/` | Le package partagé : design system, client TypeScript généré depuis le contrat, utilitaires communs |
| `frontends/onboarding/` | La vitrine produit et le tunnel d'embarquement des restaurateurs |
| `frontends/commande/` | Le mini-site de l'établissement : carte numérique, commande et paiement client |
| `frontends/dashboard/` | Le suivi des commandes en temps réel, la gestion de la carte et les métriques |
| `infra/` | Les fichiers Docker Compose et la configuration du VPS |
| `.github/workflows/` | Les pipelines GitHub Actions : build, tests, déploiement, publication des docs |

Seuls `docs/` et la configuration racine existent aujourd'hui. Le reste est créé au fil de la [roadmap](../roadmap.md).

## Les deux flux critiques

### Une commande de bout en bout

1. **Scan.** Le client scanne le QR code de sa table. L'URL pointe vers `{slug}.surplasse.com` avec l'identifiant de table en paramètre. Aucun compte, aucune installation.
2. **Carte.** L'application Commande charge la carte de l'établissement via l'API (catégories, produits, options, prix, disponibilités) et l'affiche.
3. **Panier.** Le client compose son panier localement : produits, options, quantités. Le panier n'est qu'un état côté client tant qu'il n'est pas validé.
4. **Paiement.** À la validation, le Backend crée la commande en statut « en attente de paiement » et un PaymentIntent Stripe rattaché au compte Stripe Connect de l'établissement. Le client paie par CB, Apple Pay ou Google Pay, sans quitter le mini-site.
5. **Webhook.** Stripe notifie le Backend par webhook signé que le paiement a réussi. C'est ce webhook, et lui seul, qui fait passer la commande au statut « payée ». Un paiement sans webhook reçu ne transmet jamais de commande en cuisine.
6. **Transmission.** La commande est transmise à l'établissement : le Backend la pousse sur le flux SSE ouvert par le Dashboard, qui l'affiche et la signale immédiatement. Si l'impression est activée, un ticket cuisine part sur l'imprimante thermique.
7. **Statuts.** Le restaurateur fait avancer la commande depuis le Dashboard : « acceptée », « en préparation », « prête », puis « servie » ou « retirée ». Le client suit ces changements en temps réel sur sa page de suivi, alimentée par SSE.

### Un embarquement de bout en bout

1. **Entrée.** Le restaurateur arrive sur Onboarding, soit spontanément, soit via la revendication d'un espace pré-généré pour son établissement.
2. **Photo.** Il fournit le nom de l'établissement et une photo de sa carte, plus quelques images s'il en a.
3. **Extraction.** Le Backend crée un job d'extraction asynchrone : l'API OpenAI (vision) lit la photo et en tire une carte structurée (catégories, produits, options, prix). Le frontend suit l'avancement du job sans bloquer le parcours.
4. **Prévisualisation.** Le restaurateur voit sa carte extraite et son mini-site généré. Il corrige ce que l'extraction a mal lu : c'est une relecture, pas une saisie.
5. **Authentification.** Son compte est créé par magic link envoyé par email. Aucun mot de passe.
6. **Paiements.** Il connecte les encaissements via le parcours Stripe Connect, qui collecte ses informations légales et bancaires. Le type de compte est Connect Express, acté dans l'[ADR-0007](../decisions/adr-0007-stripe.md).
7. **Activation.** Le mini-site est actif sur `{slug}.surplasse.com`, les QR codes de table sont générés, la première commande peut arriver. Le parcours détaillé est décrit dans [l'embarquement du restaurateur](../produit/parcours/onboarding-restaurateur.md).

!!! warning Le webhook est la source de vérité du paiement
Aucune commande n'est transmise en cuisine sur la seule foi d'un retour navigateur. La confirmation vient exclusivement du webhook Stripe signé, vérifié côté Backend. Ce point est développé dans [intégrations](integrations.md) et [sécurité](securite.md).
!!!

## Découpage en domaines métier

Le Backend est découpé en six domaines, chacun étant un module Maven :

| Domaine | Responsabilité |
|---|---|
| **Catalogue** | La carte : établissements, catégories, produits, options, prix, disponibilités |
| **Commande** | Le cycle de vie d'une commande, du panier validé au statut final, et sa diffusion SSE |
| **Paiement** | L'intégration Stripe : PaymentIntents, webhooks, comptes Connect, reversements |
| **Identité** | Les restaurateurs, les magic links, les sessions et les droits sur les établissements |
| **Engagement** | Les espaces pré-générés, la revendication, les relances et les métriques d'usage |
| **Génération** | Les jobs d'extraction IA (API OpenAI), la génération des mini-sites et des QR codes |

Les frontières, les dépendances autorisées entre modules et la structure interne de chaque domaine sont détaillées dans [le backend](backend.md).

## Les pages de cette section

| Page | Contenu |
|---|---|
| [Les frontends](frontends.md) | Les trois applications React, le package partagé, le routage par sous-domaine |
| [Le backend](backend.md) | Le monolithe modulaire Quarkus, les domaines, les jobs asynchrones |
| [Le contrat et l'API](api.md) | Le workflow contract-first, les conventions OpenAPI, la génération de code |
| [Les données](donnees.md) | Le modèle de données PostgreSQL, les migrations Flyway, le stockage objet |
| [Les intégrations](integrations.md) | Stripe, API OpenAI, emails, impression thermique, DNS wildcard |
| [La sécurité](securite.md) | Authentification, webhooks signés, isolation des établissements, RGPD |
