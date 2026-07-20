---
label: Modèle de données
order: 50
icon: database
description: Le modèle de données de référence de Surplasse, entités par domaine, machine à états de la commande, invariants et rétention RGPD.
---

# Modèle de données

Cette page décrit le modèle de données de référence de Surplasse. Le [backend](./backend.md) est le seul à accéder à la base : les frontends passent exclusivement par [le contrat OpenAPI](./api.md). Les domaines catalogue, commande, paiement et identité sont matérialisés par les migrations Flyway V1 à V13 ; les autres domaines restent la cible à implémenter.

## Principes

| Principe | Règle |
|---|---|
| Base unique | PostgreSQL 17, une seule base pour tous les domaines |
| Migrations | Flyway exclusivement, versionnées, jamais de DDL manuel |
| Identifiants | UUID (v7 recommandé pour l'ordre d'insertion, à confirmer par ADR) |
| Horodatages | UTC partout, colonnes `created_at` et `updated_at` sur chaque table |
| Montants | Entiers en centimes d'euro, EUR seul au MVP, jamais de flottant |
| Suppression | Soft delete (`deleted_at`) uniquement où le métier l'exige, sinon suppression physique |
| Données personnelles | Aucune donnée personnelle sans nécessité, minimisation par défaut |
| Nommage | Tables et colonnes en `snake_case`, statuts en texte avec contrainte `CHECK` |

Le soft delete est réservé aux entités référencées par l'historique des commandes, en pratique `Product` et `Option` : un produit retiré de la carte reste lisible dans les commandes passées. Tout le reste (catégories vides, tables QR obsolètes, sessions expirées) se supprime physiquement.

Le découpage en schémas PostgreSQL par domaine (`identity`, `catalog`, `order`, `payment`, `engagement`, `generation`) est une option ouverte : le MVP démarre dans le schéma `public`, la décision sera consignée en ADR si le besoin de cloisonnement se confirme.

!!! info Pourquoi des centimes
Les montants sont stockés en entiers (`price_cents`, `total_cents`) pour éliminer toute erreur d'arrondi flottant. La conversion en euros est une affaire d'affichage, jamais de stockage. L'ajout d'autres devises passerait par une colonne `currency` déjà présente sur `Payment`.
!!!

## Vue d'ensemble

Le modèle s'organise en six domaines, alignés sur les modules Maven du [backend](./backend.md) : Identité, Catalogue, Commande, Paiement, Engagement, Génération.

```
IDENTITÉ                                      CATALOGUE
+--------------+ 1                          n   +---------------+ 1        1 +-------+
| Restaurateur |------------------------------->| Establishment |<-----------| Space |
+------+-------+                                +---------------+            +-------+
       | 1                                        | 1    | 1
       +----------n--> +------------------+        |      +--------n--> +---------+
       |               | MagicLinkSession |        |                    | TableQr |
       |               +------------------+        | n                  +---------+
       +----------n--> +----------------------+  +------+
                       | RestaurateurSession |  | Menu |
                       +----------------------+  +------+
                                                  | 1
                                                  | n
                                            +----------+ 1      n +---------+
                                            | Category |--------->| Product |
                                            +----------+          +---------+
                                                       | 1
                                                       | n
                                             +-------------+ 1     n +--------+
                                             | OptionGroup |-------->| Option |
                                             +-------------+         +--------+

COMMANDE                                      ENGAGEMENT
+---------------+ 1     n +-------+           +-----------------+ 1  n +------------------+
| Establishment |-------->| Order |           | CustomerContact |----->| MarketingConsent |
+---------------+         +-------+           +-----------------+      +------------------+
                            | 1   | 1               ^ 0..1
                            |     |                 |
                            | n   | n          +--------+       +-------+
                    +-----------+              | Review |<--1---| Order |
                    | OrderLine |              +--------+       +-------+
                    +-----------+                                  | 1
                            |                                      | n
                            | réf. Product                    +-----+
                            v                                 | Tip |
                    +---------+                               +-----+
                    | Payment |  (1 Order -> n Payment)
                    +---------+

GÉNÉRATION                                    MÉDIAS
+---------------+ 1        n +---------------+  +------------+ 0..1  +---------+
| Establishment |----------->| ExtractionJob |  | MediaAsset |<------| Product |
+---------------+            +---------------+  +------------+       +---------+
                                                (uploaded | generated)
```

## Entités par domaine

### Identité

