---
label: "ADR-0031 : équipes, rôles et vues métier"
order: 310
icon: law
description: "Pourquoi Surplasse conserve un seul Dashboard avec des appartenances par établissement, quatre rôles fixes et trois vues métier."
---

# ADR-0031 : équipes, rôles et vues métier

## Statut

Accepté, 2026-07-23.

## Contexte

Le Dashboard de phase 2 authentifie un restaurateur unique et lui donne tous les droits sur ses établissements. Ce modèle suffit pour qualifier le noyau avec un pilote, mais pas pour un service réel à plusieurs. Le serveur doit suivre les tables sans voir les coordonnées bancaires. La cuisine doit préparer et signaler une rupture sans pouvoir inviter un membre ou rembourser une commande. Le restaurateur ne doit jamais partager son magic link avec toute l'équipe.

Le travail change aussi selon le poste. La salle raisonne par table et par commande prête. La cuisine raisonne par ancienneté, produits, options et temps de préparation. Le restaurateur gère la carte, les horaires, les finances et les accès entre les services. Leur présenter le même tableau chargé de toutes les fonctions ralentirait le coup de feu et exposerait des données inutiles.

L'[ADR-0008](adr-0008-magic-link.md) a volontairement écarté les rôles au premier MVP et prévu une réévaluation si des équipes apparaissaient. Ce déclencheur est atteint. Il n'impose pas pour autant un serveur d'identité externe : les magic links, les sessions courtes et les refresh tokens actuels restent adaptés aux membres nominatifs, à condition d'ajouter une appartenance et des autorisations par établissement.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Un compte restaurateur partagé par établissement | Aucun nouveau modèle d'identité ni écran d'équipe | Aucune attribution des actions, révocation impossible, accès financier partagé, secret transmis à plusieurs personnes |
| Une application distincte pour la salle, la cuisine et la gestion | Interfaces et déploiements complètement isolés | Trois applications à maintenir, navigation et authentification dupliquées, synchronisation et support plus complexes |
| Permissions entièrement configurables | S'adapte à chaque organisation et à chaque intitulé de poste | Matrice difficile à comprendre, tester et supporter pour de petites équipes |
| **Un Dashboard, des appartenances par établissement, quatre rôles fixes et trois vues métier** | Même moteur et même flux, moindre privilège, interfaces spécialisées, modèle explicable | Migration structurante de l'identité, contrôles sur chaque endpoint, besoin d'un mode sûr pour les appareils partagés |

## Décision

Surplasse conserve une seule application Dashboard. Elle expose trois vues métier : **Salle**, **Cuisine** et **Gestion**. Un membre autorisé peut changer de vue selon son rôle. Le Dashboard choisit son atterrissage par défaut, mais l'autorisation reste appliquée par le Backend et ne dépend jamais de la route affichée.

L'identité professionnelle cible repose sur deux entités :

- `TeamMember` représente une personne nommée qui peut se connecter ;
- `EstablishmentMembership` relie cette personne à un établissement et porte exactement un rôle parmi `owner`, `manager`, `service` et `kitchen`.

Le rôle appartient à l'appartenance, pas à la personne globalement. Une même personne peut être `owner` dans un établissement et `manager` dans un autre. La migration de phase 4 transforme chaque restaurateur existant en `TeamMember` et crée une appartenance `owner` pour chacun de ses établissements. Le lien direct `Establishment.restaurateurId` reste la représentation livrée jusqu'à cette migration, puis cesse d'être la source des autorisations. `MagicLinkSession` référence alors `TeamMember` et `RestaurateurSession` devient `TeamMemberSession`. Le déploiement révoque les familles de refresh existantes et demande un nouveau magic link, afin de ne jamais conserver une session dont l'acteur aurait changé de type implicitement.

La matrice initiale est fixe :

| Action | `owner` | `manager` | `service` | `kitchen` |
|---|---:|---:|---:|---:|
| Lire les commandes | Oui | Oui | Oui | Oui, sans données financières |
| Accepter une nouvelle commande | Oui | Oui | Oui | Non |
| Refuser une nouvelle commande avec remboursement intégral contraint | Oui | Oui | Oui, session nominative | Non |
| Démarrer la préparation et marquer prête | Oui | Oui | Lecture | Oui |
| Marquer servie ou retirée | Oui | Oui | Oui | Non |
| Signaler une rupture de produit ou d'option | Oui | Oui | Oui | Oui |
| Mettre en pause la prise de commandes | Oui | Oui | Oui | Non |
| Rouvrir la prise de commandes | Oui | Oui | Non | Non |
| Rembourser | Oui | Oui | Non | Non |
| Gérer la carte, les horaires, les tables et les QR codes | Oui | Oui | Non | Non |
| Voir les finances et exporter | Oui | Oui | Non | Non |
| Gérer l'équipe, la propriété et les composants Stripe sensibles | Oui | Non | Non | Non |

