---
label: Sécurité
order: 70
icon: shield
description: Posture de sécurité de Surplasse, modèle de menaces, authentification, autorisations, webhooks, secrets et durcissement.
---

# Sécurité

Cette page décrit la posture de sécurité cible de Surplasse : ce que la plateforme protège, contre quoi, et par quels mécanismes. Elle complète la [vue d'ensemble de l'architecture](index.md), la page [intégrations](integrations.md) pour les échanges avec Stripe et l'API OpenAI, et la page [RGPD](../operations/rgpd.md) pour le volet données personnelles.

## Posture générale

La sécurité de Surplasse repose d'abord sur la réduction de la surface d'attaque, avant l'empilement de contre-mesures.

Trois choix structurants minimisent le risque à la source :

| Choix | Conséquence sécurité |
|---|---|
| Aucune donnée de carte bancaire ne transite par nos systèmes | Le paiement est délégué à Stripe (Elements et Payment Intents côté client). Le périmètre PCI DSS de Surplasse se limite au questionnaire SAQ A, le plus léger. |
| Le client final n'a pas de compte | Pas de mot de passe client à stocker, pas de base d'identifiants à protéger de ce côté, pas de credential stuffing possible sur le parcours Commande. |
| Auth restaurateur sans mot de passe (magic link) | Aucun mot de passe restaurateur en base. La compromission de la base ne livre aucun secret d'authentification réutilisable. |

Le reste de la posture découle de ce socle : sessions courtes, autorisations filtrées par établissement, validation stricte des entrées, chiffrement en transit partout.

!!! info État actuel au 2026-07-19
Le catalogue, la commande, le paiement et le module Backend `identity` sont implémentés localement. La lecture paginée des commandes opérationnelles authentifie le restaurateur et vérifie son appartenance à l'établissement avant toute requête métier. Le premier Dashboard utilise ce parcours et reste en lecture seule. Rien n'est encore déployé en production. L'identité s'exécute dans l'unique processus Backend, sans service autonome.
!!!

## Durcissements Dashboard avant production {#durcissements-dashboard-avant-production}

Le parcours local protège déjà le jeton de magic link, les cookies et l'autorisation par établissement. Deux points restent néanmoins bloquants avant d'exposer le Dashboard sur Internet :

| Point | Risque actuel | Critère de fermeture |
|---|---|---|
| CORS avec cookies | Le Backend de production conserve les credentials pour l'apex et tout sous-domaine direct autorisé par le profil. Le Dashboard fonctionne, mais un mini-site compromis pourrait donc lire une réponse authentifiée. | Le Caddy de production ajoute les credentials uniquement pour les origines Dashboard et Onboarding explicitement listées. Les mini-sites gardent les routes publiques sans credentials. Le découpage est couvert par des tests CORS positifs et négatifs. |
| Rotation entre onglets | Le Dashboard mutualise un renouvellement concurrent dans un onglet, mais pas entre plusieurs onglets. Deux renouvellements simultanés peuvent réutiliser le même refresh token et provoquer la révocation de toute sa famille. | Une coordination inter-onglets, par exemple Web Locks et BroadcastChannel avec repli documenté, ou une tolérance serveur bornée et idempotente, garantit un seul renouvellement effectif. Un test navigateur ouvre deux onglets et vérifie que la session reste valide. |

