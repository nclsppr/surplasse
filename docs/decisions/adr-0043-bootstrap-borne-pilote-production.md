---
label: "ADR-0043 : Bootstrap borné du pilote"
order: 430
icon: law
description: "Pourquoi le premier graphe testeurs est créé par une commande Backend privée, transactionnelle et strictement répétable."
---

# ADR-0043 : bootstrap borné du pilote de production

## Statut

Remplacé par l'[ADR-0047](adr-0047-version-flyway-bootstrap-pilote.md), 2026-08-23.

## Contexte

La production testeurs autorisée par l'[ADR-0041](adr-0041-production-testeurs-stripe-test.md) doit commencer avec un seul restaurateur, un seul établissement, une carte minimale et une table. Les endpoints d'embarquement autonome ne sont pas encore livrés. Le seed de développement purge et recrée des données de démonstration. Il ne peut donc jamais être utilisé sur Atlas.

Une suite de commandes SQL opérateur créerait un état impossible à reproduire et contournerait les invariants du Backend. Un endpoint public temporaire élargirait la surface exposée au moment le plus risqué. Le premier rattachement Stripe doit en outre prouver que le compte Accounts v2 attendu est bien un compte test dont la capacité `card_payments` est `active` avant toute écriture.

Le bootstrap est un geste de transition pour le premier pilote. Il ne remplace ni l'embarquement produit, ni une migration Flyway, ni une interface générale d'administration.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Utiliser le seed de développement | Déjà disponible | Destructif ; données de démonstration ; contrat incompatible avec la production |
| Fournir un script SQL à l'opérateur | Mise en oeuvre courte | Contourne le Backend ; valeurs et transaction difficiles à prouver ; répétition dangereuse |
| Ajouter un endpoint temporaire | Réutilisable à distance | Nouvelle surface publique et nouveau contrôle d'accès à supprimer ensuite |
| **Ajouter une commande Backend privée et one-shot** | Même image immuable ; aucune écoute réseau ; transaction totale ; contrat testable et répétable | Code de transition à maintenir ; dépendance au contrôleur Atlas et à un manifeste protégé |

## Décision

Nous ajoutons `PilotBootstrapCommand`, une classe Java autonome empaquetée dans l'image Backend. Le runner `/opt/surplasse/scripts/backend-pilot-bootstrap.sh` accepte exactement `status` ou `apply`. Il ne démarre ni Quarkus HTTP, ni Flyway, ni un service permanent.

Le service Compose `pilot-bootstrap` appartient à un profil explicite, utilise exactement le digest Backend admis, porte `restart: "no"`, n'expose aucun port et rejoint uniquement `db_surplasse` et `app_surplasse`. Le premier réseau donne accès à PostgreSQL. Le second conserve une route de sortie pour la lecture Stripe. Il ne possède aucun alias de service public.

Le manifeste décrit exactement six identifiants UUID v4 et les valeurs du restaurateur, de l'établissement, de la carte, de la catégorie, du produit et de la table. Atlas le matérialise dans `/etc/vps/applications/surplasse-pilot-bootstrap.json`, sous `root:10001`, en mode `0440`, comme fichier régulier à lien unique de 16 Kio au maximum. Il ne contient aucune clé Stripe, aucun mot de passe et aucun code de table.

Avant d'ouvrir une transaction, la commande lit le compte indiqué au moyen d'Accounts v2 et refuse tout compte différent, fermé, live ou sans capacité `configuration.merchant.capabilities.card_payments.status=active`. La clé doit être une clé restreinte test montée en fichier. La commande ne journalise ni clé, ni détail d'exception Stripe, ni donnée du manifeste.

`apply` exige un historique Flyway exactement composé de V1 à V14. La base doit être vide ou contenir exactement le graphe manifesté, sans session, commande, paiement, remboursement ni autre ligne opérationnelle. Sur base vide, les six lignes sont insérées dans une transaction sérialisable avec un horodatage commun. `activated_at` est fixé une seule fois. Le code de table est généré avec 128 bits aléatoires et n'est jamais affiché. La prise de commandes commence toujours à `paused`.

Une seconde exécution avec le même manifeste ne modifie rien. Toute divergence, tout autre compte Stripe, toute ligne supplémentaire ou toute version Flyway différente échoue sans suppression, correction silencieuse ni écriture partielle. `status` relit le même contrat sans mutation. L'ouverture à `open` reste une action métier authentifiée distincte, exécutée seulement après la preuve initiale du bootstrap.

## Conséquences

### Positives

- aucune donnée de développement ni commande SQL improvisée n'entre sur Atlas ;
- le premier état métier est atomique et reproductible ;
- un échec Stripe, réseau, entropie ou PostgreSQL laisse la base vide et la prise de commandes fermée ;
- le même digest Backend fournit le runtime, le migrateur et la commande privée ;
- le manifeste ne porte aucune valeur secrète et le code de table ne quitte pas PostgreSQL.

### Négatives et dettes assumées

- le contrôleur `vps-infra` doit admettre le profil, le manifeste et la double attache réseau avant toute utilisation ;
- la clé Stripe du Backend doit aussi autoriser la lecture du compte Accounts v2 attendu ;
- la commande ne crée qu'un graphe pilote fixe et refuse une base déjà utilisée ;
- après l'ouverture explicite de la prise de commandes, la preuve courante passe par l'API métier et non par un nouvel `apply` ;
- aucune suppression automatique du pilote n'est fournie ; un nettoyage futur exigera une procédure examinée séparément ;
- les sauvegardes locales restent une dette acceptée pour les testeurs, jamais pour l'ouverture publique.