**Restaurateur** : le professionnel qui gère un ou plusieurs établissements. Aucun mot de passe : l'authentification passe par magic link.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `email` | text | unique, non nul | Identifiant de connexion, cible du magic link |
| `full_name` | text | non nul | |
| `phone` | text | nullable | Facultatif, jamais exigé |
| `last_login_at` | timestamptz | nullable | |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**MagicLinkSession** : un lien de connexion à usage unique. Le jeton n'est jamais stocké en clair.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `restaurateur_id` | uuid | FK Restaurateur | |
| `token_hash` | text | unique, non nul | Hachage du jeton envoyé par email |
| `expires_at` | timestamptz | non nul | Validité de 15 minutes |
| `consumed_at` | timestamptz | nullable | Non nul dès la première utilisation |
| `invalidated_at` | timestamptz | nullable | Non nul quand une nouvelle demande invalide ce lien inutilisé |
| `created_at` | timestamptz | non nul | Lignes expirées purgées automatiquement |

**RestaurateurSession** : un refresh token rotatif d'une session Dashboard. Chaque jeton forme une ligne afin de détecter le rejeu d'un ancien refresh token. Le JWT court n'est pas persisté.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | Identifiant de cette rotation |
| `restaurateur_id` | uuid | FK Restaurateur | |
| `family_id` | uuid | non nul, index | Regroupe toutes les rotations d'une connexion |
| `token_hash` | text | unique, non nul | Empreinte du refresh token opaque, jamais le jeton en clair |
| `expires_at` | timestamptz | non nul | 30 jours après l'ouverture de la famille |
| `rotated_at` | timestamptz | nullable | Non nul dès que ce jeton a produit sa rotation suivante |
| `revoked_at` | timestamptz | nullable | Révocation explicite ou détection d'un rejeu dans la famille |
| `created_at` | timestamptz | non nul | Les lignes sont conservées jusqu'à expiration pour détecter le rejeu |

### Catalogue

