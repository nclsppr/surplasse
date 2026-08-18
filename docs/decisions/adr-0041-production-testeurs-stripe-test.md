---
label: "ADR-0041 : Production testeurs avec Stripe test"
order: 410
icon: law
description: "Pourquoi Surplasse ouvre une production réservée aux testeurs avec des commandes persistées et Stripe en mode test avant son ouverture publique."
---

# ADR-0041 : production testeurs avec Stripe test

## Statut

Accepté, 2026-08-18.

Remplace l'[ADR-0040](adr-0040-publication-oci-applicative-pour-atlas.md). Son contrat de publication OCI et d'admission immuable reste inchangé. Cette décision remplace son exigence implicite d'une configuration Stripe live pour toute publication de production.

## Contexte

Atlas est disponible et le domaine `surplasse.com` peut recevoir le produit. Les portes prévues pour une ouverture à des restaurants inconnus ne sont pas toutes franchies. Stripe Connect live, les sauvegardes hors site, la supervision externe et plusieurs répétitions d'exploitation restent incomplètes.

La première audience est limitée au propriétaire du produit et à des testeurs nommés. Ils doivent pouvoir exercer le vrai Backend, la vraie base PostgreSQL, les commandes, le Dashboard et les routes de production. Aucun paiement réel ne doit être possible pendant cette phase. Attendre toutes les garanties de l'ouverture publique empêcherait de tester l'exploitation réelle. Utiliser Stripe live malgré les portes ouvertes exposerait inutilement des fonds.

Le domaine reste accessible sur Internet. Une audience déclarée « testeurs » et une bannière ne constituent pas un contrôle d'accès. Toute donnée saisie doit donc rester une donnée de test, sans dépendre de l'hypothèse qu'aucun tiers ne visitera le domaine.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Attendre toutes les portes de l'ouverture publique | Risque opérationnel minimal | Aucun retour sur le déploiement et les parcours réels avant la fin des travaux d'exploitation |
| Ouvrir immédiatement avec Stripe live | Test identique à la cible commerciale | Débits réels possibles malgré des capacités Connect, remboursements, alertes et sauvegardes encore incomplets |
| **Ouvrir une production testeurs avec Stripe test** | Exerce les commandes persistées et l'exploitation Atlas sans mouvement de fonds réel | Environnement hybride à rendre visible ; données de test stockées en production ; dette opérationnelle explicitement acceptée |

## Décision

Nous retenons une production réservée aux testeurs avec Stripe en mode test.

Le fichier public et versionné `config/deployment/production-release.env` porte `SURPLASSE_PRODUCTION_RELEASE_MODE=testers`. Cette valeur pilote ensemble les invariants suivants :

- le workflow `Container images` exige une vraie clé publiable `pk_test_` dans la variable de dépôt `VITE_STRIPE_PUBLISHABLE_KEY` et refuse une clé `pk_live_` ;
- son SHA-256 est figé par le premier job, puis la valeur exacte est vérifiée dans l'image Commande scannée et dans le digest publié ;
- le bundle Atlas fixe `STRIPE_LIVE_MODE=false` et le secret du Backend doit être une clé Stripe test, de préférence une clé restreinte `rk_test_` ;
- les secrets des destinations webhook appartiennent au même environnement Stripe test ;
- Onboarding, Commande et Dashboard affichent une bannière non masquable qui réserve l'usage aux commandes et données de test et précise que Stripe ne débite aucune carte bancaire réelle.

Les commandes, sessions, événements et états métier sont de vraies écritures dans PostgreSQL sur Atlas. Seul le traitement externe Stripe reste en mode test. Les sauvegardes locales du VPS sont acceptées pour cette phase et ne bloquent pas le déploiement. Aucune donnée de client réel, aucun moyen de paiement réel et aucun engagement de continuité ne sont admis.

La future valeur `SURPLASSE_PRODUCTION_RELEASE_MODE=public` est fail-closed. Elle exige une clé `pk_live_`, un Backend en mode live et la disparition de la bannière dans la même révision. Le changement doit rester atomique dans le fichier versionné, le bundle Atlas, les contrôles CI et la documentation. Une variable GitHub ou un secret Atlas ne peut pas changer seul le mode publié.

Avant toute ouverture publique, le rappel opérateur doit citer au minimum les dettes suivantes :

- sauvegarde hors site chiffrée et restauration prouvée ;
- compte Stripe Connect live encaissable, clé restreinte, webhooks, remboursement et domaine de paiement qualifiés ;
- SMTP transactionnel et parcours de magic link vérifiés ;
- sonde externe, canal d'alerte et procédure d'incident exercés ;
- retour arrière ou reprise vers l'avant après migration vérifiés ;
- données pilote, obligations RGPD et conditions d'exploitation revues pour de vrais restaurateurs et clients.

## Conséquences

### Positives

- Atlas, le DNS et les parcours complets peuvent être testés sans mouvement de fonds réel.
- Le mode de paiement ne dépend pas d'une convention cachée dans les secrets.
- La bannière donne la même information aux restaurateurs, aux clients testeurs et aux opérateurs.
- Le futur passage public reste bloqué si une clé ou un composant conserve le mauvais mode.

### Négatives et dettes assumées

- La production contient des données de test qui devront être identifiées, conservées ou purgées par une procédure explicite avant le public.
- Les sauvegardes locales partagent le risque de perte du VPS. Cette dette est acceptée uniquement tant qu'aucun client réel n'est accueilli.
- La bannière informe mais ne limite pas l'accès au domaine.
- Les commandes testeurs peuvent révéler des incidents que la sauvegarde locale ou l'absence d'alerte ne permet pas de traiter avec un objectif de service commercial.
- Chaque échange sur une ouverture plus large doit rappeler explicitement les dettes listées dans cette décision.
