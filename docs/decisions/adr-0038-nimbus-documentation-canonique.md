---
label: "ADR-0038 : Nimbus pour la documentation"
order: 380
icon: law
description: "Nimbus devient l'unique générateur de la documentation Surplasse, publiée sur son domaine dédié et sous /docs sur GitHub Pages."
---

# ADR-0038 : Nimbus comme documentation canonique

## Statut

Accepté, 2026-07-26.

## Contexte

L'[ADR-0009](adr-0009-retype.md) avait retenu Retype pour lancer rapidement une documentation statique. L'[ADR-0034](adr-0034-double-rendu-retype-nimbus.md) a ensuite ajouté un aperçu Nimbus dérivé de la même source `docs/`. Cette expérience a validé la conversion des 76 pages, la navigation, la recherche Pagefind, les sorties Markdown destinées aux agents, les chemins de base et le déploiement statique.

Le double rendu a désormais un coût sans bénéfice proportionné. Il maintient deux moteurs, deux sorties, deux routes et une règle de publication qui continue de traiter le rendu évalué comme une expérience. Retype ajoute aussi une dépendance racine, un build sujet à une erreur Linux intermittente et une étape de nouvelle tentative propre à cet outil.

La documentation doit maintenant avoir une seule identité. Elle doit rester éditée dans `docs/`, être vérifiée localement, être servie à la racine de `docs.surplasse.com` et rester consultable sous `https://nclsppr.github.io/surplasse/docs/`.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Conserver Retype seul | Aucun changement de chaîne canonique | Perd la recherche et les surfaces Markdown de Nimbus, conserve la dépendance et ses incidents de build |
| Conserver le double rendu | Comparaison permanente et repli immédiat | Deux moteurs, deux routes, temps de CI accru et statut canonique ambigu |
| Rendre Nimbus canonique tout en gardant Retype en secours | Retour rapide possible | Le secours continue de coûter à chaque mise à jour et retarde la suppression réelle |
| Remplacer Retype par Nimbus | Une seule chaîne, une seule expérience publiée, recherche et surfaces pour agents intégrées | Dépendance à un projet jeune et maintien temporaire de l'adaptateur de source |

## Décision

Nous retenons Nimbus comme unique générateur et unique rendu de la documentation Surplasse. La version de référence est `@cloudflare/nimbus-docs` 0.8.2.

`docs/` reste la seule source éditoriale. `docs-nimbus/` contient le site Astro, le thème Surplasse et l'adaptateur qui produit la collection Nimbus ignorée par git. Cet adaptateur conserve les chemins des fichiers et le format éditorial déjà présents. Il ne lance pas Retype et ne produit aucune sortie Retype. Les auteurs ne modifient jamais `docs-nimbus/src/content/docs/`.

La commande racine `npm run docs:build` devient la porte unique. Elle exécute les tests de l'adaptateur, le contrôle Astro, le build statique, Pagefind et le lint Nimbus. `npm run docs:watch` lance la prévisualisation Nimbus. La dépendance `retypeapp`, `retype.yml`, le script de nouvelle tentative et la sortie `docs-site/` sont supprimés.

Le même contenu reçoit deux builds statiques adaptés à leur origine :

- le profil Compose utilise l'origine issue de `DOCS_URL` et le chemin de base `/` ;
- GitHub Pages utilise l'origine `https://nclsppr.github.io` et le chemin de base `/surplasse/docs`.

Le profil de domaines dérive `DOCS_URL` sous `docs.APP_BASE_DOMAIN`, soit `docs.surplasse.test` en développement et `docs.surplasse.com` en production. L'image `docs` fait partie du graphe Compose commun et Caddy sert cette origine directement. Le wildcard DNS et le certificat de `*.surplasse.com` couvrent l'hôte public sans zone ni certificat distincts. GitHub Pages conserve la documentation sous `/surplasse/docs/`, à côté des autres démonstrations statiques.

Cette décision complète l'[ADR-0026](adr-0026-compose-commun.md) en faisant entrer `docs` dans le socle commun et le profil de production. Elle étend aussi la politique de l'[ADR-0037](adr-0037-images-conteneurs-durcies.md) à cette cinquième image applicative, construite, scannée et publiée par `images.yml`.

Nimbus devient indexable. Les pages générées ne portent plus `noindex` et `robots.txt` autorise le chemin documentaire. L'ancienne route `/_experiments/nimbus-docs/` n'est plus publiée.

Les ADR-0009 et ADR-0034 sont remplacés par la présente décision.

## Conséquences

### Positives

- Une seule documentation est présentée comme canonique.
- Retype et son incident de build intermittent disparaissent des dépendances, de CI, des images et des routes.
- La recherche Pagefind, `llms.txt`, `llms-full.txt` et les variantes Markdown deviennent des surfaces officielles.
- Le domaine documentaire et GitHub Pages exercent le même moteur et le même contenu.
- `docs/` reste stable comme source unique, sans copie éditoriale.
- Le suivi `nimbus.json` permet de distinguer les composants Nimbus personnalisés des mises à jour amont applicables.

### Négatives et dettes assumées

- Nimbus est jeune. Chaque mise à jour reste verrouillée et passe les tests, le build, le lint et une revue navigateur.
- L'adaptateur de source reste une dette tant que le format historique de `docs/` n'est pas remplacé par un format Nimbus natif.
- Les deux origines publiques exigent deux chemins de base et donc deux builds indépendants.
- `docs.surplasse.com` dépend du wildcard DNS et du déploiement Compose de production.
