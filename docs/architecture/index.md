---
label: Architecture
order: 20
icon: telescope
description: Principes directeurs, diagrammes de contexte et de conteneurs, flux critiques et découpage en domaines de l'architecture Surplasse.
---

# Vue d'ensemble de l'architecture

Cette page donne la carte générale du système : les principes qui guident chaque décision, les acteurs et les systèmes externes, les conteneurs déployés, les deux flux critiques du produit et le découpage en domaines métier. Les pages suivantes de cette section détaillent chaque bloc.

!!! info État réel au 2026-08-25
Le contrat, le Backend modulaire, les frontends, le cluster local et le Worker sont implémentés. Après un incident 525 de l'origine Atlas, la version vérifiée du Worker sert maintenant l'Onboarding sur les seules Routes de l'apex et de `www`. Les sondes datées prouvent HTTP 200 en IPv4 et IPv6, les redirections 308 et le manifeste du commit actif. Aucun DNS n'existe encore pour `api`, `dashboard`, `docs` ou un slug. Cette remise en ligne statique et la release Atlas ne prouvent donc aucune activation dynamique.
!!!

## Principes directeurs

### Contract-first : le contrat précède le code

Le contrat OpenAPI (`api/openapi.yaml`) est écrit avant toute implémentation. Le Backend implémente des interfaces Java générées depuis le contrat, les frontends consomment des clients TypeScript générés depuis le même fichier. Ce choix élimine toute divergence entre ce que l'API promet et ce que les applications attendent : une modification d'endpoint commence toujours par une modification du contrat, visible en revue, versionnée en git. Pour un développeur seul, c'est aussi le moyen le plus économique de garder quatre applications synchronisées. Le détail est dans [le contrat et l'API](api.md).

### Monolithe modulaire plutôt que microservices

Le Backend est un seul déployable Quarkus, découpé en modules Maven par domaine métier. Un développeur solo n'a ni le temps ni le besoin d'opérer un système distribué : pas de réseau entre les domaines, pas d'orchestration, pas de traçage inter-services, une seule base de données, une seule pile de logs. Les frontières entre domaines existent quand même, imposées par les modules Maven : si un jour un domaine doit être extrait (la génération IA est le candidat le plus probable), la couture est déjà tracée. Le découpage est décrit dans [le backend](backend.md).

### Tout est committé et documenté

Le monorepo contient le contrat, le Backend, les trois frontends, le graphe Compose local, les candidats Cloudflare et Atlas, et cette documentation. `vps-infra` contient séparément la plateforme partagée, les états désirés protégés et le contrôleur de production. Les secrets, les données et les sauvegardes restent hors de Git avec leurs propres preuves. Toute décision structurante est consignée dans un ADR sous `docs/decisions/`. La reconstruction exige donc les deux dépôts canoniques et les éléments opérateur protégés, jamais une configuration implicite de console.

### La simplicité opérationnelle prime

La cible sépare deux responsabilités simples. Un Worker Cloudflare unique sert les quatre builds statiques et filtre le bord. Atlas exécute un seul Backend Quarkus, PostgreSQL, le migrateur et l'observabilité. `compose.yaml` et `compose.development.yaml` décrivent seulement la pile locale. Il n'y a ni D1, ni Durable Objects, ni Queues, ni Kubernetes dans le MVP. Chaque brique ajoutée doit retirer une charge opératoire ou protéger un invariant mesuré. L'[ADR-0048](../decisions/adr-0048-bord-cloudflare-hybride.md), l'[ADR-0041](../decisions/adr-0041-production-testeurs-stripe-test.md), le [runbook Cloudflare](../operations/migration-cloudflare.md) et le [runbook Atlas](../operations/deploiement-compose.md) détaillent cette frontière.

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

## Diagramme de déploiement cible

Ce diagramme décrit la cible après activation, pas l'état public actuel.

```text
                         Internet et Stripe
                                 |
                                 v
                Cloudflare DNS, TLS et sécurité
                                 |
                                 v
                 Worker unique, routeur par Host
                      |                   |
                      |                   +--> api.surplasse.com
                      v                              |
             Workers Static Assets                  v
       Onboarding, Commande, Dashboard, Docs   Cloudflare Tunnel
                                                     |
                                                     v
                                                Caddy Atlas
                                                     |
                                                     v
                                             Backend Quarkus
                                                     |
                                                     v
                                               PostgreSQL 17
```

