# AGENTS.md

Lire `../docs/AGENTS.md` avant toute contribution. Ses règles de terminologie, de rédaction et de publication s'appliquent aussi à ce module.

## Source unique

- `../docs/` est l'unique source éditoriale.
- Ne jamais modifier `src/content/docs/`. Cette collection est ignorée par git et reconstruite par `npm run sync`.
- Toute incompatibilité entre la source éditoriale et Nimbus se traite dans `scripts/sync-content.mjs`, avec un test dans `scripts/sync-content.test.mjs`.
- Les composants et styles sous `src/` portent uniquement la présentation Nimbus.

## Environnement

- `NIMBUS_SITE_ORIGIN` et `NIMBUS_BASE_PATH` sont obligatoires.
- À la racine du dépôt, utiliser `npm run docs:build` ou `npm run docs:watch`. Le wrapper charge le profil de domaines `development`.
- Ne jamais ajouter de domaine ou de chemin de repli dans le code.

## Vérification

`npm run docs:build` exécute les tests de l'adaptateur, le contrôle Astro, le build statique puis le lint Nimbus avec la table de routes fraîchement produite.
