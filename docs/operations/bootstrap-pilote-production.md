---
label: Bootstrap du pilote
order: 34
icon: terminal
description: "Le manifeste, les contrôles et la séquence one-shot qui créent le premier graphe testeurs sur Atlas sans seed ni SQL opérateur."
---

# Bootstrap du pilote de production

Cette procédure crée le premier graphe métier de la production testeurs. Elle est réservée à Atlas, à une base Flyway V14 vide et à Stripe test. Elle ne crée aucune donnée client réelle, n'ouvre pas la prise de commandes et ne remplace pas l'embarquement produit.

!!! danger Pas de raccourci
Ne jamais lancer le seed de développement, écrire directement en base, injecter un secret dans une variable ou exposer cette commande comme endpoint. Le contrôleur borné de `vps-infra` est le seul chemin opérateur autorisé.
!!!

## Contrat livré

Le bundle OCI contient les éléments suivants :

| Élément | Contrat exact |
|---|---|
| Service Compose | `pilot-bootstrap`, profil `pilot-bootstrap`, `restart: "no"`, même image que `backend` |
| Runner | `/opt/surplasse/scripts/backend-pilot-bootstrap.sh` |
| Opérations | `status` ou `apply`, un seul argument |
| Manifeste hôte | `/etc/vps/applications/surplasse-pilot-bootstrap.json` |
| Manifeste conteneur | `/run/surplasse/pilot-bootstrap.json`, lecture seule |
| Métadonnées | fichier régulier, lien unique, `root:10001`, mode `0440`, 16 Kio au maximum, fin de ligne LF |
| Schéma | `pilot-bootstrap.schema.json`, contrat `surplasse.pilot-bootstrap`, version 1, mode `testers` |
| Secrets montés | mot de passe du rôle `surplasse_runtime` et clé Stripe restreinte test |
| Réseaux | `db_surplasse` pour PostgreSQL et `app_surplasse` comme route de sortie Stripe |
| Base | historique Flyway exactement V1 à V14 |
| État initial | établissement `active`, carte publiée, produit disponible, table active, prise de commandes `paused` |

Le runner et la classe Java refusent indépendamment un profil autre que `production`, un mode autre que `testers`, `STRIPE_LIVE_MODE` différent de `false`, une URL ou un rôle PostgreSQL différent, un chemin de fichier différent ou une valeur secrète injectée directement.

## Préparer le manifeste

Le manifeste contient exactement les champs déclarés par `deployment/vps/pilot-bootstrap.schema.json` :

| Objet | Valeurs à décider une seule fois |
|---|---|
| Racine | `contract`, `schema=1`, `mode=testers` |
| `restaurateur` | UUID v4 stable, email en minuscules, nom complet, téléphone E.164 ou `null` |
| `establishment` | UUID v4 stable, nom, slug non réservé, adresse, identifiant du compte Stripe test |
| `menu` | UUID v4 stable et nom de la carte |
| `category` | UUID v4 stable et nom de la catégorie |
| `product` | UUID v4 stable, nom, description ou `null`, prix positif en centimes, `currency=eur` |
| `table` | UUID v4 stable et libellé |

Les six UUID sont distincts et restent identiques à chaque lecture. Ils ne sont pas secrets. Le code QR n'est pas une entrée : `apply` le génère une seule fois à partir de 128 bits aléatoires et ne l'affiche jamais.

Le manifeste porte des données personnelles et reste hors de Git. Sa création, sa validation contre le schéma signé et sa matérialisation atomique appartiennent à `vps-infra`. Aucun exemple de clé Stripe ou de mot de passe ne doit être ajouté pour compléter le JSON.

## Préparer Stripe

Le compte du manifeste est un compte Accounts v2 en mode test. Le bootstrap effectue seulement une lecture de ce compte avec l'inclusion `configuration.merchant`. Il exige :

- l'identifiant exact du manifeste ;
- `livemode=false` ;
- un compte non fermé ;
- `configuration.merchant.capabilities.card_payments.status=active`.

La capacité de virement est enregistrée selon le résultat Stripe, mais elle ne remplace pas la porte `card_payments`. Une restriction, une limite de débit, une erreur réseau ou un compte différent arrête l'opération avant la connexion d'écriture à PostgreSQL.