**Establishment** : le restaurant en tant qu'entité. Le `slug` détermine le sous-domaine du mini-site.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `restaurateur_id` | uuid | FK, nullable | Nul tant que l'espace n'est pas revendiqué |
| `name` | text | non nul | |
| `slug` | text | unique, non nul | Sous-domaine `{slug}.surplasse.com` |
| `address` | text | nullable | |
| `status` | text | CHECK | Voir le cycle de vie plus bas |
| `order_intake_status` | text | CHECK `open`, `paused`, non nul, défaut `paused` | État opérationnel des nouvelles sessions de table, commandes et sessions de paiement, distinct du cycle de vie |
| `order_intake_updated_at` | timestamptz | non nul | Date du dernier changement du statut configuré, y compris une auto-pause Stripe ; une mise à jour idempotente ou un changement des seuls prérequis effectifs la conserve |
| `stripe_account_id` | text | unique, nullable | Compte Connect utilisé pour les charges directes ; nul tant que le paiement n'est pas provisionné |
| `stripe_card_payments_active` | boolean | non nul, défaut `false` | Copie fermée de `configuration.merchant.capabilities.card_payments.status=active` ; `false` bloque une nouvelle session de paiement |
| `stripe_payouts_active` | boolean | non nul, défaut `false` | Copie fermée de `configuration.merchant.capabilities.stripe_balance.payouts.status=active` |
| `stripe_capabilities_updated_at` | timestamptz | nullable | Date Stripe du dernier snapshot appliqué ; une livraison plus ancienne est ignorée et une égalité fusionne de manière restrictive |
| `activated_at` | timestamptz | non nul si `active` | Départ des trois mois sans commission Surplasse |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**Space** : les métadonnées de pré-génération d'un établissement identifié en ligne, et son statut de revendication. Un espace correspond à exactement un établissement.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK, unique | Relation 1 pour 1 |
| `status` | text | CHECK | `pregenerated` (pré-généré), `claiming` (revendication en cours), `claimed` (revendiqué) |
| `source` | jsonb | | Données publiques collectées à la pré-génération |
| `claim_token_hash` | text | nullable | Preuve envoyée lors de la revendication |
| `claimed_at` | timestamptz | nullable | |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**Menu** : le menu de l'établissement. Au MVP, une seule carte active par établissement (contrainte à porter en service).

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK | |
| `name` | text | non nul | Exemple : « Carte principale » |
| `status` | text | CHECK | `draft` (brouillon) ou `published` (publiée) |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**Category** : une section de la carte (entrées, plats, boissons).

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `menu_id` | uuid | FK | |
| `name` | text | non nul | |
| `position` | integer | non nul | Ordre d'affichage sur le mini-site |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**Product** : un plat, une boisson ou tout article commandable. Soft delete obligatoire : des lignes de commande le référencent.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `category_id` | uuid | FK | |
| `name` | text | non nul | |
| `description` | text | nullable | |
| `price_cents` | integer | >= 0, non nul | Prix courant, copié dans la ligne à la commande |
| `available` | boolean | non nul | Rupture temporaire sans retirer de la carte |
| `position` | integer | non nul | Ordre d'affichage dans la catégorie |
| `image_asset_id` | uuid | FK MediaAsset, nullable | Image affichée : photo téléversée ou visuel généré retenu, ou aucune |
| `deleted_at` | timestamptz | nullable | Soft delete |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**MediaAsset** : une image stockée (objet dans le stockage S3-compatible), qu'elle soit téléversée par le restaurateur ou générée par l'IA à l'embarquement. Un produit référence au plus un `MediaAsset` comme image affichée ; les visuels générés non retenus restent en base au statut `proposed` tant que le restaurateur ne les a pas écartés.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK | Toutes les images appartiennent à un établissement |
| `kind` | text | CHECK | `dish`, `place`, `logo`, `menu_scan` |
| `source` | text | CHECK | `uploaded` (photo du restaurateur) ou `generated` (visuel produit par l'IA) |
| `status` | text | CHECK | `proposed` (candidat généré), `selected` (retenu), `archived` |
| `storage_key` | text | non nul | Clé de l'objet dans le stockage S3-compatible |
| `source_asset_id` | uuid | FK MediaAsset, nullable | Pour un `generated`, la photo fournie qui a servi de source |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**OptionGroup** : un ensemble d'options d'un produit (cuisson, taille, suppléments), avec ses règles de choix.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `product_id` | uuid | FK | |
| `name` | text | non nul | Exemple : « Cuisson » |
| `min_choices` | integer | >= 0 | 1 et plus rend le groupe obligatoire |
| `max_choices` | integer | >= min_choices | |
| `position` | integer | non nul | |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**Option** : une variante ou un supplément à l'intérieur d'un groupe. Soft delete pour la même raison que `Product`.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `option_group_id` | uuid | FK | |
| `name` | text | non nul | |
| `extra_cost_cents` | integer | >= 0, défaut 0 | |
| `available` | boolean | non nul | |
| `position` | integer | non nul | Ordre d'affichage dans le groupe |
| `deleted_at` | timestamptz | nullable | Soft delete |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**TableQr** : un support physique (chevalet, autocollant) portant un QR code, rattaché à un emplacement de l'établissement.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK, non nul | Une table appartient à un seul établissement |
| `label` | text | non nul | Exemple : « Table 4 », « Comptoir » |
| `code` | text | unique, non nul | Encodé dans le QR, non séquentiel |
| `active` | boolean | non nul | Désactivation sans suppression en cas de perte |
| `created_at`, `updated_at` | timestamptz | non nuls | |

### Commande

**TableSession** : la session anonyme du client, obtenue au scan du QR et liée à un établissement et à une table (voir [la sécurité](securite.md)). Le jeton remis au client est opaque et stocké haché : une fuite de base ne permet pas de détourner une session. L'expiration est glissante (2 heures, prolongée à chaque usage actif).

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK, non nul | |
| `table_qr_id` | uuid | FK, non nul | La table du QR effectivement scanné |
| `token_hash` | text | unique, non nul | Hachage du jeton opaque remis au client |
| `expires_at` | timestamptz | non nul | Glissante ; lignes expirées purgées automatiquement |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**Order** : l'acte d'achat d'un client, sur place ou à emporter. Le panier n'est pas une commande : c'est un état purement côté client (application Commande), qui ne touche jamais la base. À la validation du panier, le Backend crée la commande directement au statut `pending_payment` (en attente de paiement).

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK, non nul | |
| `table_qr_id` | uuid | FK, nullable | Nul pour une commande à emporter |
| `table_session_id` | uuid | FK, nullable | Non nul sur place ; session anonyme exacte qui a créé la commande |
| `type` | text | CHECK | `on_site` (sur place) ou `takeaway` (à emporter) |
| `status` | text | CHECK | Voir la machine à états |
| `display_number` | text | non nul | Numéro court, unique par établissement et par jour |
| `customer_first_name` | text | nullable | Donnée personnelle minimale, pour l'appel au comptoir ; anonymisée après 24 h (voir [RGPD](../operations/rgpd.md)) |
| `contact_email` | text | nullable | Fourni au besoin pour le reçu ou la confirmation d'une commande à emporter ; effacé après 30 jours (voir [RGPD](../operations/rgpd.md)) |
| `total_cents` | integer | >= 0, non nul | Somme des lignes, figée au paiement |
| `service_day` | date | non nul | Jour de service ; porte l'unicité de `display_number` |
| `tracking_token` | text | unique, non nul | Capacité de suivi non devinable, portée par l'URL de la page de suivi |
| `idempotency_key` | uuid | unique, non nul | Clé d'idempotence de la création (en-tête `Idempotency-Key`) |
| `request_hash` | text | non nul | Empreinte du payload d'origine ; détecte la réutilisation de la clé avec un autre contenu |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**OrderLine** : un produit commandé, avec son prix et ses options figés au moment de la commande.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `order_id` | uuid | FK, non nul | |
| `product_id` | uuid | FK, non nul | Référence, peut pointer un produit soft-deleted |
| `product_name` | text | non nul | Figé à la commande |
| `unit_price_cents` | integer | >= 0, non nul | Figé à la commande |
| `quantity` | integer | >= 1, non nul | |
| `options_json` | jsonb | non nul, défaut `[]` | Instantané dénormalisé des options choisies |
| `note` | text | nullable | Note libre du client, transmise telle quelle en cuisine |
| `line_total_cents` | integer | >= 0, non nul | (prix unitaire + surcoûts) x quantité |
| `position` | integer | non nul | Ordre d'affichage des lignes, celui du panier |

`options_json` est un instantané dénormalisé volontaire : chaque option choisie y est copiée avec son libellé et son surcoût au moment T (exemple : `[{"group": "Cuisson", "option": "Saignant", "extra_cost_cents": 0}]`). La carte évolue en permanence (prix modifiés, options renommées ou supprimées), alors qu'une commande payée est une archive comptable. Sans cet instantané, renommer une option réécrirait silencieusement l'historique, et supprimer un groupe casserait des jointures. Le prix et le nom du produit sont figés dans la ligne pour la même raison.

**OrderEvent** : un événement de commande diffusé en SSE, persisté pour que les reconnexions rejouent ce qu'elles ont manqué via `Last-Event-ID` (voir [le backend](backend.md)). L'identifiant `bigserial` est l'identifiant monotone des événements du protocole SSE.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | bigserial | PK | Monotone, sert d'identifiant d'événement SSE |
| `establishment_id` | uuid | FK, non nul | Canal par établissement (Dashboard) |
| `order_id` | uuid | FK, non nul | Canal par commande (page de suivi) |
| `event_type` | text | non nul | Exemple : `order-status` |
| `payload` | jsonb | non nul | Données de l'événement, telles que diffusées |
| `created_at` | timestamptz | non nul | |

**Payment** : une tentative de paiement Stripe rattachée à une commande. Aucune donnée de carte bancaire ne transite ni n'est stockée : tout reste chez Stripe.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `order_id` | uuid | FK, unique, non nul | Un seul paiement pour toute la durée de vie de la commande |
| `establishment_id` | uuid | FK, non nul | Filtrage par établissement des requêtes restaurateur |
| `provider` | text | CHECK | `stripe` au MVP |
| `external_reference` | text | non nul | Référence interne pendant `creating`, puis identifiant du Payment Intent Stripe ; unique avec le compte connecté |
| `status` | text | CHECK | `creating` (réservation avant Stripe), `pending` (en attente), `succeeded` (réussi), `failed` (ancien échec retentable), `refunded` (remboursé) |
| `creation_key` | uuid | nullable, non nul si `creating` | Clé stable transmise à Stripe par toute requête concurrente qui termine la réservation |
| `connected_account_id` | text | non nul | Compte Connect figé avant Stripe ; V11 refuse tout ancien paiement plateforme impossible à rattacher sûrement |
| `application_fee_amount` | integer | >= 0 et < montant | Commission Surplasse figée en centimes ; 0 pendant la période gratuite |
| `amount_cents` | integer | > 0, non nul | Commande plus pourboire éventuel |
| `currency` | text | non nul, défaut `EUR` | EUR seul au MVP |
| `client_secret` | text | nullable | Secret client du Payment Intent, consommé par le Payment Element |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**PaymentRequest** (`payment_request`) : une intention de création de paiement identifiée par la clé d'idempotence du client. Plusieurs intentions peuvent pointer vers le même paiement encore en attente, sans créer de second débit.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `idempotency_key` | uuid | PK | Clé reçue dans `Idempotency-Key` et transmise à Stripe lors de la création |
| `payment_id` | uuid | FK, non nul | Session de paiement rendue pour cette intention |
| `order_id` | uuid | FK, non nul | Détecte la réutilisation de la clé avec une autre commande |
| `establishment_id` | uuid | FK, non nul | Garantit le cloisonnement entre établissements |
| `table_session_id` | uuid | FK, non nul | Empêche une autre session, même à la même table, de reprendre le paiement |
| `created_at` | timestamptz | non nul | |

**StripeWebhookEvent** (`stripe_webhook_event`) : les identifiants d'événements Stripe déjà traités, avec contrainte d'unicité. C'est la garantie d'idempotence du webhook (voir [la sécurité](securite.md)) : une livraison dupliquée est acquittée sans effet.

### Engagement

**CustomerContact** : un contact client, créé uniquement à l'opt-in explicite (le client final n'a jamais de compte). Sans opt-in, aucune ligne n'existe.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK, non nul | Le contact appartient au restaurant, pas à Surplasse |
| `email` | text | non nul, unique par établissement | |
| `first_name` | text | nullable | |
| `source` | text | CHECK | `order` (commande), `review` (avis) |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**Review** : le retour d'un client après une commande, une seule fois par commande.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `order_id` | uuid | FK, unique | Un avis par commande au maximum |
| `customer_contact_id` | uuid | FK, nullable | Nul si le client n'a pas opté pour le contact |
| `rating` | smallint | entre 1 et 5 | |
| `comment` | text | nullable | |
| `created_at` | timestamptz | non nul | |

