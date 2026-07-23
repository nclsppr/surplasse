---
label: Modèle de données
order: 50
icon: database
description: Le modèle de données de référence de Surplasse, entités par domaine, machine à états de la commande, invariants et rétention RGPD.
---

# Modèle de données

Cette page décrit le modèle de données de référence de Surplasse. Le [backend](./backend.md) est le seul à accéder à la base : les frontends passent exclusivement par [le contrat OpenAPI](./api.md). Les domaines catalogue, commande, paiement et identité sont matérialisés par les migrations Flyway V1 à V14 ; les autres domaines restent la cible à implémenter.

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

Ce diagramme compact montre encore les relations livrées en phase 2. Le lot 4A remplace la relation d'autorisation directe `Restaurateur -> Establishment` par `TeamMember -> EstablishmentMembership -> Establishment`, ajoute les défis, sessions de poste partagé et baux de réception, puis rattache `AuditEvent` à l'acteur et à l'établissement. Les tables cibles sont détaillées ci-dessous avant la mise à jour du diagramme au moment de la migration.

## Entités par domaine

### Identité

**Restaurateur** : l'identité professionnelle livrée en phase 2. Elle représente le propriétaire unique qui gère un ou plusieurs établissements. Aucun mot de passe : l'authentification passe par magic link.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `email` | text | unique, non nul | Identifiant de connexion, cible du magic link |
| `full_name` | text | non nul | |
| `phone` | text | nullable | Facultatif, jamais exigé |
| `last_login_at` | timestamptz | nullable | |
| `created_at`, `updated_at` | timestamptz | non nuls | |

!!! info Migration d'identité en phase 4
L'[ADR-0031](../decisions/adr-0031-equipes-roles-vues-metier.md) remplace cette propriété unique comme source d'autorisation par `TeamMember` et `EstablishmentMembership`. La migration conserve chaque restaurateur existant comme membre et crée une appartenance `owner` pour chacun de ses établissements. Les six nouvelles tables ci-dessous décrivent la cible, pas une migration déjà livrée. Les tables `MagicLinkSession` et `RestaurateurSession` qui suivent décrivent encore la phase 2. Le lot 4A remplace leur clé d'acteur par `TeamMember`, renomme la seconde `TeamMemberSession` et révoque les anciennes familles de refresh sans modifier les garanties de rotation et de rejeu.
!!!

**TeamMember** : une personne nommée qui peut travailler dans un ou plusieurs établissements.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `email` | text | unique, non nul | Identifiant du magic link |
| `full_name` | text | non nul | |
| `status` | text | CHECK | `invited`, `active`, `suspended` |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**EstablishmentMembership** : l'appartenance d'un membre à un établissement et la source de ses droits.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK Establishment, non nul | Périmètre d'autorisation |
| `team_member_id` | uuid | FK TeamMember, non nul | |
| `role` | text | CHECK | `owner`, `manager`, `service`, `kitchen` |
| `invited_by` | uuid | FK TeamMember, nullable | Nul pour la migration initiale |
| `accepted_at` | timestamptz | nullable | Non nul après acceptation du magic link d'invitation |
| `revoked_at` | timestamptz | nullable | Coupe immédiatement les sessions pour cette appartenance |
| `created_at`, `updated_at` | timestamptz | non nuls | Unicité active sur établissement et membre |

**WorkstationPairingChallenge** : un défi temporaire créé par un membre autorisé puis consommé une seule fois par l'appareil à appairer.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK Establishment, non nul | |
| `view` | text | CHECK | `service` ou `kitchen` |
| `code_hash` | text | unique, non nul | Le code court n'est jamais stocké en clair |
| `created_by` | uuid | FK TeamMember, non nul | `owner` ou `manager` |
| `expires_at` | timestamptz | non nul | Expiration courte |
| `attempts` | integer | non nul, défaut 0 | Nombre borné avant invalidation |
| `consumed_at`, `revoked_at` | timestamptz | nullable | Usage unique ou annulation explicite |
| `created_at` | timestamptz | non nul | Purge après expiration |

**WorkstationSession** : une session de poste partagé appairée à un seul établissement et à une seule vue métier.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK Establishment, non nul | |
| `view` | text | CHECK | `service` ou `kitchen` |
| `token_hash` | text | unique, non nul | Le jeton du cookie n'est jamais stocké en clair |
| `paired_by` | uuid | FK TeamMember, non nul | `owner` ou `manager` |
| `expires_at`, `last_seen_at` | timestamptz | non nuls | Expiration et inventaire des appareils |
| `revoked_at` | timestamptz | nullable | Révocation à distance |
| `created_at` | timestamptz | non nul | |

Le Backend refuse l'échange d'un défi si le navigateur présente déjà une session nominative et refuse une session nominative tant que le cookie de poste est actif. L'interface doit déconnecter explicitement le contexte courant avant de changer de mode.

**ReceptionLease** : bail court d'une session explicitement armée pour recevoir et accepter les nouvelles commandes.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK Establishment, non nul | Périmètre du service ouvert |
| `team_member_session_family_id` | uuid | nullable, index | Famille logique stable d'une connexion `owner`, `manager` ou `service` |
| `workstation_session_id` | uuid | FK WorkstationSession, nullable | Uniquement un poste Salle |
| `armed_at`, `last_seen_at`, `expires_at` | timestamptz | non nuls | Le Backend fixe et renouvelle l'échéance |
| `disarmed_at` | timestamptz | nullable | Désarmement explicite, révocation ou perte de capacité |

Exactement une référence de session est renseignée. Une contrainte unique partielle interdit deux baux actifs pour la même famille nominative ou le même poste. Le bail référence le `family_id` stable, pas la ligne de refresh token qui change à chaque rotation. La rotation conserve donc le bail, tandis que la révocation de la famille le désarme dans la même transaction. Le Backend revalide sa capacité à chaque battement de cœur. Un poste Cuisine ne peut pas créer ce bail. Le bail vit en PostgreSQL pour que l'ouverture et l'auto-pause restent cohérentes après redémarrage ou avec plusieurs instances.