La clé montée est la clé restreinte test déjà exigée par le Backend. Pour le seul bootstrap, sa permission supplémentaire minimale est la lecture des comptes Core par Accounts v2. Le runtime de paiement peut exiger d'autres permissions décrites par son propre contrat. Une clé live est toujours refusée.

## Séquence bornée sur Atlas

1. Admettre une release dont le contrat déclare `pilot-bootstrap` et dont l'image est liée au digest Backend exact.
2. Matérialiser le manifeste validé avec les métadonnées exactes. Ne pas modifier les neuf secrets applicatifs existants pendant cette étape.
3. Appliquer les migrations au moyen du job `migrator`, puis prouver l'historique V1 à V14.
4. Invoquer `status`. Le code 3 signifie que le schéma exact est vide. Tout autre code non nul arrête la procédure.
5. Invoquer `apply` une seule fois. Le contrôleur utilise la forme interne suivante depuis la release admise :

```bash
docker compose --project-name surplasse --file compose.yaml \
  --profile pilot-bootstrap run --rm --no-deps pilot-bootstrap apply
```

6. Invoquer immédiatement `status` avec la même forme et l'argument `status`.
7. Vérifier par l'API métier que l'établissement, la carte et la table attendus sont lisibles et que `orderIntakeStatus=paused`.
8. Ouvrir ensuite la prise de commandes par l'action Dashboard authentifiée, puis relire l'état et exercer les refus ou parcours prévus par le [pilote de phase 2](pilote.md).

Le contrôleur ne transmet aucun autre argument, n'ajoute pas `--service-ports`, ne monte pas le socket Docker dans le conteneur et ne relance pas le job. Le service ne publie aucun port. Le réseau `app_surplasse` est nécessaire à Stripe et possède explicitement la priorité de passerelle ; `db_surplasse` reste interne.

## Résultats et codes de sortie

| Code | Sens | Réaction |
|---|---|---|
| 0 | graphe créé, déjà exact ou relu exact | Continuer selon la séquence |
| 3 | `status` sur base métier vide avec V14 exact | Autorise le premier `apply` |
| 64 | configuration, manifeste, métadonnées ou format de secret refusé | Corriger l'entrée hors du conteneur |
| 65 | version, cardinalité ou valeur persistée divergente | Arrêter, conserver les preuves, ne pas corriger par SQL |
| 69 | compte Stripe test non lisible ou non encaissable | Laisser `paused`, terminer l'embarquement Stripe ou rétablir le réseau |
| 70 | opération PostgreSQL bornée échouée | Vérifier la base et les journaux de plateforme sans afficher les entrées |

La sortie ne contient qu'un résultat générique. Elle ne doit contenir ni email, ni identifiant Stripe, ni UUID, ni code de table, ni secret. Une stack trace ou le message brut du SDK Stripe est volontairement supprimé.

## Idempotence, échec et reprise

`apply` prend un verrou transactionnel, relit l'ensemble des tables V14 et accepte seulement deux états : aucune ligne métier, ou le graphe exact avec toutes les autres tables vides. Les six insertions et leur vérification finale appartiennent à la même transaction sérialisable. Un échec annule tout.

Une nouvelle exécution avec le manifeste identique ne change ni `activated_at`, ni horodatage, ni code de table. Une divergence échoue sans `delete`, `update` ni `upsert`. Le bootstrap n'est plus un outil de contrôle après une modification métier volontaire, notamment après le passage à `open`. À partir de là, utiliser les lectures et actions authentifiées du Backend.

Le repli ne supprime aucune donnée. Il fixe la prise de commandes à `paused`, désactive le canal concerné si nécessaire et conserve les preuves. Toute purge avant une future ouverture publique fera l'objet d'une opération distincte, revue et sauvegardée.

## Portée par système

Ubuntu LTS sur Atlas fait foi pour l'exécution. macOS, Windows avec WSL2 et Linux de développement servent uniquement à compiler, exécuter les tests PostgreSQL 17, valider Compose et construire l'image. Ils ne reçoivent aucun manifeste de production et ne lancent pas `apply` contre Atlas.

Le bootstrap n'utilise ni SMTP, ni stockage objet, ni données média. Leur absence n'empêche pas la création du graphe testeurs. Elle reste toutefois une dette à rappeler avant toute ouverture publique, avec la sauvegarde hors site, les alertes et les preuves Stripe live listées par l'ADR-0041.