**Tip** : un pourboire laissé lors du paiement, reversé au restaurant.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `order_id` | uuid | FK, non nul | |
| `payment_id` | uuid | FK, non nul | Encaissé dans le même paiement |
| `amount_cents` | integer | > 0, non nul | |
| `created_at` | timestamptz | non nul | |

**MarketingConsent** : l'historique des consentements d'un contact, en ajout seul (append-only) pour servir de preuve.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `customer_contact_id` | uuid | FK, non nul | |
| `channel` | text | CHECK | `email` au MVP |
| `granted` | boolean | non nul | `false` enregistre un retrait |
| `context` | jsonb | non nul | Où et comment le consentement a été recueilli |
| `created_at` | timestamptz | non nul | Jamais de mise à jour ni de suppression |

### Génération

**ExtractionJob** : un travail asynchrone confié à l'API OpenAI, qu'il s'agisse d'extraction (carte depuis photo, enrichissement depuis données publiques) ou de génération de visuels de plats à partir des photos fournies. Le résultat est une proposition que le restaurateur valide dans le Dashboard, jamais une écriture directe dans le Catalogue : une extraction produit une carte structurée à relire, une génération produit des `MediaAsset` au statut `proposed` à retenir ou écarter.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK, non nul | |
| `type` | text | CHECK | `menu_photo` (carte depuis photo), `public_enrichment` (enrichissement public), `dish_visuals` (génération de visuels de plats) |
| `status` | text | CHECK | `pending` (en attente), `running` (en cours), `succeeded` (réussi), `failed` (échoué) |
| `input_payload` | jsonb | non nul | Références des images et paramètres |
| `result` | jsonb | nullable | Carte structurée proposée |
| `error` | text | nullable | Message en cas d'échec |
| `attempts` | integer | non nul, défaut 0 | |
| `created_at`, `updated_at` | timestamptz | non nuls | |