**AuditEvent** : trace append-only des actions sensibles effectuées par un membre, un poste partagé ou une orchestration système identifiée.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK Establishment, non nul | Périmètre obligatoire |
| `actor_type` | text | CHECK | `team_member`, `workstation_session` ou `system` |
| `team_member_id` | uuid | FK TeamMember, nullable | Renseigné pour une session nominative |
| `workstation_session_id` | uuid | FK WorkstationSession, nullable | Renseigné pour un poste partagé |
| `action`, `resource_type`, `resource_id` | text, text, uuid | non nuls | Vocabulaire fermé par le domaine appelant |
| `result` | text | CHECK | `succeeded`, `denied`, `failed` |
| `metadata` | jsonb | non nul | Métadonnées bornées, aucun secret ni donnée bancaire |
| `created_at` | timestamptz | non nul | Jamais modifié ni supprimé par le Dashboard |

Le type d'acteur impose exactement la référence attendue : membre ou poste, jamais les deux. Un événement `system` ne référence aucune session et porte dans `metadata` un identifiant de traitement durable et un motif fermé, sans usurper l'identité d'un restaurateur.

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

Après la migration de phase 4, la colonne `restaurateur_id` devient `team_member_id`. Les magic links inutilisés émis avant le déploiement sont invalidés.

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

Au déploiement du lot 4A, cette table devient `team_member_session`, sa FK devient `team_member_id` et toutes les familles existantes reçoivent `revoked_at`. Le JWT court expirant rapidement et la reconnexion par magic link terminent la bascule sans identité ambiguë.

### Catalogue

**Establishment** : le restaurant en tant qu'entité. Le `slug` détermine le sous-domaine du mini-site.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `restaurateur_id` | uuid | FK, nullable | Propriété livrée en phase 2 ; remplacée comme source d'autorisation par les appartenances en phase 4 |
| `name` | text | non nul | |
| `slug` | text | unique, non nul | Sous-domaine `{slug}.surplasse.com` |
| `address` | text | nullable | |
| `status` | text | CHECK | Voir le cycle de vie plus bas |
| `order_intake_status` | text | CHECK `open`, `paused`, non nul, défaut `paused` | État opérationnel des nouvelles sessions anonymes, commandes et sessions de paiement, distinct du cycle de vie |
| `order_intake_updated_at` | timestamptz | non nul | Date du dernier changement du statut configuré, y compris une auto-pause Stripe ; une mise à jour idempotente ou un changement des seuls prérequis effectifs la conserve |
| `stripe_account_id` | text | unique, nullable | Compte Connect utilisé pour les charges directes ; nul tant que le paiement n'est pas provisionné |
| `stripe_card_payments_active` | boolean | non nul, défaut `false` | Copie fermée de `configuration.merchant.capabilities.card_payments.status=active` ; `false` bloque une nouvelle session de paiement |
| `stripe_payouts_active` | boolean | non nul, défaut `false` | Copie fermée de `configuration.merchant.capabilities.stripe_balance.payouts.status=active` |
| `stripe_capabilities_updated_at` | timestamptz | nullable | Date Stripe du dernier snapshot appliqué ; une livraison plus ancienne est ignorée et une égalité fusionne de manière restrictive |
| `activated_at` | timestamptz | non nul si `active` | Départ des trois mois sans commission Surplasse |
| `created_at`, `updated_at` | timestamptz | non nuls | |

!!! warning Dimensions temporelles à préciser avant la phase 3
L'embarquement autonome exige un fuseau horaire IANA par établissement, des plages de service configurables sans chevauchement, des fermetures exceptionnelles et un libellé comme « Midi » ou « Soir ». Ces données ne sont pas encore représentées dans le modèle cible ci-dessus. Elles doivent être ajoutées au modèle et au contrat avant l'implémentation de la phase 3, puis servent aux analyses de phase 4 afin que chaque commande soit rattachée de manière déterministe à sa journée et à son service.
!!!

!!! info Présence de réception modélisée au lot 4A
Le `ReceptionLease` décrit plus haut porte une présence expirante uniquement pour les sessions capables d'accepter, avec plusieurs réceptionnaires, une expiration atomique, un délai de grâce borné et aucune réouverture automatique. Un simple booléen en mémoire ne satisfait pas cette garantie.
!!!

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
| `price_cents` | integer | >= 0, non nul | Prix TTC courant, copié dans la ligne à la commande |
| `tax_category` | text | nullable avant validation | Catégorie fiscale fournie ou validée par le restaurateur, obligatoire avant publication |
| `tax_rate_on_site_bps` | integer | entre 0 et 10 000, nullable avant validation | Taux configuré pour une vente sur place, obligatoire si ce canal est actif |
| `tax_rate_takeaway_bps` | integer | entre 0 et 10 000, nullable avant validation | Taux configuré pour une vente à emporter, obligatoire si ce canal est actif |
| `available` | boolean | non nul | Rupture temporaire sans retirer de la carte |
| `position` | integer | non nul | Ordre d'affichage dans la catégorie |
| `image_asset_id` | uuid | FK MediaAsset, nullable | Image affichée : photo téléversée ou visuel généré retenu, ou aucune |
| `deleted_at` | timestamptz | nullable | Soft delete |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**MediaAsset** : une image stockée (objet dans le stockage S3-compatible), qu'elle soit téléversée par le restaurateur ou générée par l'IA pendant l'embarquement ou depuis le Dashboard. Un produit référence au plus un `MediaAsset` comme image affichée ; les visuels générés non retenus restent privés au statut `proposed` tant que le restaurateur ne les a pas écartés.

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

!!! warning Contrat média à préciser avant la phase 3
L'[ADR-0025](../decisions/adr-0025-visuels-plats-a-la-demande.md) exige un rattachement explicite entre le produit ciblé, la photo source, le job et chaque candidat, ainsi qu'un remplacement atomique de l'image publiée. Les attributs et statuts ci-dessus décrivent la cible actuelle, mais devront être affinés avec le contrat OpenAPI avant l'implémentation. Aucun lien métier ne doit être enfoui uniquement dans un payload JSON.
!!!

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

