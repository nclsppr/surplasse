# CLAUDE.md

Surplasse : canal de commande directe pour restaurants indépendants (QR code à table, carte numérique générée par IA depuis une photo, paiement intégré). Phase actuelle : phase 2 en cours, avec le contrat, le Backend et Commande déjà exécutables.

## Règles

- **Lire `docs/AGENTS.md` avant toute contribution** : terminologie canonique, stack de référence, style, conventions Nimbus. Ce fichier gagne en cas de contradiction.
- Docs en français, **jamais de cadratin ni demi-cadratin**.
- Workflow git : branche unique `main`, pas de PR, committer et pousser souvent. Messages en français préfixés (`docs:`, `api:`, `backend:`, ...).
- Avant tout push touchant `docs/` : `npm run docs:build` doit passer.
- Les décisions structurantes vont dans `docs/decisions/` (ADR). Une page qui contredit un ADR doit être corrigée.
- Tout ajout de module, package ou logiciel tiers documente dans le même commit sa version, son installation, sa configuration, son lancement et sa vérification sur macOS, Windows (WSL2) et Linux. Il indique explicitement s'il relève du développement seulement, du build ou de la CI, ou de la production. Un service de production documente aussi son déploiement et son exploitation sous Ubuntu LTS. Les références vivent dans `docs/developpement/index.md` et `docs/operations/` ; Ubuntu fait foi.

## Commandes

```bash
npm run docs:build   # tests, contrôle Astro, build et lint Nimbus
npm run docs:watch   # prévisualisation Nimbus locale
```