La durée de conservation des payloads et des photos sources après validation de la carte reste à trancher (purge candidate : 30 jours).

## Machine à états de la commande

Le panier vit côté client : la commande naît en base au statut `pending_payment`, à la validation du panier. Il n'existe pas d'état « brouillon » persisté.

```
(panier côté client)
    |
    | validation du panier : création de la commande
    v
pending_payment ------------------------------> cancelled
    |                        (expiration, abandon, refus)
    | confirmation du paiement (webhook Stripe)
    v
paid --------------------------------------+
    |                                      |
    | acceptation par le restaurateur      |
    v                                      |
accepted -------------------------------+  |
    |                                   |  |
    | mise en préparation               +--+---> refunded
    v                                   |  |
preparing ------------------------------+  |
    |                                      |
    | fin de préparation                   |
    v                                      |
ready ----------------------------------+--+
    |
    +---> served     (sur place)
    +---> picked_up  (à emporter)
```

Glose des statuts : `paid` (payée), `accepted` (acceptée), `preparing` (en préparation), `ready` (prête), `served` (servie), `picked_up` (retirée), `cancelled` (annulée), `refunded` (remboursée).

| Depuis | Vers | Déclencheur | Qui |
|---|---|---|---|
| (panier côté client) | `pending_payment` | Validation du panier : création de la commande | Client (application Commande) |
| `pending_payment` | `paid` | Paiement confirmé par webhook | Système (Stripe) |
| `pending_payment` | `cancelled` | Expiration du délai ou abandon | Système ou client |
| `paid` | `accepted` | Acceptation de la commande | Restaurateur (Dashboard) |
| `paid` | `refunded` | Refus de la commande, remboursement intégral | Restaurateur (Dashboard) |
| `accepted` | `preparing` | Passage en cuisine | Restaurateur (Dashboard) |
| `accepted`, `preparing`, `ready` | `refunded` | Incident (rupture, erreur), remboursement | Restaurateur (Dashboard) |
| `preparing` | `ready` | Fin de préparation | Restaurateur (Dashboard) |
| `ready` | `served` | Commande apportée à table (sur place) | Restaurateur (Dashboard) |
| `ready` | `picked_up` | Commande remise au comptoir (à emporter) | Restaurateur (Dashboard) |