**TakeawayConfiguration** : configuration du canal à emporter d'un établissement. Elle est distincte des tables et peut rendre commandable un établissement qui n'en possède aucune.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK, unique, non nul | Une configuration au plus par établissement |
| `enabled` | boolean | non nul, défaut `false` | Le canal reste fermé jusqu'à activation explicite |
| `minimum_lead_minutes` | integer | >= 0, non nul | Délai minimal avant retrait |
| `slot_duration_minutes` | integer | > 0, non nul | Pas de génération des créneaux |
| `booking_horizon_days` | integer | entre 1 et 30, non nul | Fenêtre proposée au client |
| `default_capacity` | integer | > 0, non nul | Capacité utilisée sauf surcharge du créneau |
| `created_at`, `updated_at` | timestamptz | non nuls | |

**PickupSlot** : créneau concret proposé à la commande à emporter, calculé dans le fuseau de l'établissement et verrouillable à l'admission.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK, non nul | Cloisonnement obligatoire |
| `starts_at`, `ends_at` | timestamptz | non nuls | `ends_at` strictement postérieur à `starts_at` |
| `capacity`, `reserved_count` | integer | >= 0, non nuls | `reserved_count` ne dépasse jamais `capacity` |
| `status` | text | CHECK | `open` ou `closed` |
| `created_at`, `updated_at` | timestamptz | non nuls | Unicité sur établissement et début |

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

**TakeawaySession** : la capacité anonyme obtenue depuis le lien direct lorsqu'un client choisit l'à emporter. Elle est limitée à un établissement et ne crée aucun contexte de table.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK, non nul | Établissement du mini-site demandé |
| `token_hash` | text | unique, non nul | Hachage du jeton opaque remis au client |
| `expires_at` | timestamptz | non nul | Glissante et bornée à la fenêtre de commande |
| `created_at`, `updated_at` | timestamptz | non nuls | |

Les jetons de `TableSession` et de `TakeawaySession` appartiennent au même périmètre d'authentification anonyme mais ne sont jamais interchangeables. Le type de commande doit correspondre au type de session et au même établissement.

!!! info Proposition assistée, pas panier serveur
La commande assistée de phase 4 persiste une proposition avec son auteur, sa table, une sélection de produits et une expiration. Son ouverture hydrate un nouveau panier purement côté client. Elle ne réserve rien, ne fait jamais foi sur les prix et ne devient pas une commande. La validation du panier suit ensuite le flux ordinaire, avec recalcul Backend et création d'une nouvelle `Order` en `pending_payment`. Son schéma exact rejoint cette page avec le contrat du lot concerné.
!!!

**Order** : l'acte d'achat d'un client, sur place ou à emporter. Le panier n'est pas une commande : c'est un état purement côté client (application Commande), qui ne touche jamais la base. À la validation du panier, le Backend crée la commande directement au statut `pending_payment` (en attente de paiement).

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK, non nul | |
| `table_qr_id` | uuid | FK, nullable | Nul pour une commande à emporter |
| `table_session_id` | uuid | FK, nullable | Non nul sur place ; session anonyme exacte qui a créé la commande |
| `takeaway_session_id` | uuid | FK, nullable | Non nul à emporter ; session anonyme exacte qui a créé la commande |
| `pickup_slot_id` | uuid | FK PickupSlot, nullable | Non nul à emporter ; créneau réservé dans le même établissement |
| `type` | text | CHECK | `on_site` (sur place) ou `takeaway` (à emporter) |
| `status` | text | CHECK | Voir la machine à états |
| `display_number` | text | non nul | Numéro court, unique par établissement et par jour |
| `customer_first_name` | text | nullable | Donnée personnelle minimale, pour l'appel au comptoir ; anonymisée après 24 h (voir [RGPD](../operations/rgpd.md)) |
| `contact_email` | text | nullable | Fourni au besoin pour le reçu ou la confirmation d'une commande à emporter ; effacé après 30 jours (voir [RGPD](../operations/rgpd.md)) |
| `contact_mobile` | text | nullable, requis pour l'à emporter | Utilisé uniquement pour le SMS « Prête », normalisé puis effacé au plus tard 24 h après la clôture |
| `total_cents` | integer | >= 0, non nul | Somme des lignes, figée au paiement |
| `service_day` | date | non nul | Jour de service ; porte l'unicité de `display_number` |
| `tracking_token` | text | unique, non nul | Capacité de suivi non devinable, portée par l'URL de la page de suivi |
| `idempotency_key` | uuid | unique, non nul | Clé d'idempotence de la création (en-tête `Idempotency-Key`) |
| `request_hash` | text | non nul | Empreinte du payload d'origine ; détecte la réutilisation de la clé avec un autre contenu |
| `payment_deadline_at` | timestamptz | non nul | Expiration de la réservation de capacité tant que la commande reste `pending_payment` |
| `created_at`, `updated_at` | timestamptz | non nuls | |

Une commande `on_site` référence exactement `table_qr_id` et `table_session_id`, jamais une session ou un créneau à emporter. Une commande `takeaway` référence exactement `takeaway_session_id` et `pickup_slot_id`, jamais une table. Sa création verrouille le `PickupSlot`, vérifie l'heure, l'état et la capacité, incrémente `reserved_count` et crée un job `order_payment_deadline` dans la même transaction. Après `payment_deadline_at`, aucune nouvelle création ni reprise de paiement n'est remise au navigateur.

