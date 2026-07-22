---
label: Intégrations
order: 60
icon: link
description: "Les services externes du système Surplasse : Stripe, extraction IA via l'API OpenAI, données publiques, emails transactionnels, impression thermique, stockage objet et QR codes."
---

# Les intégrations

Le Backend est le seul point de contact avec les services externes : aucun frontend ne parle directement à Stripe (hors confirmation du Payment Element), à l'API OpenAI ou au fournisseur d'emails. Cette page décrit chaque intégration : son rôle, son mode d'intégration, ses risques et l'état de la décision. La gestion des secrets (clés API, signatures de webhooks) et la vérification des webhooks sont détaillées dans [la sécurité](securite.md).

!!! info Documentation de référence
Le paiement Stripe en mode test est implémenté dans le Backend et Commande : montant recalculé, Payment Element, idempotence, routage explicite vers un compte Connect, commission figée, webhook signé et passage transactionnel de la commande à `paid`. Le remboursement intégral est lui aussi livré localement avec restitution de la commission Surplasse, idempotence persistante et rapprochement des événements Stripe. Le contrôle opérationnel ferme les nouvelles sessions de table, commandes et sessions de paiement. La plateforme test et le compte connecté Accounts v2 existent. Le compte reste toutefois restreint tant que son embarquement n'est pas terminé, donc la charge et le remboursement réels ainsi que le live restent non qualifiés. Les autres intégrations décrites ici restent elles aussi des cibles tant que leur module n'existe pas. Les points non tranchés sont signalés et donnent lieu à des ADR dans [decisions](../decisions/).
!!!

## Stripe : les paiements

### Rôle

Stripe porte l'intégralité de la chaîne de paiement : encaissement des clients par CB, Apple Pay et Google Pay, reversement des fonds à chaque établissement, conformité PCI DSS et gestion de l'authentification forte (SCA, 3-D Secure). Surplasse ne voit, ne stocke et ne transporte jamais un numéro de carte.

### Stripe Connect : encaisser au nom de chaque établissement

Surplasse n'encaisse pas pour son propre compte : chaque paiement est une charge directe créée sur le compte Stripe Connect de l'établissement. La charge apparaît dans le solde et le Dashboard Stripe du compte connecté. Ce schéma est cohérent avec le positionnement du produit : le restaurant garde ses clients et sa relation commerciale. L'[ADR-0020](../decisions/adr-0020-accounts-v2-onboarding-embarque.md) remplace les anciens types Standard et Express par une configuration Accounts v2 explicite :

| Propriété | Valeur de référence | Effet |
|---|---|---|
| Configuration | `merchant` | L'établissement agit comme marchand pour les charges directes |
| Dashboard | `full` | Le restaurateur dispose d'un accès Stripe complet en voie de secours |
| Frais Stripe | `fees_collector=stripe` | Stripe prélève ses frais directement sur le compte connecté |
| Pertes | `losses_collector=stripe` | Stripe porte la responsabilité configurée pour les soldes négatifs |
| Encaissement | `card_payments` demandé et `status=active` | Aucun Payment Intent n'est créé tant que la capacité n'est pas active |
| Virements | `stripe_balance.payouts.status` suivi | La qualification vérifie séparément que les fonds peuvent être versés |

Le parcours produit utilise les composants Connect intégrés `account_onboarding`, `notification_banner` et `account_management`. Le restaurateur reste dans l'Onboarding Surplasse, tandis que Stripe reçoit directement l'identité, les justificatifs, l'IBAN et l'acceptation de ses conditions. Le pilote utilise lui aussi le composant intégré. Le formulaire hébergé reste seulement une voie de secours opérateur. Un formulaire réglementaire entièrement construit avec l'API est exclu : il transférerait à Surplasse la maintenance continue des exigences KYC.

### Payment Element côté Commande

Le frontend Commande intègre le **Payment Element** de Stripe : un composant unique qui affiche CB, Apple Pay et Google Pay selon l'appareil du client, dans la langue et le thème du mini-site. Le client paie sans quitter la page. Le Payment Element gère lui-même le SCA et le 3-D Secure : quand la banque exige une authentification, le défi s'affiche dans le composant, sans code spécifique côté Surplasse.

### Flux de paiement d'une commande