Toute transition hors de ce tableau est rejetée par le service. `cancelled` et `refunded` sont des états terminaux, comme `served` et `picked_up`. Le remboursement partiel n'est pas couvert au MVP : la question est ouverte et sera tranchée par ADR.

!!! warning Le webhook fait foi
Le passage à `paid` ne s'appuie jamais sur le retour navigateur du client : seul le webhook Stripe, vérifié par signature, déclenche la transition. Un retour navigateur sans webhook laisse la commande en attente de paiement.
!!!

## Cycle de vie de l'établissement

```
pregenerated (espace pré-généré) --> claimed (revendiqué) --> configuring (en configuration) --> active (actif) <--> suspended (suspendu)
```

| Statut | Signification | Entrée dans le statut |
|---|---|---|
| `pregenerated` | L'établissement a été identifié en ligne et son espace créé, aucun restaurateur associé | Pré-génération par le domaine Génération |
| `claimed` | Un restaurateur a prouvé qu'il est le propriétaire (revendication validée) | Revendication via l'application Onboarding |
| `configuring` | Le restaurateur complète sa carte, ses tables, son compte Stripe | Premier accès au Dashboard après revendication |
| `active` | Le mini-site est public et l'établissement peut être ouvert opérationnellement | Activation par le restaurateur, prérequis vérifiés |
| `suspended` | L'établissement est suspendu au niveau de la plateforme, hors pause ordinaire d'un service | Décision administrative du restaurateur ou de Surplasse |

Un établissement créé directement par l'embarquement (sans pré-génération) entre dans le cycle au statut `configuring` : son espace est créé déjà revendiqué. `suspended` est réversible vers `active`. Il ne sert jamais à ouvrir ou fermer un service courant. La suppression définitive d'un établissement est un processus RGPD à part, décrit dans [Opérations : RGPD](../operations/rgpd.md).

## État opérationnel de prise de commandes

`Establishment.order_intake_status` répond à une question distincte du cycle de vie : l'établissement accepte-t-il de nouvelles opérations de commande maintenant ? Ses deux valeurs sont `open` et `paused`. Le défaut `paused` impose une ouverture explicite et garantit qu'une production nouvellement provisionnée ne reçoit aucune commande par accident.

La disponibilité exposée par le contrat est calculée. `acceptingOrders` vaut `true` uniquement si l'état opérationnel vaut `open`, si le cycle de vie vaut `active`, si une carte est publiée, si une table est active et si le compte Stripe Connect peut créer des charges. Sinon, `blockedReason` précise la cause effective : `paused`, `establishment_not_active`, `configuration_unavailable` pour une carte ou une table absente, ou `payments_unavailable`.

```
order_intake_status = paused  ---------------------------> open
                              ouverture explicite et
                              prérequis tous vérifiés

open ------------------------> paused
     pause explicite ou card_payments non active
```

La pause ferme les nouvelles sessions de table, commandes et sessions de paiement. Elle ne masque pas la carte et ne change aucune commande existante. Les pages de suivi, les flux SSE, les opérations du Dashboard et les webhooks Stripe restent disponibles. Une récupération de `card_payments` ne rouvre jamais automatiquement la prise de commandes. La décision et sa frontière transactionnelle sont fixées dans l'[ADR-0020](../decisions/adr-0020-accounts-v2-onboarding-embarque.md).

## Migrations Flyway effectivement livrées