À l'échéance, le job verrouille le créneau, la commande puis son paiement éventuel. Si aucun Payment Intent n'a jamais existé, ou seulement après un état fournisseur `canceled` confirmé, il passe la commande encore `pending_payment` à `cancelled` et décrémente la réservation une seule fois. Tout paiement existant qui n'est pas `canceled`, y compris un état local `failed` retentable, conserve la capacité : le worker demande son annulation Stripe avec une clé stable hors transaction, puis attend une réponse ou un webhook non ambigu. Un succès concurrent fait passer la commande à `paid` et conserve la place ; une réponse réseau ambiguë conserve également la réservation et relance le rapprochement. La capacité n'est jamais revendue sur la seule foi de l'horloge locale. Un remboursement après paiement ne la rouvre pas silencieusement.

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
| `tax_category` | text | non nul | Catégorie fiscale figée depuis le produit validé |
| `tax_rate_bps` | integer | entre 0 et 10 000, non nul | Taux applicable au canal de la commande, figé |
| `taxable_base_cents` | integer | >= 0, non nul | Base hors taxe totale de la ligne, après arrondi déterministe |
| `tax_amount_cents` | integer | >= 0, non nul | Taxe totale de la ligne ; base plus taxe égale le total TTC |
| `note` | text | nullable | Note libre du client, transmise telle quelle en cuisine |
| `line_total_cents` | integer | >= 0, non nul | (prix unitaire + surcoûts) x quantité |
| `position` | integer | non nul | Ordre d'affichage des lignes, celui du panier |

`options_json` est un instantané dénormalisé volontaire : chaque option choisie y est copiée avec son libellé et son surcoût au moment T (exemple : `[{"group": "Cuisson", "option": "Saignant", "extra_cost_cents": 0}]`). La carte évolue en permanence (prix modifiés, options renommées ou supprimées), alors qu'une commande payée est une archive comptable. Sans cet instantané, renommer une option réécrirait silencieusement l'historique, et supprimer un groupe casserait des jointures. Le prix, le nom, la catégorie fiscale, le taux, la base et la taxe sont figés dans la ligne pour la même raison. Les options d'une ligne héritent de son taux dans le socle.

Le calcul part du total TTC de la ligne en centimes. Pour un taux en points de base, `taxable_base_cents = round_half_up(line_total_cents * 10000 / (10000 + tax_rate_bps))`, puis `tax_amount_cents = line_total_cents - taxable_base_cents`. L'implémentation utilise une arithmétique décimale et `RoundingMode.HALF_UP`, jamais un flottant binaire. La note, l'export et le registre relisent ces montants figés au lieu de les recalculer. L'ADR du remboursement partiel doit fixer l'allocation des centimes entre quantités avant toute implémentation.

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
| `status` | text | CHECK | `creating` (réservation avant Stripe), `pending` (en attente), `succeeded` (réussi), `failed` (ancien échec retentable), `canceled` (annulation fournisseur confirmée), `refunded` (remboursé) |
| `creation_key` | uuid | nullable, non nul si `creating` | Clé stable transmise à Stripe par toute requête concurrente qui termine la réservation |
| `connected_account_id` | text | non nul | Compte Connect figé avant Stripe ; V11 refuse tout ancien paiement plateforme impossible à rattacher sûrement |
| `application_fee_amount` | integer | >= 0 et < montant | Commission Surplasse figée en centimes ; 0 pendant la période gratuite |
| `amount_cents` | integer | > 0, non nul | Total TTC de la commande, hors pourboire de phase 5 |
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
| `table_session_id` | uuid | FK, nullable | Session exacte pour une commande sur place |
| `takeaway_session_id` | uuid | FK, nullable | Session exacte pour une commande à emporter |
| `created_at` | timestamptz | non nul | |

Exactement une référence de session est renseignée, du même type et du même établissement que la commande. Une autre session anonyme ne peut jamais reprendre son `client_secret`.

**PaymentRefund** (`payment_refund`) : une tentative auditable de remboursement intégral. Elle est réservée avant l'appel Stripe et conserve toutes les données nécessaires à une reprise sûre.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | Identifiant interne porté dans les métadonnées Stripe |
| `payment_id` | uuid | FK, non nul | Paiement intégralement remboursé |
| `order_id`, `establishment_id` | uuid | FK, non nuls | Autorisation et rapprochement métier |
| `provider` | text | CHECK | `stripe` au MVP |
| `external_reference` | text | non nul | Référence interne pendant `creating`, puis identifiant du remboursement Stripe ; unique avec le compte connecté |
| `creation_key` | uuid | non nul | Clé stable transmise à Stripe pour cette tentative |
| `payment_intent_id` | text | non nul | Payment Intent figé avant l'appel réseau |
| `connected_account_id` | text | non nul | Compte de la charge directe, repris dans `Stripe-Account` |
| `amount_cents` | integer | > 0, non nul | Montant total du paiement, sans remboursement partiel au MVP |
| `application_fee_amount` | integer | >= 0 et < montant | Commission à restituer avec `refund_application_fee` lorsqu'elle est positive |
| `currency` | text | non nul | Devise du paiement |
| `reason` | text | CHECK | `restaurant_refusal`, `item_unavailable`, `service_incident` ou `acceptance_timeout` |
| `status` | text | CHECK | `creating`, `pending`, `requires_action`, `succeeded`, `failed` ou `canceled` |
| `failure_reason` | text | nullable | Cause Stripe utile à l'exploitation, sans donnée de carte |
| `created_at`, `updated_at` | timestamptz | non nuls | |

Un index unique partiel interdit deux remboursements actifs ou réussis sur le même paiement. Un remboursement `failed` ou `canceled` libère une nouvelle tentative, tandis que `creating`, `pending`, `requires_action` et `succeeded` restent exclusifs.

**RefundRequest** (`refund_request`) : une intention de remboursement professionnelle ou système identifiée par une clé d'idempotence. Plusieurs clés peuvent pointer vers le même remboursement actif ou réussi sans déclencher un nouvel appel Stripe.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `idempotency_key` | uuid | PK | Clé reçue du Dashboard ou dérivée de façon déterministe par le système |
| `refund_id` | uuid | FK, non nul | Tentative rendue pour cette intention |
| `order_id`, `establishment_id` | uuid | FK, non nuls | Détectent une réutilisation hors périmètre |
| `reason` | text | CHECK | Motif associé à la requête rejouable |
| `initiator_type` | text | CHECK | `team_member` ou `system` |
| `team_member_id` | uuid | FK TeamMember, nullable | Obligatoire pour une demande professionnelle |
| `scheduled_job_id` | uuid | FK ScheduledJob, nullable | Obligatoire pour une expiration automatique |
| `created_at` | timestamptz | non nul | |

