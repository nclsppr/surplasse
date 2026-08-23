---
label: "ADR-0046 : CLI et rapports E2E plats"
order: 460
icon: law
description: "Pourquoi les commandes natives remplacent le cockpit local et pourquoi chaque cible E2E conserve un rapport courant sans publications imbriquées."
---

# ADR-0046 : CLI native et rapports E2E plats

## Statut

Accepté, 2026-08-23.

Remplace l'[ADR-0027](adr-0027-playwright-allure-3.md) et l'[ADR-0028](adr-0028-cockpit-compose-et-rapports-allure.md). Playwright, Allure 3, les cibles explicites et les smokes sans effet métier restent applicables.

## Contexte

Le cockpit local enveloppe des commandes déjà exposées par les scripts npm et Docker Compose. Son serveur, son interface, son registre, son contrôleur et leurs tests ajoutent plusieurs milliers de lignes sans créer une capacité nécessaire à la production.

La publication E2E locale utilise en plus des dossiers immuables, un verrou, un pointeur `current.json`, des synchronisations disque, une migration et une rétention personnalisée. GitHub Actions sérialise déjà les exécutions par cible et conserve chaque lancement comme artefact. Le besoin durable propre à Allure est un historique JSONL isolé par cible.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Conserver cockpit et publications immuables | Interface locale et bascule atomique | Deux couches d'orchestration et un stockage complexe |
| Garder le cockpit, simplifier seulement les rapports | Moins de migration | L'interface continue de doubler les commandes CLI |
| Utiliser les commandes natives et un rapport courant plat | Moins de code, mêmes capacités vérifiables | Pas d'interface web locale de pilotage |

## Décision

Le développement utilise directement `npm run local:up`, `local:ps`, `local:logs`, `local:stop` et `local:down`. Les tests utilisent `npm run e2e:test -- <cible>`. Le serveur Node allowlisté de l'Onboarding reste un composant distinct de son image, mais le cockpit, ses routes `local` et `reports`, son jeton et ses commandes disparaissent.

Chaque cible E2E conserve sous `.surplasse/e2e/{history-id}/` un `history.jsonl` borné, un rapport Allure courant sous `allure-report/` et les diagnostics Playwright courants sous `test-results/`. Une exécution génère dans un répertoire temporaire, puis remplace ces deux dossiers après génération complète. Les commandes d'ouverture et d'export lisent directement le rapport. Elles ne résolvent plus de pointeur ni de dossier `releases`.

GitHub Actions met en cache uniquement `history.jsonl`. Chaque exécution charge son rapport, son historique et `test-results/` comme artefact propre au lancement. Les résultats Allure intermédiaires restent dans le répertoire temporaire d'exécution et disparaissent après la génération du rapport. Le workflow Pages exporte le rapport development courant sous `/local-tests/`. Les cibles restent séparées et la concurrence distante reste sérialisée par cible.

Les noms `local` et `reports` restent réservés pour ne pas devenir des slugs d'établissement. En l'absence de service, le bord local les ferme comme les autres noms techniques réservés.

## Conséquences

### Positives

- les commandes documentées correspondent directement aux outils exécutés ;
- le retrait du cockpit supprime une surface HTTP locale et son jeton ;
- l'historique Allure reste isolé sans gestionnaire de publications ;
- les artefacts CI conservent les preuves propres à chaque lancement.

### Négatives

- le pilotage local se fait dans le terminal ;
- un rapport local doit être ouvert ou exporté par commande ;
- deux exécutions locales simultanées de la même cible ne sont pas prises en charge ;
- le rapport courant local remplace le précédent, tandis que les exécutions CI restent archivées par GitHub Actions.
