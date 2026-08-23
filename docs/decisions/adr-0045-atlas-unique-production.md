---
label: "ADR-0045 : Atlas comme production unique"
order: 450
icon: law
description: "Pourquoi le monorepo conserve Compose pour le développement mais délègue toute production à la release Atlas."
---

# ADR-0045 : Atlas comme unique chemin de production

## Statut

Accepté, 2026-08-23.

Remplace l'[ADR-0026](adr-0026-compose-commun.md). Le contrat de publication OCI et le mode testeurs de l'[ADR-0041](adr-0041-production-testeurs-stripe-test.md) restent applicables.

## Contexte

L'ADR-0026 avait créé un socle Compose commun et une surcharge `compose.production.yaml` exploitable directement depuis le monorepo. Atlas possède désormais le bord Caddy, PostgreSQL, les volumes, les secrets de déploiement et l'observabilité partagés. La release Surplasse fournit son fragment applicatif immuable sous `deployment/vps/compose.yaml`, puis `vps-infra` en contrôle l'admission et l'activation.

Le mode production de `scripts/compose.sh` et sa surcharge ne sont plus consommés par ce chemin. Les conserver crée une seconde recette qui peut diverger sans jamais être exercée sur Atlas.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Conserver les deux chemins de production | Retour possible au déploiement autonome | Deux propriétaires pour Caddy, PostgreSQL, secrets et cycle de vie |
| Réutiliser la surcharge historique sur Atlas | Moins de fichiers applicatifs | Mélange la plateforme partagée et la release produit |
| Garder Compose local et faire d'Atlas l'unique production | Une seule autorité de déploiement, contrat plus petit | Le graphe local ne reproduit pas les services partagés exactement |

## Décision

`compose.yaml` et `compose.development.yaml` décrivent uniquement le cluster local de développement et d'intégration. `scripts/compose.sh` accepte uniquement le profil `development`.

La production consomme exclusivement `deployment/vps/compose.yaml` et les scripts bornés inclus dans l'`application-release`. `vps-infra` fournit le bord public, PostgreSQL, les secrets, les volumes, les sauvegardes et l'observabilité. Le monorepo ne conserve plus `compose.production.yaml`, son modèle d'environnement, son Caddy autonome ni leurs tests dédiés.

Les images restent identiques entre les preuves locales et la release lorsque leur rôle le permet. La parité de production se démontre par les tests du bundle Atlas, la validation du Compose VPS, les digests OCI et les sondes publiques, pas par un second lanceur local portant le nom `production`.

## Conséquences

### Positives

- Atlas devient l'unique propriétaire de l'état de production ;
- les secrets et le bord public ne possèdent plus de contrat concurrent dans le monorepo ;
- les tests ciblent le vrai consommateur de la release ;
- le wrapper local reste court et sans branche morte.

### Négatives

- un déploiement autonome hors Atlas demanderait une nouvelle décision et une nouvelle recette ;
- la preuve locale couvre les services Surplasse, mais pas toute la plateforme partagée ;
- une évolution de l'interface Atlas doit rester coordonnée entre le produit et `vps-infra`.