Le type d'initiateur impose exactement l'une des deux références. Pour une expiration d'acceptation, la clé dérive de l'identifiant de commande et du motif `acceptance_timeout` ; le même job, une reprise ou un webhook rejoué retrouve donc la même intention.

**ScheduledJob** (`scheduled_job`) : un traitement durable court, réclamé par le worker interne. Le lot 4A l'ajoute pour que l'expiration d'une acceptation survive à un redémarrage ou à plusieurs instances.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `type` | text | CHECK | Dont `order_payment_deadline`, `order_acceptance_deadline`, `transactional_notification` et `qr_generation` |
| `deduplication_key` | text | unique, non nul | Une seule échéance durable par commande et par type |
| `resource_id` | uuid | non nul | Identifiant métier ciblé, commande pour l'échéance d'acceptation |
| `run_at` | timestamptz | non nul, index | Première date d'exécution autorisée |
| `status` | text | CHECK | `pending`, `running`, `succeeded`, `failed` ou `canceled` |
| `attempts`, `max_attempts` | integer | >= 0, non nuls | Reprises bornées, avec alerte avant épuisement pour une commande payée |
| `payload` | jsonb | non nul | Données minimales et versionnées, sans secret Stripe |
| `locked_at` | timestamptz | nullable | Bail court du worker, récupérable après expiration |
| `last_error` | text | nullable | Diagnostic borné, sans donnée bancaire |
| `created_at`, `updated_at` | timestamptz | non nuls | |

Dans la transaction qui fait passer une commande à `paid`, le Backend crée ou retrouve le job `order_acceptance_deadline`. Une acceptation ou un remboursement déjà engagé l'annule. À échéance, le worker verrouille l'établissement puis la commande, revalide qu'elle est toujours `paid`, force `order_intake_status=paused` même si un `ReceptionLease` reste valide, crée ou retrouve la `RefundRequest` système, puis lance l'orchestration de remboursement existante. Cet ordre commence par la frontière d'admission et évite de l'inverser avec une création de commande concurrente. Une reprise concurrente devient un no-op. Seul un `owner` ou `manager` peut rouvrir après diagnostic. Le succès produit un `AuditEvent` d'acteur `system` ; un échec épuisé conserve la pause et déclenche une alerte P0 exploitable.

**NotificationDelivery** (`notification_delivery`) : état durable d'une notification transactionnelle dont la remise doit rester visible, notamment le SMS « Prête » à emporter.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `establishment_id` | uuid | FK, nullable | Obligatoire pour une notification rattachée à un établissement actif ; absent uniquement avant la revendication d'un espace |
| `resource_type` | text | CHECK, non nul | `order`, `space`, `payment`, `payout` ou `dispute` |
| `resource_id` | text | non nul | Identifiant interne ou référence canonique stable de la ressource |
| `order_id` | uuid | FK, nullable | Obligatoire pour `takeaway_ready`, absent pour les notifications sans commande |
| `source_order_event_id` | bigint | FK OrderEvent, nullable | Obligatoire et unique pour `takeaway_ready` ; identifie précisément le passage à `ready` |
| `channel` | text | CHECK | `sms` ou `email` |
| `purpose` | text | CHECK | Dont `takeaway_ready` |
| `deduplication_key` | text | unique, non nul | Exemple : `takeaway-ready:{orderId}:{sourceOrderEventId}` |
| `provider` | text | non nul | Fournisseur configuré, sans secret |
| `provider_reference` | text | nullable | Référence utile au reçu de remise |
| `status` | text | CHECK | `pending`, `sending`, `sent`, `delivered`, `failed` ou `canceled` |
| `attempts` | integer | >= 0, non nul | Reprises bornées |
| `last_error` | text | nullable | Motif exploitable, sans numéro mobile |
| `sent_at`, `delivered_at` | timestamptz | nullable | Preuve de transmission et de remise lorsque le fournisseur la fournit |
| `created_at`, `updated_at` | timestamptz | non nuls | |

Les contraintes propres au motif imposent les références nécessaires : `takeaway_ready` exige un `establishment_id`, un `order_id`, un `source_order_event_id` et `resource_type=order`. Les notifications de revendication, de litige ou de virement utilisent leur propre type et leur propre ressource, sans inventer de commande. Le passage d'une commande à emporter vers `ready` crée l'`OrderEvent`, la remise et son job dans la même transaction. Le job ne devient exécutable que cinq secondes plus tard. Sa clé inclut l'événement source : un nouveau passage légitime à `ready` après rappel crée donc une nouvelle remise au lieu d'être absorbé par la déduplication du premier passage.

Pendant ces cinq secondes, le rappel `ready` vers `preparing` verrouille la commande, la remise et le job, puis les passe respectivement à `preparing`, `canceled` et `canceled` dans la même transaction. Il n'est accepté que si la remise et le job sont encore tous deux `pending`. À l'échéance, le worker verrouille ces mêmes lignes et fait passer atomiquement le job de `pending` à `running` et la remise de `pending` à `sending` avant l'appel fournisseur. Ces verrous sérialisent le rappel et le worker : un seul peut franchir la frontière d'envoi. Dès que l'un des deux états a avancé, ou après tout état ultérieur y compris `failed`, le rappel répond 409 : l'envoi peut déjà avoir été remis malgré une réponse fournisseur ambiguë et seul le traitement d'incident permet alors d'informer correctement le client. Le worker lit le mobile encore conservé sur `Order`, appelle l'adaptateur du fournisseur avec la clé stable, puis rapproche son reçu ou son webhook de statut. Le numéro n'est pas recopié dans cette table. Un échec final reste visible dans Salle et Gestion avec une action de reprise ; la page de suivi client reste la source disponible sans SMS. Une notification ne peut donc pas disparaître silencieusement.

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