Le refus autorisé au rôle `service` est limité à une commande encore `paid`, avant acceptation, avec un motif fermé et un remboursement intégral automatique. Il passe par une opération de rejet dédiée, pas par le changement générique de statut ni par l'endpoint de remboursement discrétionnaire. Il ne donne ni accès au registre financier, ni droit de choisir un montant, ni droit de rembourser une commande déjà acceptée. Ces remboursements discrétionnaires restent réservés à `owner` et `manager`.

Le rôle `owner` correspond à l'administrateur Surplasse de l'établissement, pas à une qualification juridique du propriétaire du fonds. Au moins une appartenance `owner` active subsiste toujours. Un `owner` invite les membres par email, choisit leur établissement et leur rôle, puis peut révoquer immédiatement leur accès. Le magic link sert à accepter l'invitation et à ouvrir les sessions nominatives. Une révocation ferme les flux SSE enregistrés pour le membre avant de répondre et toute émission ou tout battement de cœur revalide la session et l'appartenance, afin qu'une connexion ouverte ne prolonge pas un droit supprimé.

Un appareil fixe peut utiliser une `WorkstationSession` appairée par un `owner` ou un `manager`. Le Backend crée d'abord un `WorkstationPairingChallenge` court, haché, expirant, à tentatives bornées et consommable une seule fois. L'appareil l'échange ensuite contre sa session. Une session nominative et une session de poste ne peuvent pas coexister dans le même contexte navigateur.

La session de poste est limitée à un établissement et à la vue Salle ou Cuisine. Elle ne donne jamais accès aux finances, à l'équipe, à Stripe ou aux réglages sensibles. Elle possède une expiration, une dernière activité et une révocation à distance. Un poste Salle peut accepter, servir et déclencher une pause de sécurité, mais seul un membre nominatif peut refuser une commande. Un poste partagé ne remplace pas un compte nominatif pour un remboursement ou une action de gestion. Une session capable d'accepter doit encore s'armer explicitement comme réceptionnaire ; son `ReceptionLease` court expire si la vue n'est plus visible, connectée ou autorisée. Un poste Cuisine ne peut pas obtenir ce bail.

Les actions sensibles produisent un `AuditEvent` append-only avec l'acteur, le type de session, l'établissement, l'action, la ressource, l'heure et le résultat. Un traitement automatique utilise l'acteur `system` et l'identifiant de son job durable, sans emprunter l'identité d'un membre. Sont au minimum journalisés les changements de rôle, révocations, appairages, remboursements, pauses, rappels de ticket, publications de carte et changements de prix. Le journal n'enregistre aucun secret et reste filtré par établissement.

Nous ne retenons pas de permissions personnalisables dans le premier socle professionnel. Une nouvelle capacité rejoint la matrice après décision produit et tests croisés. Un besoin récurrent de profils supplémentaires, de fédération d'identité ou de politiques configurables déclenchera un nouvel ADR et la réévaluation OIDC prévue par l'ADR-0008.

## Conséquences

### Positives

- La salle, la cuisine et le restaurateur voient l'information utile à leur tâche sans dupliquer le moteur de commande.
- Les données financières et les actions irréversibles suivent le principe du moindre privilège.
- Une révocation coupe un membre ou un poste sans déconnecter toute l'équipe.
- Chaque action sensible devient attribuable et vérifiable pendant un incident.
- Les petits établissements gardent une vue combinée en utilisant un rôle `owner` ou `manager`, sans configuration spéciale.

### Négatives et dettes assumées

- La phase 4 doit migrer l'identité, les sessions, les autorisations, le contrat et chaque endpoint restaurateur.
- La migration force une reconnexion unique de tous les restaurateurs afin d'établir sans ambiguïté leur nouvelle identité de membre.
- Les projections de commande diffèrent selon les rôles afin de ne pas transmettre des montants ou données inutiles à la cuisine.
- L'appairage d'un poste partagé ajoute une nouvelle famille de sessions à sécuriser, expirer et superviser.
- Quatre rôles fixes ne couvrent pas les brigades complexes, le bar comme poste autonome ni les délégations personnalisées.
- L'absence initiale d'OIDC conserve à Surplasse la responsabilité de l'authentification et de la révocation.
