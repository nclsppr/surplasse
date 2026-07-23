---
label: "ADR-0034 : double rendu Retype et Nimbus"
order: 340
icon: law
description: "Un adaptateur de build produit un aperçu Nimbus depuis les sources Retype canoniques, sans dupliquer la documentation."
---

# ADR-0034 : double rendu Retype et Nimbus à source unique

## Statut

Accepté, 2026-07-23.

## Contexte

L'[ADR-0009](adr-0009-retype.md) fait de Retype le générateur canonique de la documentation Surplasse. Les sources vivent dans `docs/`, avec un front matter Retype, des fichiers `index.yml`, des liens vers des fichiers `.md` et quelques callouts. Ce contenu représente déjà plusieurs dizaines de pages produit, techniques et opérationnelles.

Nimbus propose un second rendu statique fondé sur Astro. Il accepte Markdown et MDX, génère sa navigation depuis le système de fichiers et expose des surfaces utiles aux lecteurs comme aux agents. Son projet reste jeune et son schéma de contenu diffère de celui de Retype. Une comparaison réelle est utile, mais elle ne doit créer ni seconde arborescence éditoriale, ni dérive entre deux copies d'une même décision.

Les différences ne permettent pas une réutilisation directe sans adaptation. Nimbus exige un titre dans son front matter, Retype utilise `label` et `order` à la racine, les index de section ne suivent pas le même format et les syntaxes de callout diffèrent. Un lien symbolique vers `docs/` déplacerait ces incompatibilités au moment du rendu sans les résoudre.

La question est donc la suivante : comment obtenir les deux documentations depuis les mêmes fichiers Markdown, tout en gardant Retype stable et en rendant l'expérience Nimbus isolée, vérifiable et supprimable ?

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Migrer immédiatement de Retype vers Nimbus | Une seule chaîne de rendu à terme | Remet en cause ADR-0009 avant d'avoir comparé le résultat réel, risque sur la publication canonique |
| Copier `docs/` dans un espace Nimbus et modifier les deux copies | Mise en place simple au début | Deux sources éditoriales, dérive inévitable, corrections et ADR à reporter deux fois |
| Lier directement `docs/` dans la collection Nimbus | Aucun fichier copié manuellement | Front matter, index de section, liens et composants incompatibles, comportement dépendant des liens symboliques en CI |
| Générer une collection Nimbus dérivée pendant le build | Une seule source, adaptation explicite et testable, suppression simple | Adaptateur à maintenir, fonctions Retype nouvelles à prendre en charge avant leur utilisation |

## Décision

Nous retenons une collection Nimbus générée pendant le build à partir de la source unique `docs/`.

Retype reste le rendu canonique et continue de lire directement `docs/`. Le projet `docs-nimbus/` contient uniquement le moteur Nimbus, les composants de présentation et l'adaptateur `scripts/sync-content.mjs`. La collection produite sous `docs-nimbus/src/content/docs/` est ignorée par git. Elle est supprimée puis reconstruite avant chaque vérification ou build Nimbus.

L'adaptateur applique une frontière explicite :

- il exclut `docs/AGENTS.md`, comme Retype ;
- il transforme le premier titre de niveau 1 en `title` Nimbus et conserve `label`, `order` et `description` sous la forme attendue par Nimbus ;
- il convertit les callouts Retype actuellement utilisés vers les directives Nimbus ;
- il traduit les liens internes terminés par `.md` vers les routes statiques Nimbus ;
- il crée un index synthétique lorsqu'un dossier possède seulement un `index.yml` ;
- il marque tout l'aperçu `noindex` pour éviter de concurrencer la documentation canonique ;
- il échoue sur un document mal formé ou un callout non pris en charge.

Les tests de l'adaptateur couvrent le front matter, les titres, les liens, les callouts et les marqueurs présents dans les blocs de code. Toute nouvelle syntaxe propre à Retype doit être ajoutée à l'adaptateur avec un test avant d'être utilisée dans `docs/`. Les auteurs ne modifient jamais la collection Nimbus générée.

L'aperçu est publié sous `/_experiments/nimbus-docs/`. En développement, Caddy le sert sur le domaine documentaire dérivé du profil. Sur GitHub Pages, il est assemblé à côté du site Retype. Retype reste sous `/docs/`. Nimbus est absent du profil Compose production et du futur VPS.

La version de `@cloudflare/nimbus-docs` est verrouillée dans `docs-nimbus/package-lock.json`. Une mise à jour est explicite et doit faire passer les tests de conversion, le contrôle Astro, le build Retype, le build Nimbus et une revue navigateur des deux rendus.

```
                         source éditoriale
                              docs/
                                |
                 +--------------+--------------+
                 |                             |
                 v                             v
             Retype                  adaptateur de build
                 |                             |
                 v                             v
          docs-site/              collection Nimbus ignorée
                                               |
                                               v
                                      docs-nimbus/dist/
```

## Conséquences

### Positives

- Les décisions, parcours et runbooks ne sont écrits et relus qu'une fois.
- Retype garde sa chaîne canonique et son URL publique actuelle.
- La comparaison Nimbus porte sur la documentation réelle, pas sur un échantillon artificiel.
- Les incompatibilités de format sont concentrées dans un seul adaptateur testé.
- La sortie Nimbus reste statique, sans donnée, volume ni processus permanent.
- L'expérience se retire en supprimant `docs-nimbus/`, sa route locale, ses commandes et son étape Pages. Aucun contenu éditorial ne doit être migré en retour.

### Négatives et dettes assumées

- Deux moteurs et deux verrous npm doivent être entretenus pendant l'expérience.
- Le build Pages et l'image documentaire de développement durent plus longtemps.
- L'adaptateur ne prend en charge que le sous-ensemble Retype réellement utilisé. Un nouveau composant Retype crée un travail de conversion.
- La date Git de la copie générée n'est pas fiable. Nimbus n'affiche donc une date de mise à jour que si le front matter source en déclare une.
- Le support d'un chemin de base a nécessité des adaptations dans les fichiers de présentation Nimbus visibles dans le dépôt. Une mise à jour du framework devra contrôler ces écarts.
- L'aperçu public est volontairement non indexé et n'est pas une preuve de remplacement de Retype. Une migration éventuelle demandera un nouvel ADR qui remplace explicitement ADR-0009.
