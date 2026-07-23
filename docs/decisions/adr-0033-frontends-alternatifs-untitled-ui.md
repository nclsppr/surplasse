---
label: "ADR-0033 : frontends alternatifs Untitled UI"
order: 330
icon: law
description: "Une seconde implémentation expérimentale de chaque frontend explore Untitled UI sans modifier les applications canoniques ni leur déploiement en production."
---

# ADR-0033 : frontends alternatifs avec Untitled UI

## Statut

Accepté, 2026-07-23.

## Contexte

Surplasse dispose de trois interfaces aux rôles distincts : Onboarding, Commande et Dashboard. Leur architecture séparée, leur contrat commun et leurs budgets de performance sont fixés par l'[ADR-0004](adr-0004-trois-frontends-react.md). Leur design system actuel reste la référence des applications canoniques et de la production.

L'équipe veut pouvoir comparer cette direction à une seconde proposition complète, exécutée sur le même Backend et les mêmes données. Une simple maquette ne permettrait pas d'évaluer les états réels, l'accessibilité, la densité opérationnelle, le comportement mobile ni le coût du bundle. Modifier les applications existantes en place rendrait au contraire la comparaison difficile et augmenterait le coût d'un arrêt de l'expérience.

[Untitled UI React](https://github.com/untitleduico/react) fournit une base publique de composants React orientés accessibilité. Son code public est distribué sous licence MIT. Untitled UI propose aussi des ressources PRO sous une licence distincte. L'expérience doit rester reproductible depuis le dépôt public, sans dépendre d'un accès commercial implicite.

La question est donc la suivante : comment essayer un nouveau système cohérent sur les trois interfaces, avec de vraies intégrations, tout en gardant les applications actuelles intactes et seules candidates à la production ?

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Remplacer progressivement le design system actuel dans les applications canoniques | Une seule implémentation à maintenir | Comparaison avant et après imprécise, risque de régression, retour arrière transversal |
| Construire trois implémentations parallèles et un package visuel isolé | Comparaison simultanée, arrêt simple, dépendances et mesures séparées | Quatre packages supplémentaires, parité à maintenir pendant l'expérience |
| Produire seulement des maquettes statiques | Exploration rapide et peu coûteuse | Aucun test des données réelles, des erreurs, du clavier, du mobile ou du poids livré |
| Développer l'expérience sur une branche longue | Arbre principal plus petit pendant l'essai | Dérive rapide du contrat et de la logique partagée, comparaison et intégration tardives |

## Décision

Nous retenons une **expérience parallèle dont les parcours reliés au Backend sont limités au développement**, complétée par des démonstrations visuelles statiques sur GitHub Pages, composée de quatre packages :

```text
frontends/
|-- design-system2/   composants, tokens et assets de l'expérience
|-- onboarding2/      alternative expérimentale de l'Onboarding
|-- commande2/        alternative expérimentale de Commande
`-- dashboard2/       alternative expérimentale du Dashboard
```

Les applications `frontends/onboarding/`, `frontends/commande/` et `frontends/dashboard/` restent les implémentations canoniques. Elles seules alimentent les routes produit `.com` et les images destinées au VPS. Les suffixes `2` identifient une variante d'interface, pas une nouvelle application métier, une nouvelle API ou une version de données. La publication Pages décrite plus bas reste une preuve visuelle, pas une seconde production produit.

La première tranche n'acquiert pas la même parité sur les trois surfaces. Commande2 et Dashboard2 couvrent les parcours Backend de leurs applications canoniques. Onboarding2 couvre la vitrine, l'aperçu interactif du service et une présentation du parcours de création. Sa route `/creer` remet explicitement la main au tunnel original et la route Connect n'est pas dupliquée. Cette limite vaut aussi en développement. Onboarding2 ne peut donc pas être présenté comme une alternative fonctionnelle complète tant que ces parcours ne sont pas implémentés avec le système expérimental.

### Frontières de code

Chaque parcours expérimental relié au Backend consomme le même contrat OpenAPI, le même Backend et, lorsque nécessaire, les briques non visuelles de `frontends/shared/` : client généré, clés TanStack Query et utilitaires. Il ne redéfinit pas un type d'API et ne contourne pas le client généré. Dans la première tranche, cette règle s'applique aux parcours couverts par Commande2 et Dashboard2. Le transfert explicite d'Onboarding2 vers l'Onboarding original ne constitue pas une intégration Backend de la variante.

La couche visuelle de l'expérience vient exclusivement de `frontends/design-system2/`. Une variante n'importe jamais un composant de son application canonique. Une application canonique n'importe jamais `design-system2` ni une variante. `design-system2` reste un package source privé, sans processus autonome, consommé par dépendance locale `file:`.

Cette décision crée une exception strictement limitée à l'expérience par rapport à l'[ADR-0012](adr-0012-tailwind-shadcn.md). L'association Tailwind et shadcn/ui reste la décision des frontends canoniques. Dans le périmètre `*2`, les comportements interactifs reposent sur React Aria, les styles sur Tailwind CSS 4 et les icônes sur Lucide. Radix et shadcn/ui n'y sont pas ajoutés.

### Source Untitled UI et licences

La référence initiale est le dépôt public Untitled UI React au commit [`eaee6a5b9798fa6867b4d896c6cfecf6ce706a73`](https://github.com/untitleduico/react/tree/eaee6a5b9798fa6867b4d896c6cfecf6ce706a73).

Seuls les composants publics nécessaires sont adaptés. Le dépôt conserve la licence MIT correspondante, le commit source et un inventaire des adaptations. Aucun composant, template, asset ou exemple Untitled UI PRO n'entre dans le monorepo. Les icônes sont fournies par Lucide plutôt que copiées depuis une distribution d'icônes Untitled UI, afin de garder une provenance et une redistribution explicites.

Une mise à jour amont n'est jamais automatique. Elle passe par une revue du diff, des licences, de l'accessibilité, du poids et des adaptations Surplasse avant de changer le commit de référence.

### Système de tokens

Le nouveau système suit trois niveaux obligatoires :

1. les tokens primitifs décrivent les valeurs brutes, par exemple les neutres, l'orange de marque, les espacements et les rayons ;
2. les tokens sémantiques décrivent une intention, par exemple la surface de page, le texte secondaire, l'action primaire ou le danger ;
3. les tokens de composant décrivent une décision locale seulement lorsqu'un composant ne peut pas exprimer son contrat avec les tokens sémantiques.

Les composants partagés consomment les rôles sémantiques plutôt que les couleurs primitives. Une composition éditoriale propre à une application peut employer un primitif pour construire un plan visuel exceptionnel, à condition que ce choix reste local, documenté et ne porte ni état fonctionnel, ni focus, ni thème d'établissement. Un thème d'établissement surcharge des rôles sémantiques autorisés, jamais les états fonctionnels, le focus ou les couleurs de marque.

Les SVG canoniques de l'[ADR-0023](adr-0023-systeme-logo-vectoriel-fourni.md) sont insérés sans recomposition ni recoloration. L'orange `#FA550C` reste la voix de marque. Le système expérimental peut changer la composition, les surfaces, la densité et la géométrie, mais ne crée pas une seconde identité Surplasse.

### Routage et exécution

L'expérience ne crée aucun domaine. En développement, Caddy la sert sous le même hôte que l'application comparée, avec un préfixe qui rend son statut explicite :

| Variante | URL de base en développement |
|---|---|
| Onboarding2 | `https://surplasse.test/_experiments/untitled/` |
| Commande2 | `https://{slug}.surplasse.test/_experiments/untitled/` |
| Dashboard2 | `https://dashboard.surplasse.test/_experiments/untitled/` |

Les URL proviennent du profil central de domaines. Aucun suffixe `.test`, aucune URL API et aucun hôte de repli ne sont codés dans les applications. Les routes d'expérience sont déclarées avant les routes de repli des applications canoniques.

Les services correspondants vivent uniquement dans `compose.development.yaml`, sous le profil `frontend-experiment`. Ils sont absents de `compose.yaml`, de `compose.production.yaml`, des images de production et du VPS. Les listeners natifs 5175, 5176 et 5177 restent des ports techniques. La QA navigateur passe toujours par Caddy et les URL HTTPS ci-dessus.

Les variantes réutilisent les sessions et autorisations du Backend. Elles n'introduisent ni cookie, ni schéma de données, ni endpoint. Les données de navigateur susceptibles d'entrer en collision, notamment le panier et la session de table, utilisent un espace de noms `surplasse.ui2.*` pendant l'expérience.

GitHub Pages publie en complément trois builds statiques `noindex` sous un sélecteur commun. Ils servent à la revue visuelle publique du SHA et ne constituent ni une route produit, ni un déploiement sur le VPS. Les trois builds reçoivent un profil réseau neutre et non routable sous `pages.invalid`. Leur contrôle d'artefact interdit toute valeur locale en `.test`. Onboarding2 y signale le mode statique et renvoie uniquement vers l'Onboarding original, Dashboard2 et la documentation de la même publication. Commande2 y active uniquement une carte synthétique signalée dans l'interface, ignore tout code de table et remplace les clients de commande et de paiement par des refus explicites. Dashboard2 contourne uniquement dans ce build l'authentification réelle, fournit une session et des commandes synthétiques, désactive le flux SSE et exécute les actions dans un état local réinitialisé au rechargement. Ses clients d'identité continuent de refuser toute opération. Aucun mode de démonstration Pages ne s'active dans les builds Compose ou Vite ordinaires.

### Parité et mesure

Une variante peut modifier la présentation et la microcopie, mais elle ne peut ni inventer une capacité Backend, ni masquer un état métier, ni modifier une règle de paiement. Chaque parcours déclaré couvert fonctionnellement garde les mêmes actions, statuts canoniques, erreurs et contrôles d'autorisation que son original. Un transfert explicite vers l'application canonique reste une limite honnête, mais il ne compte jamais comme une parité acquise ni comme une preuve comparative du parcours.

Les critères suivants sont bloquants pour toute comparaison :

- TypeScript strict, lint, tests et build des quatre packages ;
- navigation clavier, focus visible, noms accessibles et contrastes WCAG 2.2 AA ;
- états de chargement, vide, erreur, perte de connexion et action en cours ;
- cible tactile minimale de 44 x 44 px dans Commande2 ;
- mesure séparée du poids initial et des performances de Commande2, sans relâcher le budget de Commande ;
- contrôle visuel des vues mobile, tablette et bureau avec les mêmes données de démonstration pour les parcours effectivement couverts ;
- aucune régression des frontends canoniques dans leur CI.

### Visuels générés

Des visuels générés peuvent créer un fond, une ambiance ou un contexte éditorial. Ils ne représentent jamais un plat, un établissement, un membre d'équipe ou un résultat client réel. Ils ne servent pas de preuve produit.

Chaque asset généré possède une entrée dans un manifeste de provenance : nom du fichier, date, outil, résumé du prompt, dimensions, transformations, surface d'usage et statut décoratif ou informatif. Un asset décoratif reçoit une alternative vide. Un asset informatif reçoit une alternative textuelle utile.

Cette règle ne modifie pas l'[ADR-0025](adr-0025-visuels-plats-a-la-demande.md). Un visuel de plat reste interdit sans photo source maîtrisée du plat réellement servi et sans choix explicite du restaurateur.

### Arrêt et promotion

L'expérience peut être arrêtée à tout moment. Son retrait consiste à supprimer les quatre packages, les routes Caddy de développement, les services du profil `frontend-experiment`, les trois cartes et le preset associés dans le Dev Cockpit, les contrôles CI, ainsi que le sélecteur et l'assemblage des démonstrations dans le workflow Pages, puis cette documentation. Les applications canoniques, le Backend et les données ne demandent aucune migration ni retour arrière.

Aucune variante ne peut devenir la production par simple changement de route. Une promotion exige un nouvel ADR fondé sur une comparaison mesurée. Cette décision devra traiter au minimum la parité fonctionnelle, les tests, l'accessibilité, les performances de Commande, les licences, la migration des routes, la suppression ou la conservation du système précédent et le retour arrière en production.

## Conséquences

### Positives

- L'équipe compare Commande et Dashboard sur les mêmes données, au même moment et sans ambiguïté sur la version observée. Onboarding rejoint cette comparaison seulement parcours par parcours, après acquisition explicite de la parité correspondante.
- L'expérience peut évoluer ou disparaître sans modifier le chemin de production.
- Le nouveau design system possède des frontières, des tokens, une provenance et des critères de qualité dès son premier composant.
- L'intégration réelle révèle les coûts d'accessibilité, de responsive, de performance et de maintenance qu'une maquette masque.

### Négatives et dettes assumées

- Les parcours couverts existent deux fois pendant l'expérience et exigent une discipline de parité.
- Les dépendances, tests et builds augmentent le temps de CI quand le profil expérimental est vérifié.
- Les correctifs visuels ne se propagent pas automatiquement entre les deux systèmes.
- Le suffixe `2` est volontairement transitoire. Une éventuelle promotion devra choisir des noms pérennes et supprimer l'ambiguïté.
- Le design system expérimental ne doit pas devenir un troisième emplacement de logique métier ou d'utilitaires généraux.

Décisions liées : [ADR-0004 : trois applications React séparées](adr-0004-trois-frontends-react.md), [ADR-0012 : Tailwind et shadcn/ui](adr-0012-tailwind-shadcn.md), [ADR-0014 : liaison de frontends/shared](adr-0014-liaison-shared.md), [ADR-0023 : système de logo vectoriel fourni](adr-0023-systeme-logo-vectoriel-fourni.md), [ADR-0024 : deux registres visuels complémentaires](adr-0024-deux-registres-visuels.md), [ADR-0025 : visuels de plats à la demande](adr-0025-visuels-plats-a-la-demande.md) et [ADR-0026 : pile Docker Compose commune](adr-0026-compose-commun.md).
