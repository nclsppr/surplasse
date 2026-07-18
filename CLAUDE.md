# CLAUDE.md

Surplasse : canal de commande directe pour restaurants indépendants (QR code à table, carte numérique générée par IA depuis une photo, paiement intégré). Phase actuelle : documentation et planification, pas encore de code applicatif.

## Règles

- **Lire `docs/AGENTS.md` avant toute contribution** : terminologie canonique, stack de référence, style, conventions Retype. Ce fichier gagne en cas de contradiction.
- Docs en français, **jamais de cadratin ni demi-cadratin**.
- Workflow git : branche unique `main`, pas de PR, committer et pousser souvent. Messages en français préfixés (`docs:`, `api:`, `backend:`, ...).
- Avant tout push touchant `docs/` : `npm run docs:build` doit passer.
- Les décisions structurantes vont dans `docs/decisions/` (ADR). Une page qui contredit un ADR doit être corrigée.

## Commandes

```bash
npm run docs:build   # build Retype (sortie docs-site/, exclue de git)
npm run docs:watch   # prévisualisation locale
```

Le build invoque `node node_modules/retypeapp/retype.js` directement : npm 10.9+ ne crée pas le lien `.bin/retype` (collision de bins des paquets plateforme retypeapp-*).
