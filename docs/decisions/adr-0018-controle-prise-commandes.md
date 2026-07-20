---
label: "ADR-0018 : Contrôle de la prise de commandes"
order: 180
icon: law
description: "Pourquoi la prise de commandes possède un état opérationnel persistant, distinct du cycle de vie de l'établissement."
---

# ADR-0018 : contrôle opérationnel de la prise de commandes

## Statut

Accepté, 2026-07-20.

## Contexte

Le pilote de phase 2 doit pouvoir interrompre immédiatement les nouvelles sessions de table, les nouvelles commandes et les nouvelles sessions de paiement. Cette interruption ne doit ni masquer la carte publique, ni couper le suivi des commandes existantes, ni empêcher le restaurant de terminer le service déjà engagé. La production doit en outre démarrer fermée, sans dépendre d'une écriture SQL manuelle, d'un redéploiement ou d'une modification de configuration.

Le cycle de vie `Establishment.status` répond à une autre question : l'établissement est-il encore en configuration, actif ou suspendu au niveau de la plateforme ? Le réutiliser pour une pause de service confondrait une décision administrative durable avec un geste opérationnel réversible. Cette confusion rendrait aussi le mini-site indisponible alors que la carte doit rester consultable en lecture seule.

La création d'une session de paiement comporte enfin un appel réseau à Stripe. Une pause locale peut empêcher toute nouvelle admission, mais elle ne peut pas reprendre un `client_secret` déjà remis au navigateur. Le système doit reconnaître cette frontière plutôt que promettre l'annulation instantanée d'un paiement déjà engagé.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Réutiliser `Establishment.status=suspended` | Aucun nouvel état persistant à introduire | Mélange cycle de vie et exploitation, masque le mini-site, rend une pause de service trop lourde et ambiguë |
| Utiliser une variable d'environnement ou un feature flag global | Interrupteur simple à lire dans le code | Portée globale, changement dépendant du déploiement ou d'un service tiers, pas d'historique par établissement |
| Déduire l'ouverture des seules capacités Stripe | Ferme les paiements quand Stripe les désactive | Stripe ne contrôle pas les commandes, aucun geste manuel du restaurateur, une récupération Stripe pourrait rouvrir sans décision humaine |
| **Ajouter un état opérationnel persistant par établissement** | Portée exacte, changement idempotent, fail-closed, carte toujours lisible, contrôle explicite par le restaurateur | Nouvelle migration, nouveau contrat et verrouillage transactionnel à maintenir |

## Décision

Nous retenons un **état opérationnel persistant de prise de commandes**, distinct de `Establishment.status`.

Chaque établissement porte `order_intake_status`, avec les valeurs `open` et `paused`, ainsi que `order_intake_updated_at`. Cet horodatage suit le dernier changement du statut configuré, y compris une auto-pause Stripe. Il ne prétend pas dater chaque variation d'un prérequis qui modifierait seulement la disponibilité effective. Une nouvelle base et tout établissement non explicitement préparé démarrent à `paused`. Le seed de démonstration peut ouvrir explicitement son établissement, mais aucun défaut de production ne doit accepter de commande.

L'état configuré ne suffit pas à déclarer le parcours ouvert. `acceptingOrders` vaut `true` uniquement si toutes les conditions suivantes sont réunies :

- `order_intake_status` vaut `open` ;
- le cycle de vie de l'établissement vaut `active` ;
- une carte est publiée ;
- au moins une table est active ;
- un compte Stripe Connect est rattaché, `stripe_charges_enabled` vaut `true` et `activated_at` est renseigné.