```
 Client (Commande)              Backend                    Stripe
       │                           │                          │
       │ 1. valide le panier       │                          │
       ├──────────────────────────►│                          │
       │                           │ 2. crée la commande      │
       │                           │    « en attente          │
       │                           │    de paiement »         │
       │                           │ 3. crée le PaymentIntent │
       │                           │    (compte Connect de    │
       │                           │    l'établissement)      │
       │                           ├─────────────────────────►│
       │ 4. client_secret          │                          │
       │◄──────────────────────────┤                          │
       │ 5. confirme le paiement (Payment Element,            │
       │    SCA / 3-D Secure si exigé)                        │
       ├─────────────────────────────────────────────────────►│
       │                           │ 6. webhook signé         │
       │                           │  payment_intent.succeeded│
       │                           │◄─────────────────────────┤
       │                           │ 7. Commande « payée »,   │
       │                           │    diffusion SSE         │
       │ 8. page de suivi (SSE)    │                          │
       │◄──────────────────────────┤                          │
```

Le PaymentIntent est toujours créé côté Backend, avec le montant recalculé depuis la carte en base : le montant envoyé par le navigateur n'est jamais utilisé tel quel. Le Backend fournit l'identifiant du compte connecté dans la session de paiement. Commande initialise Stripe.js avec cet identifiant, exactement identique au contexte `Stripe-Account` employé lors de la création.

!!! warning Le webhook est la source de vérité
Le retour navigateur après confirmation (redirection ou callback JavaScript) est purement informatif : il peut ne jamais arriver, arriver deux fois ou être forgé. Seul le webhook `payment_intent.succeeded`, signé par Stripe et vérifié par le Backend, fait passer la commande au statut « payée » et déclenche sa transmission en cuisine. La vérification de signature et l'idempotence du traitement sont décrites dans [la sécurité](securite.md).
!!!

### Commissions et frais

Trois couches de frais sont à modéliser avant l'ouverture commerciale :

| Couche | Nature | Qui la porte |
|---|---|---|
| Frais Stripe de transaction | Pourcentage plus montant fixe par paiement, variable selon le type de carte | Établissement, sous réserve de la configuration et des conditions Stripe validées avant le live |
| Frais Stripe Connect | Frais éventuels liés à la configuration de plateforme et aux virements | À confirmer dans la tarification et les conditions Stripe applicables avant le live |
| Commission Surplasse | La rémunération de la plateforme, prélevée via `application_fee_amount` sur chaque PaymentIntent | **Actée le 2026-07-19 : 0 % pendant les 3 premiers mois de chaque établissement, puis 1 % par commande** |

Le modèle de prix est acté : commission par commande, sans abonnement, avec une commission Surplasse de 0 % pendant les 3 premiers mois suivant l'activation de chaque établissement, puis 1 %. Pendant les trois mois gratuits, le Backend omet `application_fee_amount`. À l'instant exact `activated_at.plusMonths(3)`, il applique 1 % avec un arrondi au centime inférieur. Les frais Stripe restent distincts et s'appliquent dès le premier paiement. Leur montant exact sera vérifié selon le moyen de paiement, la configuration Connect et le panier moyen réel avant l'ouverture commerciale.

Ces conditions doivent apparaître clairement sur la future homepage et dans la documentation publique destinée aux restaurateurs. La communication sépare toujours la commission Surplasse des frais Stripe : la transparence tarifaire fait partie du positionnement face aux plateformes à commission opaque. Le détail de la décision figure dans l'[ADR-0015](../decisions/adr-0015-modele-commission.md) et sa mise en visibilité dans la [roadmap](../roadmap.md).

### Mode test

Tout le développement se fait en **mode test Stripe** : clés de test, cartes de test, webhooks rejoués via la CLI Stripe. Aucune clé de production n'existe avant la phase pilote. Les environnements et la ségrégation des clés sont décrits dans [la sécurité](securite.md).

La clé `Idempotency-Key` reçue du navigateur est persistée avant d'être considérée comme livrée. Une transaction courte verrouille la commande, crée une réservation `creating` et fixe la clé Stripe stable. Cette réservation fige aussi le compte Connect et la commission. L'appel réseau se déroule ensuite sans transaction ouverte, puis une seconde transaction active la session. Deux requêtes simultanées terminent donc la même réservation avec la même clé Stripe au lieu de créer deux débits. Le SDK peut rejouer au maximum deux erreurs réseau avec cette clé. Un échec de moyen de paiement ne clôt pas le Payment Intent : le Payment Element peut recueillir un autre moyen de paiement et un événement ultérieur `payment_intent.succeeded` reste recevable. Chaque lecture d'une session existante est filtrée par la session de table exacte avant de rendre son `client_secret`.