| Version | Module | Contenu principal |
|---|---|---|
| V1 | `catalog` | établissements et carte |
| V2 | `catalog` | tables et supports QR |
| V3 | `order` | commandes et suivi |
| V4 | `payment` | paiements et webhooks Stripe |
| V5 | `identity` | restaurateurs, magic links, familles de refresh tokens, rattachement des établissements |
| V6 | `order` | index partiel de pagination des commandes opérationnelles |
| V7 | `payment` | intentions idempotentes de création de paiement |
| V8 | `order` | rattachement d'une commande à sa session de table exacte |
| V9 | `payment`, `order`, `order_event` | réservation concurrente avant Stripe et rapprochement des anciens états scindés |
| V10 | `catalog` | compte Connect, capacités et date d'activation de l'établissement |
| V11 | `payment` | compte Connect et commission figés sur le paiement, unicité de la référence par compte |
| V12 | `catalog` | état opérationnel de prise de commandes, fermé par défaut et horodaté |
| V13 | `catalog` | renommage des capacités v1 vers les états Accounts v2 `card_payments` et `payouts` |

V5 vit dans `backend/identity/src/main/resources/db/migration/V5__identity_schema.sql`. Le seed local associe le compte de démonstration à l'établissement pilote ; il n'est jamais chargé en production. V6 vit dans `backend/order/src/main/resources/db/migration/V6__operational_order_index.sql`. Son index partiel couvre `(establishment_id, created_at DESC, id DESC)` uniquement pour `paid`, `accepted`, `preparing` et `ready`, soit la file active lue par le Dashboard. V7 vit dans `backend/payment/src/main/resources/db/migration/V7__payment_idempotency.sql` et rattache chaque clé de requête à la session de paiement effectivement rendue. V8 vit dans `backend/order/src/main/resources/db/migration/V8__order_table_session_scope.sql`, reconstitue la session uniquement quand une seule session encore active au moment de la commande correspond, refuse une reprise absente ou ambiguë et conserve ensuite la session exacte. V9 vit dans `backend/payment/src/main/resources/db/migration/V9__reconcile_payment_order.sql`. Elle introduit l'état court `creating`, impose avec `payment_order_unique_idx` un seul paiement pour toute la vie d'une commande et répare une éventuelle commande restée `pending_payment` alors que son paiement était déjà `succeeded`. Si une base héritée contient un paiement `failed` ou plusieurs paiements pour une commande, la migration s'arrête afin d'imposer leur rapprochement Stripe et l'annulation des Payment Intents surnuméraires avant déploiement. V10 ajoute le routage Connect. Pour un établissement déjà actif sans date fiable, elle démarre une nouvelle période gratuite au moment de la migration, jamais à sa date de création. V11 refuse toute base contenant encore un ancien paiement plateforme : aucun compte Connect ne peut être inféré sans preuve Stripe, et le contrat exige ce compte sur chaque session. V12 ajoute `order_intake_status` et `order_intake_updated_at` avec un défaut fermé ; le seed de démonstration ouvre explicitement son établissement. V13 renomme les copies de capacités sans changer leurs valeurs, afin que le schéma exprime la source Accounts v2.

V8 à V13 sont des migrations de fondation livrées avant la toute première production. Aucun SHA de production antérieur ne leur est compatible et aucun retour binaire vers un SHA pré-V13 n'est autorisé. Le premier SHA déclaré sain en production inclut nécessairement V13. À partir de cette base, toute évolution incompatible suit une séquence expansion, déploiement du code compatible, puis contraction dans une migration ultérieure.

Flyway applique V1 à V13 au démarrage de l'assemblage Backend. Les tables et colonnes ajoutées appartiennent à l'unique base PostgreSQL. Elles sont donc incluses dans chaque `pg_dump`, dans la copie chiffrée hors VPS et dans l'exercice trimestriel de restauration. Elles n'ajoutent ni volume ni sauvegarde séparés. Les index V6 à V11 ne contiennent aucune donnée supplémentaire à sauvegarder : PostgreSQL les restaure avec le schéma. Une restauration doit vérifier que Flyway voit V13 comme appliquée, que les index `order_operational_page_idx`, `payment_request_payment_idx`, `order_table_session_idx`, `payment_order_unique_idx`, `establishment_stripe_account_unique_idx` et `payment_stripe_reference_account_unique_idx` existent, que `order_intake_status` vaut `paused` ou `open` et que les liens entre `restaurateur`, `establishment`, `table_session`, `order`, `payment` et `payment_request` sont cohérents.

## Invariants métier

