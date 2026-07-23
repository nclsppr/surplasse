---
label: Frontends alternatifs
order: 31
icon: beaker
description: "Installation, lancement, vérification et arrêt des variantes Untitled UI réservées au développement."
---

# Frontends alternatifs

Cette page décrit l'exécution de `frontends/design-system2/`, `frontends/onboarding2/`, `frontends/commande2/` et `frontends/dashboard2/`. Leur architecture et leur caractère réversible sont fixés par l'[ADR-0033](../decisions/adr-0033-frontends-alternatifs-untitled-ui.md). Leurs fondations visuelles sont détaillées dans le [design system 2](../architecture/design-system-2.md).

!!! warning Développement seulement
Ces quatre packages et le profil Compose `frontend-experiment` sont absents des routes produit, des images de production et du VPS. Les applications sans suffixe restent canoniques. GitHub Pages publie seulement des preuves visuelles statiques `noindex`. Aucune URL sous `/_experiments/untitled/` ne doit être ajoutée au profil de production.
!!!

## État et rôle des modules

| Module | Rôle | Catégorie d'exécution | Processus autonome | Données persistantes |
|---|---|---|---|---|
| `frontends/design-system2/` | Tokens, composants, styles et assets UI2 | Développement, build et CI | Non, bibliothèque source | Aucune |
| `frontends/onboarding2/` | Variante de la vitrine avec passage explicite au tunnel original | Développement et build de démonstration Pages | Vite en boucle native, NGINX dans Compose | Aucune donnée serveur |
| `frontends/commande2/` | Variante du mini-site, de la carte, du panier et du paiement | Développement et build de démonstration Pages | Vite en boucle native, NGINX dans Compose | Panier et session de table dans un espace local `surplasse.ui2.*` |
| `frontends/dashboard2/` | Variante des vues métier du restaurateur | Développement et build de démonstration Pages | Vite en boucle native, NGINX dans Compose | Aucune donnée serveur |

Commande2 et Dashboard2 parlent au Backend existant et consomment le client généré du même contrat OpenAPI. Onboarding2 couvre la vitrine et passe explicitement au tunnel original avant toute étape reliée au Backend. Sa parité fonctionnelle n'est donc pas acquise. Les variantes ne lancent pas une seconde API et ne créent ni base, ni volume Compose. Les sessions, commandes et établissements observés par les parcours reliés au Backend restent ceux des applications canoniques.

## Versions de référence