**Tip** : cible de phase 5 pour un pourboire laissé après le service par un paiement Stripe distinct, reversé au restaurant. Il ne réutilise pas le `Payment` unique de la commande. Un ADR de phase 5 doit encore fixer son traitement fiscal, sa commission et son remboursement.

| Attribut | Type | Contraintes | Commentaire |
|---|---|---|---|
| `id` | uuid | PK | |
| `order_id` | uuid | FK, non nul | Commande servie ou retirée qui ouvre le parcours |
| `external_reference` | text | non nul | Payment Intent Stripe propre au pourboire |
| `connected_account_id` | text | non nul | Compte Connect destinataire figé |
| `creation_key` | uuid | unique, non nul | Clé stable de création et de reprise Stripe |
| `amount_cents` | integer | > 0, non nul | |
| `status` | text | CHECK | `creating`, `pending`, `succeeded`, `failed` ou `refunded` |
| `created_at`, `updated_at` | timestamptz | non nuls | |

Un index unique partiel interdit plusieurs pourboires `creating`, `pending`, `succeeded` ou `refunded` pour la même commande. Une tentative `failed` libère un nouvel essai avec une autre clé ; le rejeu d'une même clé retrouve toujours la même tentative. L'ADR de phase 5 doit décider si plusieurs pourboires réussis deviennent un jour légitimes, sans affaiblir implicitement cette règle.

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

**ExtractionJob** : un travail asynchrone confié à l'API OpenAI, qu'il s'agisse d'extraction (carte depuis photo, enrichissement depuis données publiques) ou de génération de visuels de plats à partir des photos fournies. Le résultat est une proposition que le restaurateur valide dans l'Onboarding ou le Dashboard, jamais une écriture directe dans le Catalogue : une extraction produit une carte structurée à relire, une génération produit des `MediaAsset` au statut `proposed` à retenir ou écarter.

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

La durée de conservation des payloads, des photos sources et des candidats écartés après validation de la carte ou choix d'un visuel reste à trancher (purge candidate : 30 jours).

## Machine à états de la commande

Le panier vit côté client : la commande naît en base au statut `pending_payment`, à la validation du panier. Il n'existe pas d'état « brouillon » persisté.

```
(panier côté client)
    |
    | validation du panier : création de la commande
    v
pending_payment ------------------------------> cancelled
    |                               (expiration, abandon)
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
    +---> preparing   (rappel immédiat avant service ou retrait)
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
| `paid` | `refunded` | Expiration du délai d'acceptation, remboursement intégral | Système (`ScheduledJob`) |
| `accepted` | `preparing` | Passage en cuisine | Restaurateur (Dashboard) |
| `accepted`, `preparing`, `ready` | `refunded` | Incident (rupture, erreur), remboursement | Restaurateur (Dashboard) |
| `preparing` | `ready` | Fin de préparation | Restaurateur (Dashboard) |
| `ready` | `preparing` | Rappel immédiat du dernier ticket que la même session a clôturé par erreur, avant service ou retrait ; à emporter, uniquement pendant les cinq secondes où le SMS reste `pending` | Cuisine ou responsable (Dashboard) |
| `ready` | `served` | Commande apportée à table (sur place) | Restaurateur (Dashboard) |
| `ready` | `picked_up` | Commande remise au comptoir (à emporter) | Restaurateur (Dashboard) |

Toute transition hors de ce tableau est rejetée par le service. Le retour `ready` vers `preparing` ne concerne que le dernier ticket passé à « Prête » par la même session nominative ou de poste, reste impossible après `served` ou `picked_up` et produit un événement audité visible de la salle et du client. Pour une commande à emporter, la transaction annule aussi la remise et son job encore `pending` ; après le début possible de l'envoi, elle est refusée afin de ne pas contredire un SMS potentiellement reçu. `cancelled` et `refunded` sont des états terminaux, comme `served` et `picked_up`. L'[ADR-0022](../decisions/adr-0022-remboursement-integral-stripe.md) exclut le remboursement partiel du MVP et impose une nouvelle décision avant de l'introduire.

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
| `configuring` | Le restaurateur complète sa carte, ses canaux de commande et son compte Stripe | Premier accès au Dashboard après revendication |
| `active` | Le mini-site est public et l'établissement peut être ouvert opérationnellement | Activation par le restaurateur, prérequis vérifiés |
| `suspended` | L'établissement est suspendu au niveau de la plateforme, hors pause ordinaire d'un service | Décision administrative du restaurateur ou de Surplasse |

Un établissement créé directement par l'embarquement (sans pré-génération) entre dans le cycle au statut `configuring` : son espace est créé déjà revendiqué. `suspended` est réversible vers `active`. Il ne sert jamais à ouvrir ou fermer un service courant. La suppression définitive d'un établissement est un processus RGPD à part, décrit dans [Opérations : RGPD](../operations/rgpd.md).

## État opérationnel de prise de commandes

`Establishment.order_intake_status` répond à une question distincte du cycle de vie : l'établissement accepte-t-il de nouvelles opérations de commande maintenant ? Ses deux valeurs sont `open` et `paused`. Le défaut `paused` impose une ouverture explicite et garantit qu'une production nouvellement provisionnée ne reçoit aucune commande par accident.

La disponibilité exposée par le contrat est calculée. `acceptingOrders` vaut `true` uniquement si l'état opérationnel vaut `open`, si le cycle de vie vaut `active`, si une carte est publiée, si au moins un canal est actif, table avec QR ou à emporter configuré, si le compte Stripe Connect peut créer des charges et si un `ReceptionLease` valide appartient à une session capable d'accepter. Sinon, `blockedReason` précise la cause effective : `paused`, `establishment_not_active`, `configuration_unavailable` pour une carte ou tout canal absent, `payments_unavailable` ou `reception_unavailable`.

```
order_intake_status = paused  ---------------------------> open
                              ouverture explicite et
                              prérequis tous vérifiés