Points saillants :

- **Les quatre surfaces sont servies comme des fichiers statiques à la cible.** Workers Static Assets porte Onboarding, Commande, Dashboard et Nimbus. Le mini-site Commande reste une seule application qui lit le slug dans l'hôte. Les images NGINX Atlas sont conservées pendant la période de retour arrière, puis retirées dans un commit séparé.
- **L'API Quarkus est le seul processus qui porte la logique métier.** Elle porte aussi les futurs jobs asynchrones d'extraction IA et les flux SSE ouverts par le Dashboard et par la page de suivi de Commande.
- **PostgreSQL 17 est l'unique base**, migrée par Flyway, avec des schémas par domaine si besoin.
- **Le stockage objet est une cible ultérieure.** R2 n'est pas créé avant l'implémentation du domaine `generation`. Son ajout exigera un bucket privé, une politique de cycle de vie, un export et une restauration documentés (voir [les intégrations](integrations.md)).
- **Les webhooks Stripe entrent par `api.surplasse.com`**, signés, et sont le seul déclencheur de la confirmation d'une commande payée.
- **Le Worker est le bord public cible.** Caddy reste le bord local et le proxy d'origine Atlas. Le Worker transmet l'API sans consommer le corps ou le stream. `vps-infra` possède DNS, Routes Worker, Tunnel et l'activation.

## Arborescence cible du monorepo

```
surplasse/
├── docs/                    # Source Markdown de la documentation Nimbus
├── docs-nimbus/             # Rendu Nimbus et adaptateur
├── api/
│   └── openapi.yaml         # Le contrat, source de vérité de l'API
├── backend/                 # Quarkus (Maven multi-modules)
├── compose.yaml             # Graphe du développement intégré
├── compose.development.yaml # Surcharge du profil development
├── deployment/cloudflare/   # Worker et candidat statique sans secret
├── deployment/vps/          # Fragment applicatif et intégrations Atlas sans secret
├── frontends/
│   ├── shared/              # Design system, client API généré, utilitaires
│   ├── onboarding/          # surplasse.com
│   ├── commande/            # {slug}.surplasse.com
│   └── dashboard/           # dashboard.surplasse.com
├── infra/                   # Images et configuration Caddy
└── .github/workflows/       # CI/CD
```

| Répertoire | Contenu |
|---|---|
| `docs/` et `docs-nimbus/` | La présente documentation, construite avec Nimbus et publiée sur son domaine dédié ainsi que sur GitHub Pages |
| `api/openapi.yaml` | Le contrat OpenAPI 3.1, point de départ de tout changement d'API |
| `backend/` | L'API Quarkus 3.37.4 en Java 25, un module Maven par domaine métier |
| `frontends/shared/` | Le package partagé : design system, client TypeScript généré depuis le contrat, utilitaires communs |
| `frontends/onboarding/` | La vitrine produit et le tunnel d'embarquement des restaurateurs |
| `frontends/commande/` | Le mini-site de l'établissement : carte numérique, commande et paiement client |
| `frontends/dashboard/` | Le suivi des commandes en temps réel, la gestion de la carte et les métriques |
| `compose.yaml` et `compose.development.yaml` | Le graphe du développement intégré et sa surcharge locale |
| `deployment/cloudflare/` | Le Worker, l'assemblage statique, les tests de routage et la configuration de candidat sans secret |
| `deployment/vps/` | Le fragment Compose applicatif, la route, les cibles d'observabilité et les sondes publiés pour Atlas |
| `infra/` | Les Dockerfiles applicatifs, la configuration Caddy locale et les recettes d'exécution |
| `.github/workflows/` | Les pipelines GitHub Actions : build, tests, déploiement, publication des docs |

Le Backend, Commande, le Dashboard, la préfiguration de l'Onboarding, Nimbus et le cluster Compose sont livrés localement. Le candidat Cloudflare est construit et testé sans être uploadé. Le candidat Atlas est publié sans prouver l'activation dynamique. Les modules encore absents sont créés au fil de la [roadmap](../roadmap.md).

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
6. **Paiements.** Il connecte les encaissements dans les composants Stripe intégrés, qui collectent directement ses informations légales et bancaires. Le Backend crée le compte Accounts v2 et suit ses capacités selon l'[ADR-0020](../decisions/adr-0020-accounts-v2-onboarding-embarque.md).
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