Un webhook Connect ne recherche jamais un paiement par son seul identifiant Stripe. Le Backend exige le compte connecté porté au niveau racine de l'événement et rapproche le couple `(connected_account_id, external_reference)`. Un événement signé du mauvais mode est acquitté sans effet afin d'éviter les relivraisons inutiles. Un compte absent ou différent ne modifie aucun paiement.

Le remboursement intégral reprend le Payment Intent et le compte connecté figés sur le paiement. Le Backend réserve d'abord l'intention, puis appelle Stripe hors transaction avec une clé stable et le contexte `Stripe-Account`. Le montant n'est pas précisé, ce qui rembourse toute la charge. Lorsque `application_fee_amount` était positif, `refund_application_fee=true` restitue aussi la commission Surplasse au compte connecté. Le Dashboard ne fait jamais passer directement la commande à `refunded` : seul un statut Stripe `succeeded`, reçu dans la réponse ou rapproché par `refund.created`, `refund.updated` ou `refund.failed`, produit cet effet. L'[ADR-0022](../decisions/adr-0022-remboursement-integral-stripe.md) fixe les garanties et exclut le remboursement partiel du MVP.

Les changements de compte arrivent sous forme d'événements fins Accounts v2, notamment `v2.core.account[configuration.merchant].capability_status_updated`. Le payload identifie le compte mais n'est pas un snapshot complet. Après vérification de signature, le Backend relit donc le compte via Accounts v2 hors transaction, puis ouvre une transaction courte qui déduplique l'événement et applique les états `card_payments` et `stripe_balance.payouts`. Une seconde lecture Accounts v2 intervient juste avant chaque création de Payment Intent. Toute indisponibilité ou capacité différente de `active` échoue de manière fermée.

Les événements snapshot de paiement et de remboursement, puis les événements fins de compte, utilisent deux destinations Stripe, deux endpoints Backend et deux secrets de signature distincts. `/v1/webhooks/stripe` reçoit les événements de Payment Intent et de remboursement Connect. `/v1/webhooks/stripe/accounts` ne reçoit que les événements fins Accounts v2. Un payload signé envoyé à la mauvaise destination est rejeté avant toute lecture réseau ou écriture en base.

### Pause opérationnelle et frontière Stripe

La [prise de commandes](../decisions/adr-0020-accounts-v2-onboarding-embarque.md) est fermée par un état applicatif, pas en modifiant le compte Stripe. Une pause bloque les nouvelles sessions de table, les nouvelles commandes et les créations ou reprises de sessions de paiement. Le mini-site reste lisible et tous les webhooks continuent à être traités.

La pause ne peut pas reprendre un secret déjà livré au navigateur. Un Payment Intent dont le `client_secret` a été retourné avant la frontière transactionnelle peut encore être confirmé auprès de Stripe. Son événement `payment_intent.succeeded` reste la source de vérité, même si la prise de commandes est désormais `paused`. Cette commande doit apparaître dans le Dashboard, poursuivre son suivi et être servie ou remboursée. Une garantie plus forte demanderait d'annuler puis rapprocher les Payment Intents ouverts, ce qui n'est pas livré dans ce lot.

Un événement Accounts v2 qui révèle `card_payments.status` différent de `active` ferme aussi le parcours de manière persistante. Un retour à `active` met à jour la capacité Stripe mais ne rouvre jamais la prise de commandes. Le restaurateur doit demander explicitement `open`, ce qui revalide le compte encaissable avec les autres prérequis. Cette règle évite qu'une récupération externe rouvre un service sans décision humaine.

### Statut de la décision

Stripe, Accounts v2, les charges directes, les composants d'embarquement et la frontière de pause sont actés dans l'[ADR-0020](../decisions/adr-0020-accounts-v2-onboarding-embarque.md). La commission Surplasse est actée dans l'[ADR-0015](../decisions/adr-0015-modele-commission.md), et le remboursement intégral dans l'[ADR-0022](../decisions/adr-0022-remboursement-integral-stripe.md). Le chemin applicatif, le remboursement et la mise en pause sont livrés localement. Le compte test existe mais reste restreint jusqu'à la fin de son embarquement. Restent à vérifier contre Stripe réel la charge, le remboursement, le montant exact des frais applicables et leur répartition contractuelle.