Le contrat expose `GET /v1/establishments/{establishmentId}/order-intake` et `PUT /v1/establishments/{establishmentId}/order-intake`. Le `PUT` fixe explicitement `open` ou `paused` et reste idempotent. La réponse distingue le statut configuré de `acceptingOrders` et fournit, quand l'admission est fermée, un `blockedReason` effectif parmi `paused`, `establishment_not_active`, `configuration_unavailable` et `payments_unavailable`. `configuration_unavailable` regroupe l'absence de carte publiée ou de table active. Une réouverture refusée répond avec un type de problème stable dédié au cycle de vie, à la configuration ou aux paiements, afin que le Dashboard explique la correction attendue sans analyser le texte de l'erreur. Ces identifiants RFC 9457 restent sous `https://surplasse.com/problems/` dans tous les environnements. Le profil de domaines alimente donc Backend, Commande et Dashboard avec la même base canonique, y compris lorsque l'application tourne sous `surplasse.test`. Le profil public expose seulement `acceptingOrders`, afin que Commande puisse conserver la carte visible et présenter un état fermé sans révéler les détails internes.

La pause ferme trois admissions : création d'une session de table, création d'une commande et création ou reprise d'une session de paiement. Une commande ou un paiement refusé pour cette raison répond en 409 avec le type stable `order-intake-paused`. Une session de table demandée après la pause conserve le 404 indistinguable prévu pour un QR inconnu, une table inactive ou une prise de commandes fermée.

La ligne `establishment` sérialise la frontière. Une admission prend un verrou partagé pendant sa transaction, tandis que la pause prend un verrou exclusif. Une opération admise avant la pause peut terminer. Toute admission linéarisée après le commit de la pause échoue. Un rejeu idempotent d'une commande déjà créée reste un rejeu, pas une nouvelle admission.

Une désactivation plus récente de `charges_enabled` reçue par `account.updated` force `order_intake_status` à `paused`. Le retour ultérieur de la capacité Stripe ne rouvre jamais automatiquement la prise de commandes. La réouverture exige une action explicite et revalide tous les prérequis. Une pause ou une réouverture ne modifie jamais `activated_at`, donc ne redémarre jamais la période de trois mois sans commission Surplasse.

La pause ne modifie aucune commande existante. Les pages de suivi REST, les flux SSE client et Dashboard, la liste et l'avancement des commandes ainsi que le traitement des webhooks Stripe restent actifs. Un Payment Intent dont le `client_secret` a été remis avant la pause peut encore réussir. Son webhook doit être traité normalement, puis la commande doit être servie ou remboursée. Garantir zéro débit après l'instant de pause demanderait une annulation et un rapprochement Stripe dédiés, hors de cette décision.

## Conséquences

### Positives

- Le geste d'exploitation ne modifie plus le cycle de vie de l'établissement.
- La production et les nouveaux établissements échouent de manière sûre tant qu'une ouverture explicite n'a pas eu lieu.
- La carte reste consultable pendant une pause et les commandes engagées conservent leur suivi.
- Le même interrupteur ferme les trois points d'entrée qui pourraient créer une commande non payable.
- Le verrouillage donne une frontière transactionnelle testable entre une admission et une pause concurrentes.
- Une perte de capacité Stripe ferme automatiquement le service sans qu'un retour du fournisseur puisse le rouvrir seul.

### Négatives et dettes assumées

- L'interface doit distinguer le statut demandé, la disponibilité effective et la cause du blocage.
- Une session de paiement déjà livrée peut aboutir après la pause. Le runbook doit rapprocher puis servir ou rembourser ce cas.
- Le contrôle livré est par établissement. Un arrêt global de toute la plateforme reste une capacité différente, non couverte ici.
- L'autorisation actuelle repose sur l'appartenance du restaurateur à l'établissement. Un futur rôle opérateur Surplasse demandera son propre modèle d'identité et ne doit pas être simulé par une clé statique improvisée.
- La preuve logicielle locale ne vaut ni validation Stripe Connect réelle, ni preuve de remboursement. Les portes du pilote restent applicables.

## Références

- [Modèle de données](../architecture/donnees.md)
- [API et contrat](../architecture/api.md)
- [Intégrations Stripe](../architecture/integrations.md#stripe--les-paiements)
- [Pilote de phase 2](../operations/pilote.md)
- [ADR-0017 : charges directes Stripe Connect](adr-0017-charges-directes-stripe-connect.md)