| Invariant | Garantie |
|---|---|
| Une commande payée ne change plus de contenu (lignes, quantités, montants) | Service, plus trigger de protection en base à l'étude |
| Le prix d'une ligne est figé à la commande, jamais recalculé depuis le Catalogue | Copie dans `OrderLine` à la création |
| `total_cents` d'une commande égale la somme des `line_total_cents` | Service, vérifié avant création du Payment Intent |
| Une table appartient à un seul établissement | FK non nulle sur `TableQr.establishment_id` |
| Une commande sur place référence une table de son propre établissement | Service (la FK seule ne suffit pas) |
| Seule la session de table qui a créé une commande peut en ouvrir ou reprendre le paiement | `Order.table_session_id`, `PaymentRequest.table_session_id` et filtrage du service |
| Une commande ne possède qu'un seul paiement sur toute sa durée de vie, même avec plusieurs requêtes simultanées | verrou sur `Order`, état `Payment.creating`, index unique `payment_order_unique_idx` et `Payment.creation_key` stable |
| Une nouvelle session de paiement utilise le compte Connect encaissable de l'établissement, sans repli plateforme | `Establishment.stripe_account_id`, `stripe_card_payments_active`, relecture Accounts v2, snapshot `Payment.connected_account_id` et échec métier fermé |
| Après le commit d'une pause, aucune nouvelle session de table, commande ou session de paiement n'est admise | `Establishment.order_intake_status`, verrou partagé à l'admission et verrou exclusif à la pause |
| Une pause ne coupe ni le suivi, ni le Dashboard, ni le traitement d'un paiement déjà engagé | Le contrôle d'admission reste absent des lectures existantes, des transitions opérationnelles, des flux SSE et des webhooks |
| Un webhook Connect ne peut modifier que le paiement du même compte | rapprochement par `(Payment.connected_account_id, Payment.external_reference)` et contrôle de `livemode` |
| Un produit référencé par une ligne de commande n'est jamais supprimé physiquement | Soft delete, FK en `ON DELETE RESTRICT` |
| Un espace revendiqué a exactement un restaurateur associé | Service, cohérence `Space.status` et `Establishment.restaurateur_id` |
| Un `slug` d'établissement est unique et immuable après activation | Contrainte unique, immuabilité en service |
| Un avis référence une commande terminée (servie ou retirée) | Service |
| Aucune ligne `CustomerContact` sans opt-in explicite tracé dans `MarketingConsent` | Service, création atomique des deux lignes |

Les garanties « service » sont portées par la logique métier du [backend](./backend.md), les garanties « base » par les migrations Flyway. Quand les deux sont possibles, la base sert de filet de sécurité et le service de règle première.

## Rétention et RGPD

Le tableau ci-dessous résume la politique par entité. Les procédures détaillées (registre des traitements, exercice des droits, purges automatiques) sont dans [Opérations : RGPD](../operations/rgpd.md).

| Entité | Données personnelles | Conservation de référence |
|---|---|---|
| Restaurateur | Oui (email, nom, téléphone) | Vie du compte, puis purge à la clôture hors obligations légales |
| MagicLinkSession | Oui (jeton lié à un email) | Purge automatique après expiration |
| RestaurateurSession | Oui (rattachement au restaurateur, jeton haché) | Conservation jusqu'à expiration de la famille, puis purge automatique |
| Establishment | Données professionnelles publiques | Vie du compte |
| Space | Données publiques collectées | Jusqu'à revendication, puis suppression sur demande du propriétaire |
| Menu, Category, Product, OptionGroup, Option | Non | Vie du compte |
| TableQr | Non | Vie du compte |
| TableSession | Non (jeton opaque haché) | Purge automatique après expiration |
| Order, OrderLine | Minimales (prénom facultatif, note libre) | 10 ans (obligations comptables), prénom anonymisé avant ce terme |
| OrderEvent | Non | Alignée sur Order |
| Payment | Non (références Stripe uniquement) | 10 ans (obligations comptables) |
| CustomerContact | Oui (email, prénom) | Jusqu'au retrait du consentement ou 3 ans d'inactivité |
| Review | Indirectes (via CustomerContact) | Vie du compte de l'établissement, anonymisation sur demande |
| Tip | Non | Alignée sur Payment |
| MarketingConsent | Oui (preuve de consentement) | Conservée comme preuve, y compris après retrait |
| ExtractionJob | Non a priori (photos de carte) | Purge des payloads après validation, délai à trancher |

Les durées exactes d'anonymisation du prénom sur les commandes et de purge des payloads de génération restent à arbitrer avec la page RGPD : elles seront fixées ensemble pour rester cohérentes.
