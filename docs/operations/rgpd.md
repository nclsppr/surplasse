---
label: RGPD et confidentialité
order: 40
icon: law
description: Minimisation par conception, bases légales des traitements, durées de conservation, droits des personnes, sous-traitants et cookies de la plateforme Surplasse.
---

# RGPD et confidentialité

Cette page décrit comment Surplasse traite les données personnelles : ce qui est collecté (le moins possible), sur quel fondement, pour combien de temps, et comment les personnes exercent leurs droits. Elle complète la page [sécurité](../architecture/securite.md) (qui protège ces données) et la page [données](../architecture/donnees.md) (qui les modélise). Le volet journalisation est traité dans la page [observabilité](observabilite.md).

!!! info Documentation de référence
Le projet n'a pas encore de code applicatif. Cette page est la spécification de conformité que le produit doit respecter dès sa première ligne de code : la conformité se conçoit, elle ne se rattrape pas. Les points nécessitant une validation juridique sont signalés explicitement.
!!!

## La posture : minimiser par conception

Le choix de produit le plus structurant de Surplasse est aussi son meilleur argument de conformité : **le client peut consulter la carte, commander et payer sans créer de compte, sans donner son nom, sans fournir la moindre donnée personnelle**. La session client est un jeton opaque anonyme (voir [session client anonyme](../architecture/securite.md#session-client-anonyme)), le paiement est collecté directement par Stripe, et la commande se suffit d'un numéro de table.

Tout le reste en découle :

- Ce qui n'est pas collecté n'a pas à être protégé, conservé, purgé ni déclaré.
- Les rares données personnelles collectées le sont à l'initiative de la personne (un email pour recevoir un reçu, un prénom pour l'appel au comptoir) et pour un usage unique et visible.
- Les données du côté restaurateur (email de compte, photos de la carte, contenu de la carte) sont essentiellement des données professionnelles, au périmètre stable et réduit.
- Aucune donnée n'est revendue, croisée ou partagée à des fins publicitaires. Surplasse n'est pas une marketplace : les clients d'un établissement restent les clients de cet établissement.

Le flux nominal d'une commande, vu sous l'angle des données personnelles :

```
Client                          Surplasse                         Sous-traitants
  |                                 |                                   |
  |  scan QR, carte, panier         |  session anonyme :                |
  |-------------------------------->|  aucune donnée personnelle        |
  |                                 |                                   |
  |  paiement                       |  montant et référence seulement   |
  |---------------------------------|---------------------------------->|  Stripe reçoit la
  |                                 |                                   |  carte bancaire,
  |  email pour le reçu (optionnel) |  rattaché à la commande,          |  jamais Surplasse
  |-------------------------------->|  purgé sous 30 jours              |
```

En pratique, chaque principe du RGPD trouve ainsi une traduction structurelle plutôt que procédurale :

| Principe | Traduction dans Surplasse |
|---|---|
| Minimisation | Le parcours Commande fonctionne sans aucune donnée personnelle ; chaque champ optionnel se justifie par un usage unique |
| Limitation des finalités | Un email de reçu sert au reçu ; le marketing exige un consentement séparé, jamais une case pré-cochée |
| Limitation de conservation | Chaque donnée du tableau ci-dessous a une durée et une purge automatique |
| Intégrité et confidentialité | Déléguées à la posture décrite dans la page [sécurité](../architecture/securite.md) |

## Le registre des traitements

!!! info Registre tenu dans cette page
En attendant un outil dédié, le tableau ci-dessous tient lieu de registre des activités de traitement (article 30 du RGPD). Toute modification d'un traitement passe par une mise à jour de ce tableau, dans le même commit que la spécification qui l'introduit.
!!!

| Traitement | Personnes concernées | Données | Base légale |
|---|---|---|---|
| Exécution de la commande et du paiement | Clients | Contenu de la commande, montant, table, référence de paiement Stripe ; email ou prénom uniquement si fournis | Exécution du contrat |
| Envoi du magic link de connexion | Restaurateurs | Adresse email, jeton haché horodaté | Exécution du contrat (l'authentification est nécessaire pour fournir le service au titulaire du compte) |
| Marketing et fidélité | Clients ayant opté | Adresse email, historique de commandes rattaché | Consentement explicite, retirable à tout moment |
| Collecte et publication d'avis | Clients ayant opté | Note, texte de l'avis, prénom éventuel | Consentement |
| Amélioration des photos et extraction de carte | Restaurateurs | Photos de la carte et de l'établissement, carte structurée produite | Exécution du contrat (côté restaurateur) |
| Pré-génération des espaces et prise de contact pour la revendication | Restaurateurs prospectés | Données professionnelles publiques de l'établissement (nom, adresse, carte publiée), email professionnel de contact | Intérêt légitime (proposer le service à des professionnels identifiés publiquement) |
| Journalisation et sécurité de la plateforme | Tous | Logs techniques sans donnée personnelle (voir [observabilité](observabilite.md)), adresses IP pour la limitation de débit | Intérêt légitime (sécurité et continuité du service) |

La qualification exacte des rôles (Surplasse responsable de traitement, ou sous-traitant du restaurateur pour les données des clients de son établissement) reste à valider juridiquement ; elle conditionne le contenu des conditions générales côté restaurateur.

## Données et durées de conservation

Le modèle de données complet, entité par entité, vit dans la page [données](../architecture/donnees.md), qui fait foi. Le tableau ci-dessous en reprend la lecture orientée conservation : quelle donnée personnelle, combien de temps en base active, et ce qu'il en advient ensuite.

| Donnée | Rattachée à | Durée en base active | Sort ensuite |
|---|---|---|---|
| Contenu et montants de la commande | Commande | Vie de l'établissement | Archivage comptable 10 ans (obligation légale) après anonymisation des champs personnels |
| Prénom d'appel au comptoir (si fourni) | Commande | Jusqu'à la clôture de la commande, au plus 24 heures | Effacement |
| Email de remise du reçu (si fourni) | Commande | 30 jours (permettre un renvoi du reçu) | Effacement |
| Email marketing et fidélité (si consentement) | Client ayant opté | Jusqu'au retrait du consentement, purge après 3 ans sans interaction | Effacement |
| Avis publié | Établissement | Durée de publication choisie par le restaurateur | Effacement à la demande de l'auteur ou à la dépublication |
| Email et nom du compte restaurateur | Restaurateur | Durée de la relation contractuelle | Effacement 5 ans après la clôture du compte (prescription contractuelle) |
| Jetons de magic link (hachés) | Restaurateur | 15 minutes de validité | Purge automatique quotidienne |
| Session client anonyme | Session | 2 heures glissantes | Purge sous 24 heures ; ne contient aucune donnée personnelle |
| Photos de la carte et de l'établissement | Établissement | Vie de l'établissement | Effacement à la clôture ; données professionnelles, pas personnelles |
| Adresses IP (limitation de débit, logs) | Aucune entité métier | 30 jours au maximum | Rotation des logs (voir [observabilité](observabilite.md)) |

Deux principes transverses :

- **L'anonymisation plutôt que la suppression comptable.** Une commande ne peut pas disparaître (obligation comptable), mais ses champs personnels le peuvent : l'effacement d'un client vide les champs email et prénom, les montants et le contenu restent.
- **La purge est automatique.** Chaque durée du tableau correspond à une tâche planifiée du Backend (extension `scheduler`, voir [les traitements asynchrones](../architecture/backend.md#les-traitements-asynchrones)), jamais à une intervention manuelle.

## Les droits des personnes

Toute demande passe par une adresse dédiée : `rgpd@surplasse.com` (adresse exacte à confirmer à l'ouverture du service). Le délai de réponse est d'un mois, extensible de deux mois pour les demandes complexes, conformément à l'article 12 du RGPD.

| Droit | Mise en œuvre concrète | Délai |
|---|---|---|
| Accès | Export des données rattachées à l'email fourni : commandes portant cet email, consentements, avis | Un mois |
| Rectification | Restaurateur : directement dans le Dashboard (email, coordonnées). Client : sur demande par email | Immédiat côté Dashboard, un mois sinon |
| Effacement | Anonymisation des commandes concernées, suppression des consentements et avis ; le compte restaurateur est clôturé puis purgé selon le tableau ci-dessus | Un mois |
| Retrait du consentement | Lien de désinscription dans chaque email marketing, effet immédiat ; ou demande par email | Immédiat |
| Opposition (prospection à la revendication) | Lien de désinscription dans chaque email de prise de contact ; l'espace pré-généré cesse toute relance | Immédiat |
| Portabilité | Export dans un format structuré courant (JSON) des données fournies par la personne | Un mois |

Point pratique assumé : un client qui n'a rien fourni n'est pas identifiable, et c'est voulu. Si aucune donnée n'est rattachable à l'email présenté dans la demande, la réponse le dit simplement : il n'y a rien à communiquer ni à effacer.

## Les sous-traitants

| Sous-traitant | Rôle | Données transmises | Remarques |
|---|---|---|---|
| Stripe | Paiement | Données de carte bancaire (collectées directement par Stripe Elements, jamais vues par Surplasse), montant, référence de commande | Périmètre PCI DSS porté par Stripe (voir [sécurité](../architecture/securite.md#posture-générale)) ; transferts encadrés par ses clauses contractuelles |
| Hébergeur du VPS (à trancher) | Hébergement du Backend et de PostgreSQL | L'ensemble des données en base | Hébergeur européen exigé, données localisées dans l'Union européenne |
| Fournisseur d'emails (à trancher) | Envoi des magic links, reçus et notifications | Adresses email des destinataires, contenu des messages | Fournisseur européen privilégié ; décision consignée dans un ADR |
| Anthropic (API Claude) | Extraction de carte depuis photo, enrichissement de données publiques | Photos de cartes de restaurant, données publiques d'établissements | Aucune donnée de client final, jamais (voir ci-dessous) ; accord de traitement des données et absence d'entraînement sur les contenus soumis à vérifier à la contractualisation |

Chaque sous-traitant fait l'objet d'un accord de traitement des données (DPA) avant toute mise en production ; la liste ci-dessus est publiée dans la politique de confidentialité du produit et tenue à jour dans cette page.

## L'IA et les données personnelles

!!! warning Aucune donnée de client final vers l'API d'extraction
Le pipeline d'extraction (voir [intégrations](../architecture/integrations.md)) ne transmet à l'API Claude que des photos de cartes de restaurant et des données publiques d'établissements : des données professionnelles, par nature destinées à être affichées publiquement. Aucune donnée de client final (email, prénom, contenu de commande, historique) ne doit jamais transiter par un appel à l'API d'extraction ou d'enrichissement, quelle qu'en soit la raison. Cette règle est structurelle : le module `generation` du Backend n'a tout simplement pas accès aux données des commandes (voir [les règles de dépendances entre modules](../architecture/backend.md#un-monolithe-modulaire)), et elle est vérifiée en revue de code.
!!!

Les photos passent en outre par le pipeline de réécriture décrit dans la page [sécurité](../architecture/securite.md#televersements), qui détruit les métadonnées EXIF (dont la géolocalisation) avant tout envoi.

## Cookies et traceurs

La ligne est simple : **aucun cookie tiers, aucun traceur publicitaire, aucune mesure d'audience tierce**, sur aucune des trois applications. Seuls existent les cookies et stockages strictement nécessaires au service :

| Application | Stockage | Finalité |
|---|---|---|
| Commande | Jeton de session anonyme, panier en stockage local | Maintenir la session de table et le panier en cours ; aucune donnée personnelle |
| Dashboard | Cookie de session restaurateur (`Secure`, `HttpOnly`, voir [sécurité](../architecture/securite.md#transport-et-en-têtes-http)) | Authentification de la session |
| Onboarding | Progression du tunnel d'embarquement en stockage local | Reprendre l'embarquement où il s'était arrêté |

Ces stockages relèvent de l'exemption de consentement prévue par les lignes directrices de la CNIL pour les traceurs strictement nécessaires à la fourniture du service demandé. En conséquence, **le front Commande n'affiche pas de bandeau de consentement cookies** : rien n'y requiert un consentement au sens de la doctrine CNIL. Cette lecture reste à valider juridiquement avant le lancement ; si un outil de mesure d'audience est ajouté un jour, il devra soit être configuré en mode exempté (au sens CNIL), soit déclencher un vrai recueil de consentement, et ce choix fera l'objet d'un ADR.

## Gouvernance

- **Pas de DPO à ce stade.** Surplasse n'est ni un organisme public, ni un acteur du suivi à grande échelle, ni un traiteur de données sensibles à grande échelle : la désignation d'un délégué à la protection des données n'est pas requise. Le sujet sera réévalué avec la croissance.
- **Une adresse de contact dédiée** (`rgpd@surplasse.com`, à confirmer) figure dans la politique de confidentialité, dans les emails et sur les mini-sites ; elle est le canal unique des demandes d'exercice de droits.
- **Pas d'analyse d'impact (AIPD) requise a priori** : les traitements listés ne croisent pas les critères de la CNIL (pas de surveillance systématique, pas de données sensibles, pas de croisement de sources à grande échelle). À réévaluer si le périmètre change, notamment autour de la fidélité.
- **Notification de violation** : en cas de violation de données présentant un risque, notification à la CNIL sous 72 heures et information des personnes si le risque est élevé ; la procédure opérationnelle s'appuie sur les [sauvegardes](../architecture/securite.md#sauvegardes) et les logs pour qualifier le périmètre.

## Ce qui reste à trancher ou à valider

| Sujet | Nature | Échéance |
|---|---|---|
| Qualification des rôles (responsable ou sous-traitant selon les traitements) | Validation juridique | Avant la rédaction des conditions générales |
| Absence de bandeau cookies sur le front Commande | Validation juridique | Avant le lancement |
| Hébergeur du VPS et fournisseur d'emails (européens) | Décision, ADR | Avant le premier déploiement |
| Conditions du DPA Anthropic (entraînement, localisation) | Vérification contractuelle | Avant la mise en production de l'extraction |
| Adresse de contact définitive et politique de confidentialité publiée | Rédaction | Avant le lancement |

## Pour aller plus loin

| Page | Contenu |
|---|---|
| [Sécurité](../architecture/securite.md) | La protection technique des données : sessions, autorisations, téléversements, sauvegardes |
| [Les données](../architecture/donnees.md) | Le modèle de données complet et le tableau de conservation de référence |
| [Observabilité](observabilite.md) | La règle de non-journalisation des données personnelles et la rétention des logs |
| [Intégrations](../architecture/integrations.md) | Les échanges concrets avec Stripe et l'API Claude |