## Extraction IA de la carte

### Rôle

C'est l'intégration qui rend la promesse du produit possible : transformer une photo de carte en carte numérique structurée, sans saisie manuelle. Elle est portée par le domaine Génération du Backend et s'appuie sur l'API OpenAI en mode vision.

### Pipeline

```
 Photos téléversées (Onboarding)
        │
        ▼
 Stockage objet ──── référence ────┐
                                   ▼
                     Job asynchrone (domaine Génération)
                                   │
                                   │  appel API OpenAI (vision),
                                   │  sortie structurée JSON
                                   ▼
                     Validation du schéma (catégories,
                     produits, options, prix)
                        │                │
                        │ échec          │ succès
                        ▼                ▼
                  reprise ou      Écran de relecture
                  signalement     du restaurateur
                                         │
                                         │ corrections, validation
                                         ▼
                                   Carte publiée
```

Le mode d'intégration est asynchrone de bout en bout : le téléversement crée un job, le frontend Onboarding suit son avancement sans bloquer le parcours, et le résultat n'est jamais publié directement. La sortie de l'API OpenAI est demandée en JSON structuré et validée contre le schéma de la carte (celui du contrat) avant d'être proposée à la relecture.

**La relecture humaine est obligatoire : l'IA propose, le restaurateur dispose.** Aucun prix, aucun libellé extrait n'est publié sans passage par l'écran de relecture. C'est une garantie de qualité (un prix mal lu est une erreur commerciale, pas un bug) et le principe qui rend l'imperfection de l'extraction acceptable : une extraction à 90 % juste avec une relecture rapide vaut mieux qu'une saisie manuelle complète.

### Images de plats : harmonisation et génération

Deux traitements distincts s'appliquent aux photos de plats, à ne pas confondre.

L'**harmonisation** est un traitement d'image serveur classique (recadrage, normalisation de l'exposition, génération de miniatures) appliqué aux photos existantes, pour une cohérence visuelle entre les photos d'une même carte. Le modèle vision peut, en amont, repérer les photos inexploitables (floues, mal cadrées) et suggérer un recadrage.

La **génération de visuels de plats** est une capacité assumée de l'API OpenAI (génération d'images) : pendant l'embarquement ou depuis la fiche d'un produit dans le Dashboard, Surplasse produit des visuels candidats à partir d'une photo du plat réellement servi. Elle est cadrée par l'[ADR-0025 : visuels de plats à la demande](../decisions/adr-0025-visuels-plats-a-la-demande.md) :

