---
label: Sécurité
order: 70
icon: shield
description: Posture de sécurité de Surplasse, modèle de menaces, authentification, autorisations, webhooks, secrets et durcissement.
---

# Sécurité

Cette page décrit la posture de sécurité cible de Surplasse : ce que la plateforme protège, contre quoi, et par quels mécanismes. Elle complète la [vue d'ensemble de l'architecture](index.md), la page [intégrations](integrations.md) pour les échanges avec Stripe et l'API Claude, et la page [RGPD](../operations/rgpd.md) pour le volet données personnelles.

## Posture générale

La sécurité de Surplasse repose d'abord sur la réduction de la surface d'attaque, avant l'empilement de contre-mesures.

Trois choix structurants minimisent le risque à la source :

| Choix | Conséquence sécurité |
|---|---|
| Aucune donnée de carte bancaire ne transite par nos systèmes | Le paiement est délégué à Stripe (Elements et Payment Intents côté client). Le périmètre PCI DSS de Surplasse se limite au questionnaire SAQ A, le plus léger. |
| Le client final n'a pas de compte | Pas de mot de passe client à stocker, pas de base d'identifiants à protéger de ce côté, pas de credential stuffing possible sur le parcours Commande. |
| Auth restaurateur sans mot de passe (magic link) | Aucun mot de passe restaurateur en base. La compromission de la base ne livre aucun secret d'authentification réutilisable. |

Le reste de la posture découle de ce socle : sessions courtes, autorisations filtrées par établissement, validation stricte des entrées, chiffrement en transit partout.

!!! info Pas de code applicatif à ce jour
Cette page est une spécification de référence. Les mécanismes décrits ici sont la cible que le backend et les frontends doivent implémenter ; rien n'est en production aujourd'hui.
!!!

## Modèle de menaces

Modèle volontairement léger, centré sur les scénarios réalistes pour une plateforme de commande de restauration. Il sera revu à chaque évolution significative du périmètre.