La configuration actuelle conserve le comportement de production antérieur afin que l'outillage local ne le modifie pas, mais elle n'est pas le niveau de cloisonnement final. Le choix précis du découpage CORS au proxy et de la coordination de session sera consigné dans un ADR si son impact dépasse le Dashboard. Tant que ces critères ne sont pas satisfaits, la configuration `%prod` ne vaut pas autorisation de déployer.

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
     |  1. POST /v1/auth/magic-links                              |
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
     |  6. POST /v1/auth/sessions  |                               |
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
- Le lien place le jeton dans le fragment `#token=...`, jamais dans la query string. Le navigateur ne transmet pas ce fragment au serveur statique, aux journaux d'accès ni dans le référent HTTP. Le Dashboard le retire immédiatement de l'URL avant l'échange par POST.
- Le JWT ne contient aucune donnée personnelle : uniquement l'identifiant du restaurateur, l'identifiant de famille de session et les claims techniques de validité.
- Le JWT est signé en RS256. Son en-tête porte le `kid` de la clé courante ; le Backend signe avec une clé privée et vérifie avec un JWKS public contenant la clé courante et, pendant une rotation, la précédente.
- Le refresh token est opaque et seule son empreinte est stockée. Chaque rotation conserve l'ancien enregistrement jusqu'à expiration ; sa réutilisation révoque toute la famille.
- Les cookies `surplasse_session` et `surplasse_refresh` sont hôte uniquement pour l'API, sans attribut `Domain`. Ils sont `HttpOnly`, `SameSite=Lax` et `Secure` dans les deux environnements HTTPS. Le JWT utilise `Path=/` et le refresh token `Path=/v1/auth/sessions`.
- Le Dashboard envoie les cookies avec `credentials: "include"` ; son `EventSource` utilise `withCredentials: true`.

La remise du magic link est asynchrone mais non durable au MVP. Le Backend répond 202 après avoir persisté le jeton, sans attendre le SMTP. Un arrêt du processus ou un échec SMTP à cet instant peut perdre l'email. Le restaurateur peut alors demander un nouveau lien, ce qui invalide le précédent. Aucun jeton ni aucune adresse email n'est journalisé.

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
| Variables d'environnement uniquement | Tous les secrets (clés Stripe, clé API OpenAI, clé privée de signature JWT, identifiants SMTP, mot de passe PostgreSQL) sont injectés par l'environnement ou montés hors image, jamais codés en dur |
| Jamais dans git | Aucun secret dans l'historique, y compris dans les fichiers de configuration Docker Compose : les valeurs sensibles sont référencées, pas inscrites |
| `.env.example` committé | Un fichier d'exemple liste toutes les variables attendues, avec des valeurs vides ou factices, pour documenter la configuration sans rien exposer |
| Rotation | Les secrets sont rotables sans modification de code : rotation planifiée au moins annuelle, immédiate en cas de suspicion de fuite. Pour le JWT, le JWKS conserve temporairement les clés publiques courante et précédente afin de laisser expirer les sessions signées avant la bascule |

L'outillage exact de gestion des secrets sur le VPS (fichier d'environnement protégé, coffre dédié) reste à trancher et sera consigné dans un ADR.