- **Sources maîtrisées uniquement** : la génération part des photos fournies par le restaurateur, jamais de photos de tiers (touristes, plateformes), pour des raisons de droits.
- **Choix produit par produit** : chaque produit peut porter une photo téléversée, un visuel proposé par Surplasse, ou aucune image. Le restaurateur décide ; rien de généré n'est publié sans son choix explicite.
- **Fidélité** : un visuel illustre un plat réellement servi (il part d'une photo de ce plat), il ne l'invente pas ; il est présenté comme une suggestion de présentation, jamais comme la photo littérale de l'assiette servie.

Les visuels générés sont stockés comme des `MediaAsset` privés (`source = generated`, `status = proposed`) que le restaurateur compare, sélectionne ou écarte (voir [le modèle de données](donnees.md)). L'image publique actuelle reste inchangée pendant le job et en cas d'échec ; son remplacement est atomique au moment du choix explicite.

### Coûts et limites

| Aspect | Situation | Parade |
|---|---|---|
| Coût par extraction | Quelques appels vision par embarquement, coût unitaire faible mais à suivre | Métrique de coût par job, plafond par établissement |
| Coût des visuels récurrents | Chaque mise à jour de carte peut déclencher une nouvelle génération | Quota par établissement et par période, coût suivi par job, blocage lisible avant dépassement |
| Photos floues ou mal cadrées | L'extraction se dégrade fortement | Contrôle qualité de l'image avant de lancer le job, demande de reprise de la photo |
| Cartes manuscrites | Fiabilité variable selon l'écriture | Signalées comme « à relire attentivement », relecture renforcée |
| Cartes multilingues ou en langue étrangère | Extraction possible mais structure parfois ambiguë | La langue de la carte est confirmée à la relecture |
| Hallucination de prix ou de produits | Risque intrinsèque au modèle | Validation de schéma, puis relecture humaine obligatoire |

### Statut de la décision

L'API OpenAI comme moteur d'extraction et de génération de visuels est actée ([ADR-0010](../decisions/adr-0010-fournisseur-ia.md) et [ADR-0025](../decisions/adr-0025-visuels-plats-a-la-demande.md)), derrière une interface qui la garde interchangeable. Le choix du modèle exact, les seuils de qualité d'image, le plafond de coût de l'embarquement et le quota de génération récurrent restent à affiner pendant la construction des phases 3 et 4.

## Enrichissement depuis les données publiques

### Rôle

Les **espaces** pré-générés (voir la [terminologie](../glossaire.md)) sont construits à partir de données publiques sur les établissements : nom, adresse, horaires, type de cuisine. L'objectif est qu'un restaurateur qui arrive sur Surplasse trouve son établissement déjà esquissé et n'ait qu'à le revendiquer.

### Sources envisageables

| Source | Contenu | Point d'attention |
|---|---|---|
| Annuaire d'entreprises public (base SIRENE) | Existence légale, SIRET, adresse | Données ouvertes, réutilisation encadrée mais permise |
| Données cartographiques ouvertes (OpenStreetMap) | Localisation, catégorie, horaires parfois | Licence ODbL : attribution et conditions de réutilisation à respecter |
| Site web propre de l'établissement | Carte, photos, horaires | Conditions d'utilisation propres à chaque site, prudence maximale |
| Plateformes tierces (avis, réservation) | Données riches | Conditions d'utilisation généralement interdisant l'extraction : exclues |

### Prudence juridique

!!! warning Un espace n'est pas un droit acquis sur les données d'autrui
Les conditions d'utilisation de chaque source font loi : les plateformes qui interdisent l'extraction sont exclues, quelle que soit la richesse de leurs données. Côté RGPD, les données de professionnels (nom du gérant, email de contact) restent des données personnelles : base légale, information des personnes et droit d'opposition s'appliquent. Le cadre complet est dans [RGPD](../operations/rgpd.md).
!!!

### Fraîcheur et vérification

Les données publiques vieillissent : un établissement ferme, change de carte, de propriétaire. Chaque espace porte la date et la source de ses données, et un espace non revendiqué au-delà d'un délai à définir est rafraîchi ou retiré. La **revendication** est le moment de vérité : le restaurateur qui revendique un espace prouve son lien avec l'établissement (le mécanisme exact, email sur le domaine de l'établissement, code envoyé par courrier ou appel, reste à trancher), puis relit et corrige toutes les données pré-générées avant activation. Rien de pré-généré n'est publié comme mini-site actif sans revendication.

### Statut de la décision

Le principe des espaces pré-générés est acté (voir la variante de revendication du [parcours d'embarquement](../produit/parcours/onboarding-restaurateur.md)). Les sources exactes, le mécanisme de preuve à la revendication et le délai de rétention des espaces non revendiqués restent à trancher (ADR à venir).

## Emails transactionnels

### Rôle

L'email porte trois usages, tous transactionnels (aucun emailing marketing dans le MVP) :

| Usage | Destinataire | Criticité |
|---|---|---|
| Magic links d'authentification | Restaurateur | Bloquant : sans email reçu, pas de connexion |
| Confirmation de commande à emporter | Client (email fourni à la commande) | Confort, avec la page de suivi en secours |
| Notifications (revendication, litige, échec de virement) | Restaurateur | Important, non bloquant |

### Mode d'intégration

Le Backend envoie via **quarkus-mailer**, l'extension d'envoi SMTP de Quarkus : le fournisseur est une configuration (hôte, port, chiffrement et identifiants), pas un couplage de code. Changer de fournisseur ne demande aucune modification applicative. Les gabarits d'emails vivent dans le Backend, en français, sobres et sans pistage d'ouverture.

Au MVP, le magic link est envoyé de façon asynchrone après la persistance du jeton, sans file durable ni retentative automatique. Une réponse 202 signifie que la demande a été acceptée, pas que le fournisseur a remis l'email. En cas de perte entre ces deux étapes, le restaurateur peut demander un nouveau lien. Cette nouvelle demande invalide le lien précédent.

### Fournisseur à trancher

| Option | Pour | Contre |
|---|---|---|
| Scaleway Transactional Email | Hébergeur français, données en UE, simple | Service jeune, outillage de délivrabilité plus limité |
| Brevo | Acteur européen, bonne délivrabilité, offre d'entrée gratuite | Interface orientée marketing, au-delà du besoin |
| Postmark | Excellente délivrabilité transactionnelle, outillage soigné | Acteur américain, à évaluer au regard du RGPD |

Le critère dominant est la délivrabilité des magic links (un magic link en spam est une panne d'authentification), suivi de la localisation des données. Si le VPS est pris chez OVH ou Infomaniak, leur offre d'email transactionnel entre dans la comparaison (facturation et support unifiés) sans être retenue d'office : la délivrabilité prime. Le domaine `surplasse.com` doit publier SPF, signer les messages avec DKIM et appliquer une politique DMARC avant le pilote. Le fournisseur retenu doit exposer les rejets, rebonds, plaintes, délais de remise et incidents de service, avec une alerte exploitable. Sans cette supervision, une panne SMTP devient une panne d'authentification silencieuse.

En développement, aucun email réel ne part : **Mailpit** capture tout (voir le [setup](../developpement/index.md)). L'image `axllent/mailpit:v1.30.4` est épinglée, ses ports 1025 et 8025 ne sont liés qu'à `127.0.0.1`, et aucun volume n'est monté. Mailpit est absent de la CI et de la production. Les tests utilisent le mailer simulé de Quarkus ; la production utilisera le fournisseur SMTP transactionnel encore à sélectionner.

### Statut de la décision

Le mode d'intégration (SMTP via quarkus-mailer) est acté. Le fournisseur reste à trancher (ADR à venir), avec un test de délivrabilité comparatif avant la phase pilote.

## Impression thermique

### Rôle

Certains établissements veulent un ticket cuisine papier à chaque commande, en complément du Dashboard. L'impression est optionnelle : le Dashboard reste le canal de référence, l'imprimante un confort d'atelier.

### Les deux options

```
 Option A : imprimante cloud            Option B : application compagnon
 (type Epson TM-i)
                                        ┌───────────┐   Bluetooth   ┌────────────┐
 ┌────────────┐  interrogation  ┌────┐  │ Tablette  │──────────────►│ Imprimante │
 │ Imprimante │────────────────►│ API│  │ (app      │    ESC/POS    │ thermique  │
 │  (réseau)  │◄────────────────│    │  │ compagnon)│               └────────────┘
 └────────────┘  tickets à      └────┘  └─────┬─────┘
                 imprimer                     │ SSE / REST
                                              ▼
                                          Backend
```

| Critère | Imprimante cloud (Epson TM-i) | Application compagnon + Bluetooth ESC/POS |
|---|---|---|
| Matériel | Imprimante spécifique, plus chère | Toute imprimante ESC/POS Bluetooth, souvent déjà en place |
| Logiciel à développer | Un endpoint d'interrogation côté Backend | Une application tablette complète à construire et maintenir |
| Dépendance à un appareil sur place | Aucune : l'imprimante interroge seule | La tablette doit rester allumée, chargée, connectée |
| Panne réseau de l'établissement | Ticket retardé, rejoué à la reconnexion | Idem, avec la tablette comme point de fragilité en plus |
| Effort pour un développeur seul | Faible | Élevé (application mobile, appairage Bluetooth, parc d'imprimantes hétérogène) |

### Statut de la décision

**La décision est explicitement reportée : l'impression thermique est hors MVP.** Le Dashboard suffit pour la phase pilote. Un ADR tranchera entre les deux options (ou une combinaison) quand le besoin sera confirmé par les établissements pilotes. Rien dans l'architecture ne préempte le choix : les deux options consomment la même diffusion de Commandes que le Dashboard.

## Stockage objet des images

### Rôle

Trois familles d'images à héberger : les photos de cartes téléversées à l'embarquement (entrée du pipeline d'extraction), les photos et visuels de plats ajoutés pendant l'embarquement ou depuis le Dashboard (affichés sur les mini-sites après choix explicite) et les photos du lieu (vitrine du mini-site).

### Mode d'intégration

La cible de départ est **MinIO**, un stockage objet S3-compatible auto-hébergé, déployé comme conteneur sur le VPS aux côtés du reste du système (voir [la vue d'ensemble](index.md)). Le Backend parle l'API S3 : si le volume ou la durabilité l'exigent un jour, la migration vers un service managé S3-compatible (Scaleway Object Storage, OVHcloud, Amazon S3) est un changement d'endpoint et d'identifiants, pas de code.

À l'import, le Backend génère les **miniatures et variantes** de chaque image (vignette de produit, format carte, format vitrine, versions WebP) : les mini-sites ne servent jamais l'original en pleine résolution. Les originaux des photos de cartes sont conservés le temps de l'extraction et de la relecture, puis purgés selon la politique de rétention décrite dans [RGPD](../operations/rgpd.md).

### Risques et parades

| Risque | Parade |
|---|---|
| Perte de données sur le VPS | Sauvegarde externalisée du bucket, testée en restauration |
| Saturation du disque | Quotas par établissement, variantes plutôt qu'originaux, purge des images orphelines |
| Exposition d'images privées (photos de cartes en cours de relecture) | Buckets privés, accès via URL signées à durée courte, jamais de bucket public |

### Statut de la décision

L'orientation MinIO sur le VPS au départ, avec l'API S3 comme frontière, est la cible de référence. Elle sera confirmée par un ADR au moment de la mise en place de l'infrastructure.

## Génération des QR codes

### Rôle

Le QR code est la porte d'entrée physique du produit : un QR par table, collé ou posé sur la table, qui ouvre le mini-site de l'établissement avec le contexte de la table.

### Mode d'intégration

La génération est entièrement côté Backend (domaine Génération), via une bibliothèque Java standard : pas de service externe, pas de QR dynamique tiers. Chaque QR encode une URL du type `https://{slug}.surplasse.com/?table={identifiant}` : le mini-site Commande lit le contexte de table et le rattache à la commande. L'identifiant de table est un jeton stable et non devinable plutôt qu'un numéro séquentiel, pour qu'un QR photographié ne permette pas d'énumérer les tables.

Le Dashboard permet de générer et régénérer les QR d'un établissement (ajout d'une table, sticker abîmé). Formats d'export prévus pour l'impression :

| Format | Usage |
|---|---|
| SVG | Vectoriel, pour l'imprimeur (stickers, sous-verres, chevalets) |
| PDF | Planche prête à imprimer : tous les QR de l'établissement, libellés par table |
| PNG haute résolution | Dépannage et intégration dans des supports existants |

### Risques et parades

Le risque principal est la substitution physique : un autocollant frauduleux collé par dessus le QR légitime (le « quishing »). Les parades sont graphiques et humaines plutôt que techniques : un gabarit visuel propre à l'établissement, le domaine `{slug}.surplasse.com` lisible en clair sous le QR, et la recommandation au restaurateur de vérifier ses supports régulièrement.

### Statut de la décision

Pas de décision structurante : implémentation backend standard, prévue avec le domaine Génération. Le choix de la bibliothèque Java relève du détail d'implémentation.

## Récapitulatif des décisions

| Intégration | Décision structurante | Statut |
|---|---|---|
| Stripe | Accounts v2, charges directes, composants Connect intégrés, Payment Element et webhooks sources de vérité | Acté : [ADR-0020](../decisions/adr-0020-accounts-v2-onboarding-embarque.md) |
| Fournisseur IA | API OpenAI derrière interface (vision et génération d'images) | Acté : [ADR-0010](../decisions/adr-0010-fournisseur-ia.md) |
| Extraction de carte | API OpenAI en vision, relecture humaine obligatoire | Acté dans la stack ; modèle et seuils à affiner |
| Visuels de plats générés | Sources maîtrisées, choix produit par produit, fidélité, disponibilité dans le Dashboard | Acté : [ADR-0025](../decisions/adr-0025-visuels-plats-a-la-demande.md) |
| Données publiques | Sources, preuve de revendication, rétention | À trancher (ADR à venir) |
| Emails | SMTP via quarkus-mailer | Mode acté ; fournisseur à trancher (ADR à venir) |
| Impression thermique | Imprimante cloud ou application compagnon | Reportée, hors MVP (ADR à venir) |
| Stockage objet | MinIO S3-compatible sur le VPS, migration managée possible | Orientation de référence, ADR de confirmation à venir |
| QR codes | Génération backend, jetons de table non devinables | Pas d'ADR nécessaire |