open ------------------------> paused
     pause explicite ou card_payments non active
```

La pause ferme les nouvelles sessions anonymes, sur place comme à emporter, les commandes et les sessions de paiement. Elle ne masque pas la carte et ne change aucune commande existante. Les pages de suivi, les flux SSE, les opérations du Dashboard et les webhooks Stripe restent disponibles. Une récupération de `card_payments` ne rouvre jamais automatiquement la prise de commandes. La décision et sa frontière transactionnelle sont fixées dans l'[ADR-0020](../decisions/adr-0020-accounts-v2-onboarding-embarque.md).

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
| V14 | `payment` | tentatives et intentions idempotentes de remboursement intégral |

V5 vit dans `backend/identity/src/main/resources/db/migration/V5__identity_schema.sql`. Le seed local associe le compte de démonstration à l'établissement pilote ; il n'est jamais chargé en production. V6 vit dans `backend/order/src/main/resources/db/migration/V6__operational_order_index.sql`. Son index partiel couvre `(establishment_id, created_at DESC, id DESC)` uniquement pour `paid`, `accepted`, `preparing` et `ready`, soit la file active lue par le Dashboard. V7 vit dans `backend/payment/src/main/resources/db/migration/V7__payment_idempotency.sql` et rattache chaque clé de requête à la session de paiement effectivement rendue. V8 vit dans `backend/order/src/main/resources/db/migration/V8__order_table_session_scope.sql`, reconstitue la session uniquement quand une seule session encore active au moment de la commande correspond, refuse une reprise absente ou ambiguë et conserve ensuite la session exacte. V9 vit dans `backend/payment/src/main/resources/db/migration/V9__reconcile_payment_order.sql`. Elle introduit l'état court `creating`, impose avec `payment_order_unique_idx` un seul paiement pour toute la vie d'une commande et répare une éventuelle commande restée `pending_payment` alors que son paiement était déjà `succeeded`. Si une base héritée contient un paiement `failed` ou plusieurs paiements pour une commande, la migration s'arrête afin d'imposer leur rapprochement Stripe et l'annulation des Payment Intents surnuméraires avant déploiement. V10 ajoute le routage Connect. Pour un établissement déjà actif sans date fiable, elle démarre une nouvelle période gratuite au moment de la migration, jamais à sa date de création. V11 refuse toute base contenant encore un ancien paiement plateforme : aucun compte Connect ne peut être inféré sans preuve Stripe, et le contrat exige ce compte sur chaque session. V12 ajoute `order_intake_status` et `order_intake_updated_at` avec un défaut fermé ; le seed de démonstration ouvre explicitement son établissement. V13 renomme les copies de capacités sans changer leurs valeurs, afin que le schéma exprime la source Accounts v2. V14 ajoute les tentatives de remboursement et leur table d'idempotence. Elle conserve le Payment Intent et le compte connecté sur chaque tentative, puis garantit par index qu'un paiement ne possède jamais deux remboursements actifs ou réussis.

V8 à V14 sont des migrations de fondation livrées avant la toute première production. Aucun SHA de production antérieur ne leur est compatible et aucun retour binaire vers un SHA pré-V14 n'est autorisé. Le premier SHA déclaré sain en production inclut nécessairement V14. À partir de cette base, toute évolution incompatible suit une séquence expansion, déploiement du code compatible, puis contraction dans une migration ultérieure.

Flyway applique V1 à V14 au démarrage de l'assemblage Backend. Les tables et colonnes ajoutées appartiennent à l'unique base PostgreSQL. Elles sont donc incluses dans chaque `pg_dump`, dans la copie chiffrée hors VPS et dans l'exercice trimestriel de restauration. Elles n'ajoutent ni volume ni sauvegarde séparés. Les index ne contiennent aucune donnée supplémentaire à sauvegarder : PostgreSQL les restaure avec le schéma. Une restauration doit vérifier que Flyway voit V14 comme appliquée, que les index `order_operational_page_idx`, `payment_request_payment_idx`, `order_table_session_idx`, `payment_order_unique_idx`, `establishment_stripe_account_unique_idx`, `payment_stripe_reference_account_unique_idx` et `payment_refund_active_payment_unique_idx` existent, que `order_intake_status` vaut `paused` ou `open` et que les liens entre `restaurateur`, `establishment`, `table_session`, `order`, `payment`, `payment_request`, `payment_refund` et `refund_request` sont cohérents.

## Invariants métier

| Invariant | Garantie |
|---|---|
| Une commande payée ne change plus de contenu (lignes, quantités, montants) | Service, plus trigger de protection en base à l'étude |
| Le prix d'une ligne est figé à la commande, jamais recalculé depuis le Catalogue | Copie dans `OrderLine` à la création |
| `total_cents` d'une commande égale la somme des `line_total_cents` | Service, vérifié avant création du Payment Intent |
| Pour chaque ligne, `taxable_base_cents + tax_amount_cents = line_total_cents` | Service et contrainte CHECK |
| Toute commande `paid` possède une unique échéance d'acceptation durable tant qu'elle n'est ni acceptée ni en remboursement | Clé de déduplication en base et création dans la transaction du webhook |
| Une table appartient à un seul établissement | FK non nulle sur `TableQr.establishment_id` |
| Une commande sur place référence une table de son propre établissement | Service (la FK seule ne suffit pas) |
| Une commande référence exactement le contexte anonyme de son type : table sur place, session et créneau à emporter sinon | Contraintes CHECK plus validation d'établissement dans le service |
| `PickupSlot.reserved_count` ne dépasse jamais sa capacité | Verrou de ligne et contraintes CHECK dans la transaction de création ou d'expiration |
| Une reprise de paiement appartient à la session anonyme exacte qui a créé la commande | Références exclusives dans `PaymentRequest` et filtrage avant restitution du secret |
| Seule la session anonyme exacte qui a créé une commande peut en ouvrir ou reprendre le paiement | Référence exclusive `TableSession` ou `TakeawaySession` sur Order et PaymentRequest, puis filtrage du service |
| Une commande ne possède qu'un seul paiement sur toute sa durée de vie, même avec plusieurs requêtes simultanées | verrou sur `Order`, état `Payment.creating`, index unique `payment_order_unique_idx` et `Payment.creation_key` stable |
| Une nouvelle session de paiement utilise le compte Connect encaissable de l'établissement, sans repli plateforme | `Establishment.stripe_account_id`, `stripe_card_payments_active`, relecture Accounts v2, snapshot `Payment.connected_account_id` et échec métier fermé |
| Après le commit d'une pause, aucune nouvelle session anonyme, commande ou session de paiement n'est admise | `Establishment.order_intake_status`, verrou partagé à l'admission et verrou exclusif à la pause |
| Une pause ne coupe ni le suivi, ni le Dashboard, ni le traitement d'un paiement déjà engagé | Le contrôle d'admission reste absent des lectures existantes, des transitions opérationnelles, des flux SSE et des webhooks |
| Un webhook Connect ne peut modifier que le paiement du même compte | rapprochement par `(Payment.connected_account_id, Payment.external_reference)` et contrôle de `livemode` |
| Un produit référencé par une ligne de commande n'est jamais supprimé physiquement | Soft delete, FK en `ON DELETE RESTRICT` |
| Un établissement revendiqué conserve au moins un administrateur | Phase 2 : un `Establishment.restaurateur_id` non nul ; phase 4 : au moins une `EstablishmentMembership` active de rôle `owner` |
| Une appartenance active est unique pour un membre et un établissement | Index unique partiel sur `EstablishmentMembership`, révocation explicite |
| Un défi d'appairage ne produit qu'une session | Code haché, expiration, compteur de tentatives et `consumed_at` atomique dans `WorkstationPairingChallenge` |
| Un poste partagé ne vise qu'un établissement et une vue Salle ou Cuisine | Contraintes de `WorkstationSession` et capacités fixes côté Backend |
| Un événement du journal d'activité n'est jamais modifié depuis le Dashboard | Repository append-only et absence d'opération de mise à jour ou suppression dans le contrat |
| Un `slug` d'établissement est unique et immuable après activation | Contrainte unique, immuabilité en service |
| Un avis référence une commande terminée (servie ou retirée) | Service |
| Aucune ligne `CustomerContact` sans opt-in explicite tracé dans `MarketingConsent` | Service, création atomique des deux lignes |

Les garanties « service » sont portées par la logique métier du [backend](./backend.md), les garanties « base » par les migrations Flyway. Quand les deux sont possibles, la base sert de filet de sécurité et le service de règle première.

## Rétention et RGPD

Le tableau ci-dessous résume la politique par entité. Les procédures détaillées (registre des traitements, exercice des droits, purges automatiques) sont dans [Opérations : RGPD](../operations/rgpd.md).

| Entité | Données personnelles | Conservation de référence |
|---|---|---|
| Restaurateur | Oui (email, nom, téléphone) | Vie du compte, puis purge à la clôture hors obligations légales |
| TeamMember | Oui (email, nom) | Vie des appartenances, puis purge hors événements légalement conservés |
| EstablishmentMembership | Oui (rattachement professionnel) | Vie de l'établissement et durée du journal d'activité |
| WorkstationPairingChallenge | Indirectes (auteur de l'appairage) | Purge automatique peu après expiration ou consommation |
| WorkstationSession | Indirectes (appareil et auteur de l'appairage) | Purge après révocation ou expiration, délai opérationnel à fixer |
| ReceptionLease | Indirectes (session professionnelle active) | Purge courte après expiration ou désarmement ; l'auto-pause reste dans AuditEvent |
| AuditEvent | Indirectes (auteur d'une action professionnelle) | Durée alignée sur la ressource auditée et les obligations applicables |
| ScheduledJob | Non, hors référence technique vers une ressource | Purge après succès ou annulation selon le délai opérationnel ; un échec P0 reste conservé avec l'incident |
| NotificationDelivery | Non, références techniques sans destinataire recopié | Alignée sur la commande et les besoins de preuve de remise ; erreurs purgées de toute donnée fournie par le destinataire |
| MagicLinkSession | Oui (jeton lié à un email) | Purge automatique après expiration |
| RestaurateurSession, puis TeamMemberSession | Oui (rattachement professionnel, jeton haché) | Conservation jusqu'à expiration de la famille, puis purge automatique |
| Establishment | Données professionnelles publiques | Vie du compte |
| Space | Données publiques collectées | Jusqu'à revendication, puis suppression sur demande du propriétaire |
| Menu, Category, Product, OptionGroup, Option | Non | Vie du compte |
| TableQr | Non | Vie du compte |
| TableSession | Non (jeton opaque haché) | Purge automatique après expiration |
| TakeawaySession | Non (jeton opaque haché) | Purge automatique après expiration |
| TakeawayConfiguration, PickupSlot | Non | Vie de la configuration ; créneaux conservés avec les commandes puis purgés selon l'archive métier |
| Order, OrderLine | Minimales (prénom facultatif, mobile temporaire, note libre) | 10 ans pour l'archive métier ; prénom et mobile anonymisés selon leur délai court |
| OrderEvent | Non | Alignée sur Order |
| Payment | Non (références Stripe uniquement) | 10 ans (obligations comptables) |
| CustomerContact | Oui (email, prénom) | Jusqu'au retrait du consentement ou 3 ans d'inactivité |
| Review | Indirectes (via CustomerContact) | Vie du compte de l'établissement, anonymisation sur demande |
| Tip | Non | Alignée sur Payment |
| MarketingConsent | Oui (preuve de consentement) | Conservée comme preuve, y compris après retrait |
| ExtractionJob | Non a priori (photos de carte ou de plats) | Purge des payloads après validation ou choix du visuel, délai à trancher |

Les durées exactes d'anonymisation du prénom sur les commandes et de purge des payloads de génération restent à arbitrer avec la page RGPD : elles seront fixées ensemble pour rester cohérentes.