| Acteur | Menace | Actif visé | Parade |
|---|---|---|---|
| Client malveillant | Commandes frauduleuses (commande sans intention de payer, prix manipulé côté client) | Chiffre d'affaires de l'établissement | Le paiement précède la confirmation de la commande ; les prix sont recalculés côté backend depuis la carte, jamais repris du panier client |
| Client curieux ou farceur | Scan du QR d'une autre table (commande attribuée à la mauvaise table, nuisance) | Fiabilité du service en salle | Le jeton de session est lié à l'établissement et à la table scannée ; une commande ne peut viser que la table du QR effectivement scanné, et le restaurateur peut réassigner une table depuis le Dashboard |
| Restaurateur légitime | Accès aux données d'un autre établissement (commandes, chiffre d'affaires, clients) | Confidentialité inter-établissements | Filtrage systématique par appartenance à l'établissement sur chaque requête (voir [Autorisations](#autorisations)) |
| Attaquant externe | Rejeu ou forge de webhook Stripe (commande marquée payée sans paiement) | Intégrité des paiements | Vérification de signature, tolérance d'horloge, traitement idempotent (voir [Webhooks Stripe](#webhooks-stripe)) |
| Attaquant externe | Vol de session restaurateur (interception ou vol de jeton) | Compte restaurateur, données de l'établissement | JWT de session à durée courte, refresh token révocable, HTTPS strict, cookies durcis |
| Concurrent ou agrégateur | Scraping massif de la carte et des prix | Données de la carte, positionnement de l'établissement | La carte est publique par nature (elle l'est aussi en vitrine) ; la parade se limite à la limitation de débit et à l'absence d'API d'énumération globale des établissements |
| Attaquant externe | Injection via les photos téléversées (fichier malveillant déguisé en image, XSS via SVG, charge utile dans les métadonnées) | Backend, navigateurs des clients | Validation stricte de type et de taille, réécriture systématique des images, aucun fichier téléversé servi tel quel (voir [Téléversements](#televersements)) |

Sont explicitement hors modèle à ce stade : les attaques étatiques, la compromission physique du VPS, et les menaces internes (l'équipe est réduite et l'accès production restreint).

## Authentification restaurateur : magic link

Le restaurateur s'authentifie sans mot de passe, par un lien à usage unique envoyé par email. Le choix et ses compromis sont consignés dans l'[ADR-0008 : authentification par magic link](../decisions/adr-0008-magic-link.md).

### Flux

```
Restaurateur                    Backend                       Boîte email
     |                             |                               |
     |  1. POST /auth/magic-link   |                               |
     |     { email }               |                               |
     |---------------------------->|                               |
     |                             |  2. Génère un jeton aléatoire |
     |                             |     à usage unique, haché et  |
     |                             |     horodaté en base          |
     |                             |     (validité 15 minutes)     |
     |                             |                               |
     |                             |  3. Email avec le lien        |
     |                             |------------------------------>|
     |                             |                               |
     |  4. Clic sur le lien        |                               |
     |<----------------------------------------------------------- |
     |                             |                               |
     |  5. GET page intermédiaire  |                               |
     |     (ne consomme rien)      |                               |
     |---------------------------->|                               |
     |  6. POST /auth/verify       |                               |
     |     (déclenché par la page) |                               |
     |---------------------------->|  7. Vérifie le jeton :        |
     |                             |     non expiré, non utilisé,  |
     |                             |     puis l'invalide           |
     |                             |                               |
     |  8. Cookies de session      |                               |
     |     (JWT court + refresh,   |                               |
     |      HttpOnly, Secure)      |                               |
     |<----------------------------|                               |
```

### Durées de vie et invalidation

| Élément | Durée de vie | Invalidation |
|---|---|---|
| Jeton de magic link | 15 minutes | Consommé au premier échange ; toute nouvelle demande pour le même email invalide les jetons précédents non consommés |
| JWT de session | 15 minutes | Expiration naturelle ; non révocable individuellement (durée courte assumée) |
| Refresh token | 30 jours, rotation à chaque usage | Révocable en base (déconnexion, suspicion de compromission) ; la réutilisation d'un refresh token déjà tourné révoque toute la famille de jetons |

Points d'implémentation imposés :

- Le jeton de magic link est stocké haché en base (jamais en clair) : une fuite de base ne permet pas de forger un lien valide.
- La réponse à la demande de magic link est identique que l'email existe ou non en base, pour ne pas permettre l'énumération des comptes.
- La demande de magic link est limitée en débit : par email cible et par IP (voir [Limitation de débit](#limitation-de-debit)).
- L'échange du jeton (étape 5) passe par une page intermédiaire qui déclenche un POST, pour éviter la consommation du jeton par les outils de prévisualisation de liens des clients email.

## Session client anonyme

Le client final n'a jamais de compte. Au scan du QR code, le parcours Commande obtient un jeton de session opaque (identifiant aléatoire, sans contenu déchiffrable côté client), lié à l'établissement et à la table encodés dans le QR.

| Propriété | Valeur cible |
|---|---|
| Format | Jeton opaque (référence de session côté serveur), pas un JWT |
| Portée | Un établissement, une table, une visite |
| Durée de vie | Courte, de l'ordre de la durée d'un repas (2 heures, glissantes tant que la session est active) ; valeur exacte à trancher |
| Autorise | Consulter la carte, constituer un panier, créer sa commande, payer, suivre l'état de sa commande |
| N'autorise pas | Tout le reste : aucune lecture des autres commandes, aucune donnée de l'établissement au-delà de la carte publique, aucun endpoint restaurateur |

La session anonyme ne porte aucune donnée personnelle. Si le client fournit un prénom ou un email (reçu, appel au comptoir), ces données sont rattachées à la commande, pas à la session, et relèvent de la politique décrite dans la page [RGPD](../operations/rgpd.md).

## Autorisations {#autorisations}

Le modèle d'autorisation est volontairement simple : un restaurateur accède aux données des établissements auxquels il appartient, et à rien d'autre. Il n'y a pas de rôles fins au MVP (un seul niveau : membre de l'établissement) ; des rôles différenciés (gérant, équipe en salle) restent à trancher.

Chaque requête authentifiée côté restaurateur est filtrée par l'appartenance à l'établissement :

1. Le JWT identifie le restaurateur.
2. Le backend résout la liste de ses établissements.
3. Toute requête portant sur des données d'établissement (commandes, carte, métriques, réglages) inclut obligatoirement la clause de filtrage par établissement.

!!! warning Règle de code non négociable
Jamais de requête sur une table liée à un établissement sans clause de filtrage par établissement. Cette règle est vérifiée en revue de code et couverte par des tests d'autorisation systématiques : pour chaque endpoint restaurateur, un test vérifie qu'un restaurateur A reçoit une 404 (et non une 403, pour ne pas confirmer l'existence de la ressource) quand il vise une ressource de l'établissement B.
!!!

Le détail du modèle de données et des clés d'appartenance est décrit dans la page [données](donnees.md).

## Webhooks Stripe {#webhooks-stripe}

Les webhooks Stripe pilotent le cycle de vie du paiement (voir [intégrations](integrations.md)). Trois protections s'appliquent à chaque événement reçu :

| Protection | Mécanisme |
|---|---|
| Authenticité | Vérification de la signature `Stripe-Signature` avec le secret de webhook, via la bibliothèque officielle. Toute requête non signée ou mal signée est rejetée en 400 sans traitement. |
| Fraîcheur | Tolérance d'horloge de 5 minutes sur l'horodatage inclus dans la signature : un événement rejoué au-delà de cette fenêtre est rejeté. |
| Idempotence | L'identifiant d'événement Stripe est enregistré en base avec une contrainte d'unicité. Un événement déjà traité est acquitté en 200 sans effet : les livraisons dupliquées de Stripe (comportement normal de leur part) ne produisent jamais de double traitement. |

L'endpoint de webhook est le seul endpoint public non couvert par le CORS applicatif : il n'est appelé que serveur à serveur par Stripe.

## Secrets et configuration

| Règle | Détail |
|---|---|
| Variables d'environnement uniquement | Tous les secrets (clés Stripe, clé API Claude, secret de signature JWT, identifiants SMTP, mot de passe PostgreSQL) sont injectés par l'environnement, jamais codés en dur |
| Jamais dans git | Aucun secret dans l'historique, y compris dans les fichiers de configuration Docker Compose : les valeurs sensibles sont référencées, pas inscrites |
| `.env.example` committé | Un fichier d'exemple liste toutes les variables attendues, avec des valeurs vides ou factices, pour documenter la configuration sans rien exposer |
| Rotation | Les secrets sont rotables sans redéploiement de code : rotation planifiée au moins annuelle, rotation immédiate en cas de suspicion de fuite (le secret JWT supporte une double validité temporaire pour ne pas invalider brutalement les sessions) |

L'outillage exact de gestion des secrets sur le VPS (fichier d'environnement protégé, coffre dédié) reste à trancher et sera consigné dans un ADR.

## Transport et en-têtes HTTP

Tout le trafic est chiffré, sans exception ni période de transition :

- HTTPS partout, avec un certificat wildcard couvrant `*.surplasse.com` (nécessaire pour les mini-sites en `{slug}.surplasse.com`) et le domaine apex.
- HSTS activé sur tous les domaines (avec `includeSubDomains`), pour interdire tout repli en clair.
- CSP stricte sur les trois fronts (Onboarding, Commande, Dashboard) : scripts et styles limités à l'origine et aux domaines Stripe requis par Elements, aucune source `unsafe-inline` pour les scripts.
- CORS limité aux domaines connus : l'API n'accepte que les origines des trois fronts ; le sous-domaine wildcard des mini-sites est validé par motif côté backend, jamais par un `*` global.
- Cookies de session (côté Dashboard) en `Secure`, `HttpOnly`, `SameSite=Lax` au minimum.

## Téléversements {#televersements}

Les seuls fichiers téléversés sont des images : photo de la carte à l'embarquement, photos de l'établissement et des produits. Le pipeline de traitement neutralise le risque :

1. Validation du type réel du fichier (par les octets de signature, pas seulement l'extension ni le `Content-Type` déclaré) : formats d'image bitmap acceptés uniquement, SVG refusé.
2. Validation de la taille (plafond par fichier, à trancher, de l'ordre de 10 Mo) et du nombre de fichiers par requête.
3. Réécriture systématique : chaque image acceptée est décodée puis réencodée dans un format de sortie contrôlé, ce qui détruit métadonnées, charges utiles annexes et données EXIF (y compris la géolocalisation, un point RGPD autant que sécurité).
4. Aucune exécution ni interprétation : les fichiers sont stockés hors de toute racine servie directement, servis avec un `Content-Type` image forcé et `Content-Disposition` neutre, jamais depuis le domaine de l'API.

Les photos de carte transmises à l'API Claude pour extraction suivent le même pipeline avant envoi (voir [intégrations](integrations.md)).

## Limitation de débit {#limitation-de-debit}

Une limitation de débit s'applique par IP et par session sur les endpoints sensibles :

| Endpoint | Clé de limitation | Objectif |
|---|---|---|
| Demande de magic link | IP et email cible | Empêcher le spam d'emails et l'énumération de comptes |
| Échange de jeton de magic link | IP | Empêcher la recherche exhaustive de jetons |
| Création de Commande | Session client et IP | Limiter les commandes en rafale et la nuisance en salle |
| Lecture de la carte | IP | Freiner le scraping massif sans gêner l'usage normal |
| Endpoints d'embarquement (génération IA) | IP | Protéger le budget d'appels à l'API Claude |

Les seuils exacts restent à trancher et seront calibrés en pré-production. Les dépassements répondent en 429 avec `Retry-After`.

## Sauvegardes

PostgreSQL est sauvegardé de façon chiffrée, avec des copies hors du VPS de production. Une sauvegarde ne vaut que restaurée : un exercice de restauration complet est exécuté à intervalle régulier et son résultat consigné. La stratégie détaillée (fréquence, rétention, chiffrement, procédure de restauration) est décrite dans la page [opérations](../operations/index.md).

## Dépendances

- Mises à jour régulières de toutes les dépendances (Maven côté backend, npm côté frontends et docs), intégrées par petits lots plutôt que par grandes campagnes.
- Dependabot activé sur le dépôt : alertes de vulnérabilités et PR de mise à jour automatiques ; les alertes de sévérité haute ou critique sont traitées en priorité sur le reste du travail.
- Les images Docker de l'infrastructure ([déploiement](../operations/index.md)) sont reconstruites régulièrement pour intégrer les correctifs des images de base.

## Ce qui reste à trancher

| Sujet | Piste | Où sera consignée la décision |
|---|---|---|
| Durée exacte de la session client anonyme | 2 heures glissantes | Le contrat et un ADR si le sujet s'avère structurant |
| Rôles restaurateur différenciés (gérant, salle) | Hors MVP | ADR dédié le moment venu |
| Outillage de gestion des secrets sur le VPS | Fichier d'environnement protégé ou coffre | ADR dédié |
| Seuils de limitation de débit | Calibrage en pré-production | Documentation d'exploitation |
| Plafond de taille des téléversements | De l'ordre de 10 Mo par image | Le contrat |