La référence Untitled UI initiale correspond au commit public [`eaee6a5b9798fa6867b4d896c6cfecf6ce706a73`](https://github.com/untitleduico/react/tree/eaee6a5b9798fa6867b4d896c6cfecf6ce706a73). Les versions exactes installées restent verrouillées dans chaque `package-lock.json`.

| Dépendance | Version de référence initiale | Catégorie | Présence sur le VPS |
|---|---|---|---|
| Node.js | 24 | Développement, build et CI | Non |
| React et React DOM | 19.2.8 | Bibliothèques intégrées aux bundles de l'expérience | Non, expérience absente |
| TypeScript | 5.9.3 | Développement, build et CI | Non |
| Vite | 8.1.5 | Serveur de développement et build | Non |
| Tailwind CSS | 4.3.3 | Génération des styles au build | Non |
| NGINX non privilégié | 1.29.4-alpine, digest épinglé dans `config/deployment/images.env` | Runtime des trois images Compose expérimentales | Non, expérience absente |
| React Aria Components | 1.19.0 | Comportements accessibles intégrés aux bundles | Non, expérience absente |
| Lucide React | Version verrouillée dans les packages | Icônes intégrées aux bundles | Non, expérience absente |
| Untitled UI React public | Commit épinglé ci-dessus | Source adaptée, pas un serveur ni un paquet publié | Non, expérience absente |

Aucun composant Untitled UI PRO n'est nécessaire. L'installation utilise seulement le registre npm public et les sources publiques conservées avec leur provenance.

## Prérequis par plateforme

Les prérequis sont les mêmes que pour les frontends canoniques : Node 24 via nvm, npm, Docker et le plugin Docker Compose. Le cluster intégré exige aussi le DNS wildcard et le certificat local décrits dans [Domaines locaux](domaines-locaux.md).

| Plateforme | Procédure |
|---|---|
| macOS | Installer nvm et Node 24, puis Docker Desktop ou OrbStack. Exécuter `npm run local:setup` une fois pour les domaines et le certificat |
| Windows | Utiliser Ubuntu sous WSL2, cloner le dépôt dans le système de fichiers WSL2 et suivre la procédure Linux. Docker Desktop utilise le backend WSL2 |
| Linux | Installer nvm, Node 24, Docker Engine et le plugin Compose. Configurer le wildcard et le certificat selon la procédure Linux |

Le développement Windows natif hors WSL2 n'est pas supporté. En cas de divergence, Ubuntu LTS fait foi.

## Installation

Depuis la racine du dépôt, activer la version Node et installer le socle partagé ainsi que les quatre packages :

```bash
nvm use
npm run frontend2:install
```

La commande racine exécute l'installation verrouillée de chaque package. L'équivalent explicite, utile pour isoler une erreur, est :

```bash
(cd frontends/shared && npm ci)
(cd frontends/design-system2 && npm ci)
(cd frontends/onboarding2 && npm ci)
(cd frontends/commande2 && npm ci)
(cd frontends/dashboard2 && npm ci)
```

Chaque application reste installable indépendamment. Les dépendances locales `file:` sont résolues par npm. Aucun workspace global n'est ajouté au monorepo.

## Configuration

Les domaines et URL publiques viennent de `config/domains/development.env`, chargés par les scripts centraux. Les builds Compose et Vite ordinaires ne codent ni `.test`, ni une URL API, ni un slug de démonstration. Ils utilisent la même valeur générée de `VITE_API_BASE_URL` que l'application canonique correspondante. Seul le build statique Pages sélectionne explicitement le slug synthétique `le-cormoran`, lié à la carte de revue visuelle décrite plus bas et jamais utilisé pour joindre le Backend.

Commande2 utilise la même clé publique Stripe de test et le même compte pilote que Commande. Aucune clé réelle n'est committée. Les données de navigateur propres à l'expérience utilisent le préfixe `surplasse.ui2.*` afin qu'un panier ouvert dans Commande ne soit ni lu ni écrasé par Commande2.

Les routes de base Vite et React Router utilisent `/_experiments/untitled/`. Les routes enfant sont ajoutées après ce préfixe. Le préfixe n'entre pas dans les appels au Backend.

Le réseau Compose réserve `172.30.0.10` à Caddy. La plage dynamique `172.30.0.128/25` exclut cette adresse afin que l'ajout des trois conteneurs expérimentaux ne puisse pas empêcher le démarrage HTTPS. Le sous-réseau, la plage dynamique et l'adresse de Caddy se modifient ensemble dans les profils de déploiement.

## Lancement intégré avec Compose

Le parcours de référence utilise Caddy, les cookies `Secure`, les vrais hôtes de développement et les images de la topologie locale. Le profil facultatif démarre les trois variantes en plus du cluster normal :

```bash
npm run local:experiment:up
```

La commande développée est :

```bash
COMPOSE_PROFILES=frontend-experiment bash scripts/compose.sh development up --detach --build --wait
```

Le profil `frontend-experiment` existe uniquement dans `compose.development.yaml`. Sans ce profil, `npm run local:up` continue de démarrer les applications canoniques sans les variantes.

Les URL à ouvrir dans le navigateur sont :

| Surface | Original | Expérience Untitled UI |
|---|---|---|
| Onboarding | `https://surplasse.test/` | `https://surplasse.test/_experiments/untitled/` |
| Commande | `https://{slug}.surplasse.test/` | `https://{slug}.surplasse.test/_experiments/untitled/` |
| Dashboard | `https://dashboard.surplasse.test/` | `https://dashboard.surplasse.test/_experiments/untitled/` |

Le placeholder `{slug}` est remplacé par un établissement du seed. Il ne constitue pas une URL littérale à ouvrir. Le navigateur ne vise jamais `localhost`, `127.0.0.1` ni un port Vite.

Pour contrôler le cluster et suivre les logs :

```bash
COMPOSE_PROFILES=frontend-experiment bash scripts/compose.sh development ps
COMPOSE_PROFILES=frontend-experiment bash scripts/compose.sh development logs --follow
```

Le Dev Cockpit expose aussi trois cartes distinctes pour Onboarding2, Commande2 et Dashboard2. Elles restent hors du preset `core` et rejoignent le preset `all`. Le serveur du cockpit associe lui-même ces services au profil fixe `frontend-experiment` : le navigateur ne peut ni choisir un profil Compose, ni fournir une commande arbitraire.

## Boucles Vite natives

Les serveurs natifs raccourcissent la boucle de modification. Ils ne constituent pas une preuve du routage, des cookies ou de la parité Compose. Chaque commande s'exécute dans un terminal distinct :

```bash
(cd frontends/onboarding2 && npm run dev)
(cd frontends/commande2 && npm run dev)
(cd frontends/dashboard2 && npm run dev)
```

| Module | Listener technique strict |
|---|---|
| Onboarding2 | 5175 |
| Commande2 | 5176 |
| Dashboard2 | 5177 |

Un port occupé fait échouer le lancement. Vite ne choisit pas un port voisin. Ces listeners privés sont autorisés pour le proxy et les sondes techniques. La QA navigateur finale repasse toujours par le profil Compose et Caddy.

`design-system2` ne possède aucun serveur. Une modification de ses sources est transformée par l'application qui le consomme.

## Vérification

La vérification complète des quatre packages est disponible à la racine :

```bash
npm run frontend2:check
```

Pour isoler un module, utiliser ses scripts :

```bash
(cd frontends/design-system2 && npm run check && npm test)
(cd frontends/onboarding2 && npm run lint && npm test && npm run build)
(cd frontends/commande2 && npm run lint && npm test && npm run build)
(cd frontends/dashboard2 && npm run lint && npm test && npm run build)
```

La revue de comparaison utilise les mêmes données du seed et couvre au minimum :

1. l'original puis la variante sur le même hôte ;
2. les états chargement, vide, erreur, action en cours et perte de connexion ;
3. la navigation clavier, le focus visible, le zoom à 200 % et les noms accessibles ;
4. les vues téléphone, tablette et bureau ;
5. le dernier écran de chaque parcours, y compris le suivi de commande et les transitions de statut ;
6. le poids du bundle et les métriques de chargement de Commande2 comparés à Commande ;
7. l'absence de lecture ou d'écriture croisée entre `surplasse.ui2.*` et les clés de l'original ;
8. l'absence de régression dans les tests des frontends canoniques.

Un composant n'est pas validé par sa seule ressemblance avec un exemple Untitled UI. Les comportements React Aria, le contraste dans les thèmes autorisés, le contenu long et le responsive font partie de son contrat.

### Mesure initiale des bundles

La mesure de référence du 23 juillet 2026 utilise le mode `development` et les fichiers réellement émis par Vite. Les tailles gzip sont recomptées avec `zlib.gzipSync` afin d'appliquer la même méthode aux builds Vite 6 et Vite 8.

```bash
npm run build --prefix frontends/commande -- --mode development
npm run build --prefix frontends/commande2 -- --mode development
npm run build --prefix frontends/dashboard -- --mode development
npm run build --prefix frontends/dashboard2 -- --mode development
```

| Frontend | JavaScript brut | JavaScript gzip | CSS brut | CSS gzip | WebP brut | Fontes brutes |
|---|---:|---:|---:|---:|---:|---:|
| Commande | 320 906 octets | 100 450 octets | 14 597 octets | 3 930 octets | 0 | 0 |
| Commande2 | 390 218 octets | 122 322 octets | 29 576 octets | 7 270 octets | 0 | 122 264 octets |
| Dashboard | 322 253 octets | 99 205 octets | 33 195 octets | 6 836 octets | 0 | 205 352 octets |
| Dashboard2 | 394 121 octets | 120 667 octets | 32 977 octets | 7 468 octets | 246 060 octets | 122 264 octets |

Commande2 ajoute 21 872 octets de JavaScript gzip et 3 340 octets de CSS gzip par rapport à Commande. Aucun raster généré n'entre dans son bundle. Dashboard2 ajoute 21 462 octets de JavaScript gzip, 632 octets de CSS gzip et 246 060 octets de WebP, tout en retirant 83 088 octets de fontes brutes par rapport au Dashboard canonique.

Ces écarts sont une dette expérimentale mesurée, pas un nouveau budget accepté. Une promotion doit réduire ou justifier chaque écart avec des métriques de chargement et d'interaction. L'Onboarding canonique reste un ensemble statique sans pipeline Vite comparable, il n'entre donc pas dans ce tableau.

## Démo statique sur GitHub Pages

Chaque push sur `main` publie un [sélecteur UI2 public](https://nclsppr.github.io/surplasse/_experiments/untitled/) et trois builds séparés, marqués `noindex`. Cette publication constitue une preuve visuelle du SHA, pas une route produit ni une destination du VPS.

Onboarding2 expose sa vitrine et son écran de passage vers le tunnel original. Dashboard2 expose son écran de connexion. Commande2 utilise un mode de build Pages explicite, avec un établissement et une carte synthétiques signalés dans l'interface. Son panier reste local et la validation est neutralisée en l'absence de session de table. Ce mode ne remplace jamais le client généré dans les builds Compose ou Vite ordinaires et ne fournit aucun repli de domaine.

Les parcours alimentés par le Backend, les cookies, Stripe et le temps réel se valident exclusivement avec le profil Compose development sur les hôtes `.test`. La démo Pages ne transmet ni commande, ni paiement, ni adresse email.

## Assets générés

Les visuels expérimentaux vivent sous `frontends/design-system2/src/assets/generated/`. Leur manifeste de provenance accompagne les masters et les dérivés optimisés. Avant d'ajouter un asset :

1. confirmer qu'il ne représente ni un faux plat, ni un faux établissement, ni une fausse preuve produit ;
2. conserver le master si des dérivés sont committés ;
3. produire les tailles réellement utilisées et déclarer leurs dimensions dans le code ;
4. renseigner la date, l'outil, le résumé du prompt, les transformations et l'usage dans le manifeste ;
5. choisir une alternative vide pour un décor ou une alternative utile pour une image informative.

Les visuels de plats restent soumis à l'[ADR-0025](../decisions/adr-0025-visuels-plats-a-la-demande.md). Le dossier expérimental n'est pas une exception à l'obligation de photo source et de choix du restaurateur.

## Arrêt et nettoyage

Pour arrêter les conteneurs sans supprimer le cluster :

```bash
npm run local:experiment:stop
```

Pour retirer les conteneurs et réseaux de développement :

```bash
COMPOSE_PROFILES=frontend-experiment bash scripts/compose.sh development down
```

Dans une boucle Vite native, `Ctrl+C` arrête seulement le serveur du terminal concerné. Les variantes ne possèdent ni volume ni donnée serveur à sauvegarder ou restaurer. Les données métier restent dans le PostgreSQL commun du profil development.

L'arrêt définitif de l'expérience supprime les quatre répertoires, le profil `frontend-experiment`, les routes Caddy, les scripts racine, les trois cartes et le preset associés dans le Dev Cockpit, les contrôles CI, ainsi que le sélecteur et l'assemblage des démonstrations dans le workflow Pages. Les applications canoniques continuent de fonctionner sans migration.

## Destination de production

Il n'existe aucune destination produit ou VPS pour UI2. `compose.production.yaml`, les images du VPS, les domaines `.com` et les procédures de déploiement n'incluent ni les packages `*2`, ni leur préfixe de route. La publication GitHub Pages reste une preuve visuelle statique, sans Backend public.

Une promotion future demande un nouvel ADR et une procédure d'exploitation complète sous Ubuntu LTS. Elle ne peut pas être réalisée en activant le profil de développement sur le VPS.
