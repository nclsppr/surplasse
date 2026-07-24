---
label: "ADR-0036 : Renovate pour les mises à jour"
order: 360
icon: law
description: "Pourquoi Surplasse confie les propositions de mises à jour à l'application Renovate hébergée, avec des PR limitées et sans automerge."
---

# ADR-0036 : Renovate pour les mises à jour

## Statut

Accepté, 2026-07-25.

## Contexte

Le monorepo épingle ses dépendances npm, Maven, GitHub Actions, outils de génération, runtimes de développement et images de conteneurs. Les images de base portent un tag lisible et un digest immuable dans `config/deployment/images.env`. Cette discipline rend les builds reproductibles, mais multiplie les sources à surveiller manuellement.

Surplasse suit la version stable courante de Quarkus et doit qualifier rapidement chaque nouveau train. Les correctifs de Node, Java, Python, PostgreSQL, Caddy, Stripe, des actions GitHub et des images de base doivent aussi entrer régulièrement sans devenir de grandes campagnes risquées. Une veille manuelle dépend trop de la mémoire du seul développeur et favorise les mises à jour tardives par gros lots.

Le travail humain reste volontairement direct sur la branche `main`, sans branche de fonctionnalité ni revue asynchrone. Un bot de dépendances a toutefois besoin de branches isolées pour proposer un diff, déclencher la CI et laisser le mainteneur accepter ou refuser chaque lot avant qu'il ne touche `main`. Cette exception doit rester bornée et ne jamais ouvrir une seconde voie de déploiement.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Continuer les mises à jour manuelles | Aucun bot ni permission externe ; contrôle total | Veille récurrente ; oublis probables ; gros lots plus difficiles à qualifier |
| Utiliser Dependabot pour les mises à jour | Intégration GitHub directe ; configuration simple | Personnalisation et regroupement moins adaptés aux fichiers arbitraires et au catalogue tag plus digest |
| Auto-héberger Renovate | Contrôle complet de l'exécution et des permissions | Service, secrets, mises à jour et surveillance supplémentaires à exploiter pour un projet solo |
| **Utiliser l'application GitHub Renovate hébergée** | Large couverture de gestionnaires ; règles de regroupement ; Dependency Dashboard ; aucun service à maintenir | Application tierce autorisée à écrire des branches, issues et PR ; métadonnées de dépendances traitées hors du dépôt |

## Décision

Nous retenons l'**application GitHub Renovate hébergée par Mend**, installée uniquement sur le dépôt Surplasse. La configuration canonique vit dans `renovate.json5`. Aucune instance Renovate, aucun jeton de bot permanent et aucun planificateur supplémentaire ne tournent sur le poste ou le VPS.

Renovate couvre les sources suivantes :

| Source | Mécanisme |
|---|---|
| Dépendances et verrous npm | Gestionnaire npm natif |
| BOM, plugins et dépendances Maven | Gestionnaire Maven natif |
| Maven Wrapper | Gestionnaire Maven Wrapper natif |
| GitHub Actions | Gestionnaire GitHub Actions, avec actions épinglées par digest |
| Node et Python dans `mise.toml` | Gestionnaire mise natif |
| Java Temurin dans `mise.toml` | Gestionnaire regex qui préserve le préfixe de distribution `temurin-` |
| Images de `config/deployment/images.env` | Gestionnaire regex, tag et digest remplacés ensemble |
| OpenAPI Generator dans `openapitools.json` | Gestionnaire regex avec source Maven |
| oasdiff dans `scripts/api/oasdiff.sh` | Gestionnaire regex avec releases GitHub |

Les exécutions planifiées ont lieu le lundi entre 00 h et 05 h dans le fuseau `Europe/Paris`. Renovate maintient un Dependency Dashboard, limite le dépôt à trois branches et trois PR simultanées et ne crée pas plus de deux PR par heure. Les alertes de vulnérabilité GitHub sont explicitement activées et font exception : Renovate tente immédiatement leur correction sans appliquer cette fenêtre ni ces quotas. Elles restent soumises à la CI et à la fusion manuelle. Les patchs et mineures npm sont groupés ensemble. Les patchs et mineures Maven et Maven Wrapper forment un autre groupe. Les patchs, mineures et digests GitHub Actions forment un troisième groupe. Les images Docker restent qualifiables individuellement.

Toute version majeure exige une approbation dans le Dependency Dashboard avant création de sa PR. La même approbation explicite s'applique aux mises à jour coordonnées ou sensibles de Node, Java, Caddy, PostgreSQL, Temurin, Quarkus, Stripe et OpenAPI Generator. Le délai de sécurité recommandé pour les nouvelles versions npm est appliqué afin de ne pas adopter immédiatement un paquet qui pourrait encore être retiré du registre.

L'automerge est désactivé pour toutes les dépendances. Le mainteneur lit les notes de version utiles, attend une CI verte, complète si nécessaire les preuves propres au composant, puis fusionne manuellement. Une mise à jour de `mise.toml` doit aussi fournir un `mise.lock` cohérent. Si l'application hébergée ne peut pas régénérer ce lockfile, le mainteneur exécute `mise lock` et ajoute le résultat à la branche du bot avant fusion.

Les branches et PR créées par Renovate constituent l'unique exception au workflow humain direct sur `main`. Elles sont éphémères et ne servent jamais au développement de fonctionnalités. Les workflows de validation écoutent les PR vers `main` avec des permissions de lecture. La publication GitHub Pages, la future publication des images et le déploiement restent réservés à un SHA fusionné sur `main`.

## Conséquences

### Positives

- Le dépôt reçoit des propositions régulières sans calendrier manuel à entretenir.
- Les diffs restent petits, regroupés par risque et vérifiés avant d'atteindre `main`.
- Les tags et digests Docker évoluent atomiquement et conservent l'immutabilité des builds.
- Les dépendances de tous les écosystèmes du monorepo partagent une politique visible dans un seul fichier.
- L'application hébergée évite d'exploiter un service Renovate et de conserver son jeton.

### Négatives et dettes assumées

- Renovate reçoit les permissions nécessaires pour lire le dépôt, créer des branches, modifier les workflows et gérer issues et PR.
- Le workflow git possède désormais une exception bot qui doit rester strictement limitée à Renovate.
- Les regroupements peuvent masquer la dépendance responsable d'une régression et demander une séparation manuelle du lot.
- Les versions majeures et les composants sensibles exigent toujours une lecture et une qualification humaines.
- La régénération de `mise.lock` peut demander une intervention sur la branche du bot selon les capacités de l'application hébergée.
- Renovate traite la fraîcheur des dépendances, pas les vulnérabilités du code applicatif ni l'exploitation du VPS.

## Références

- [Installer et activer Renovate](https://docs.renovatebot.com/getting-started/installing-onboarding/)
- [Renovate sur GitHub](https://docs.renovatebot.com/modules/platform/github/)
- [Options de configuration Renovate](https://docs.renovatebot.com/configuration-options/)
- [Gestionnaires Renovate](https://docs.renovatebot.com/modules/manager/)
- [Gestionnaire mise](https://docs.renovatebot.com/modules/manager/mise/)
- [Gestionnaire regex](https://docs.renovatebot.com/modules/manager/regex/)
- [Tags et digests Docker](https://docs.renovatebot.com/docker/)