Sous Ubuntu LTS, qui fait foi pour la production, `AUTH_JWT_PRIVATE_KEY_PATH` pointe vers la clé privée RS256 courante, `AUTH_JWT_KEY_ID` vers son `kid`, et `AUTH_JWT_JWKS_PATH` vers le jeu de clés publiques de vérification. L'émetteur suit obligatoirement `API_URL` et `AUTH_JWT_AUDIENCE` verrouille l'audience. Les fichiers de clés sont montés en lecture seule hors de l'image. La procédure de rotation et l'inventaire complet des variables vivent dans [Environnements](../operations/environnements.md#backend-quarkus).

## Transport et en-têtes HTTP

Tout le trafic est chiffré, sans exception ni période de transition :

- HTTPS partout, avec un certificat wildcard couvrant `*.surplasse.com` (nécessaire pour les mini-sites en `{slug}.surplasse.com`) et le domaine apex.
- HSTS activé sur tous les domaines (avec `includeSubDomains`), pour interdire tout repli en clair.
- CSP stricte sur les trois fronts (Onboarding, Commande, Dashboard) : scripts et styles limités à l'origine et aux domaines Stripe requis par Elements, aucune source `unsafe-inline` pour les scripts.
- CORS séparé selon la sensibilité : le profil injecte seulement l'apex et un sous-domaine direct HTTPS du domaine courant. En local, Quarkus refuse les credentials et Caddy les ajoute uniquement pour l'origine exacte `dashboard.surplasse.test`. La production conserve temporairement les credentials sur sa liste d'origines `.com`; son Caddy devra reproduire la branche exacte du Dashboard avant tout déploiement, conformément au bloqueur ci-dessus.
- Cookies de session hôte uniquement pour `api.surplasse.test` en local et `api.surplasse.com` en production, sans attribut `Domain`, en `Secure`, `HttpOnly`, `SameSite=Lax`.

## Téléversements {#televersements}

Les seuls fichiers téléversés sont des images : photo de la carte à l'embarquement, photos de l'établissement et des produits. Le pipeline de traitement neutralise le risque :

1. Validation du type réel du fichier (par les octets de signature, pas seulement l'extension ni le `Content-Type` déclaré) : formats d'image bitmap acceptés uniquement, SVG refusé.
2. Validation de la taille (plafond par fichier, à trancher, de l'ordre de 10 Mo) et du nombre de fichiers par requête.
3. Réécriture systématique : chaque image acceptée est décodée puis réencodée dans un format de sortie contrôlé, ce qui détruit métadonnées, charges utiles annexes et données EXIF (y compris la géolocalisation, un point RGPD autant que sécurité).
4. Aucune exécution ni interprétation : les fichiers sont stockés hors de toute racine servie directement, servis avec un `Content-Type` image forcé et `Content-Disposition` neutre, jamais depuis le domaine de l'API.

Les photos de carte transmises à l'API OpenAI pour extraction suivent le même pipeline avant envoi (voir [intégrations](integrations.md)).

## Limitation de débit {#limitation-de-debit}

Une limitation de débit s'applique par IP et par session sur les endpoints sensibles. La première protection effectivement livrée concerne la demande de magic link : 5 demandes par email cible et 20 par IP sur une fenêtre de 15 minutes.

| Endpoint | Clé de limitation | Objectif |
|---|---|---|
| Demande de magic link | IP et email cible | Implémenté : empêcher le spam d'emails et l'énumération de comptes |
| Échange de jeton de magic link | IP | Cible : empêcher la recherche exhaustive de jetons |
| Création de Commande | Session client et IP | Cible : limiter les commandes en rafale et la nuisance en salle |
| Lecture de la carte | IP | Cible : freiner le scraping massif sans gêner l'usage normal |
| Endpoints d'embarquement (génération IA) | IP | Cible : protéger le budget d'appels à l'API OpenAI |

Les compteurs de magic link sont locaux au processus et conservés en mémoire. Ils sont remis à zéro à chaque redémarrage et ne seraient pas partagés entre plusieurs instances. Cette limite est acceptable sur le VPS unique du MVP. Une persistance ou un magasin partagé devra précéder tout passage à plusieurs instances. Les dépassements répondent en 429 avec `Retry-After`. Les seuils des protections encore cibles restent à calibrer.

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
| Outillage de gestion des secrets sur le VPS | Orientation : fichier d'environnement protégé (chmod 600) sur le VPS, copies maîtresses dans un gestionnaire de mots de passe (le coffre des humains), rotation documentée. Un coffre serveur dédié (Vault, Infisical) ne se justifiera que si les secrets se multiplient réellement (notifications, API tierces) ou si plusieurs opérateurs partagent l'exploitation | ADR dédié, avec `infra/` |
| Seuils de limitation hors demande de magic link et futur stockage partagé des compteurs | Calibrage avant activation de chaque endpoint, stockage partagé avant toute seconde instance | Documentation d'exploitation |
| Plafond de taille des téléversements | De l'ordre de 10 Mo par image | Le contrat |
| Découpage CORS entre routes publiques et restaurateur | Origines explicites avec credentials pour Dashboard et Onboarding, routes publiques sans credentials pour les mini-sites | ADR si une séparation d'API ou de domaine est retenue |
| Coordination du refresh token entre onglets | Web Locks et BroadcastChannel côté Dashboard, ou tolérance serveur bornée et idempotente | ADR si le protocole de rotation serveur évolue |
