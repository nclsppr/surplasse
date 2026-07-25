---
label: "ADR-0035 : Java 25, Quarkus courant et mise"
order: 350
icon: law
description: "Pourquoi Surplasse conserve Java 25 et Quarkus courant tout en unifiant les versions Node, Java et Python du poste avec mise."
---

# ADR-0035 : Java 25, Quarkus courant et outillage mise

## Statut

Accepté, 2026-07-25. Remplace l'[ADR-0030](adr-0030-java-25-quarkus-courant.md).

## Contexte

L'ADR-0030 a fixé Java 25 comme runtime unique du Backend, la dernière version stable de Quarkus comme cadence de référence et le Maven Wrapper comme fournisseur de Maven. Ces choix restent adaptés. Son mécanisme d'installation locale repose toutefois sur SDKMAN, tandis que Node utilise nvm et que Python vient du système ou d'un troisième mécanisme.

Cette combinaison sait épingler chaque runtime, mais elle ne garantit pas leur activation dans tous les processus. Un shell, un IDE ou un agent lancé sans les hooks de nvm ou SDKMAN peut recevoir une autre version depuis son `PATH`. La vérification locale peut alors utiliser Java 21 ou Python 3.9 alors que le dépôt attend Java 25 et Python 3.12. Le repli Docker de certaines commandes protège la validation finale, mais ne corrige pas la boucle native ni la génération OpenAPI.

Surplasse est développé par une seule personne sur macOS, Linux et Windows via Ubuntu sous WSL2. L'objectif est donc un seul manifeste léger pour les outils du poste, sans créer un deuxième orchestrateur de services à côté de Docker Compose. Les commandes npm, le Maven Wrapper, les Dockerfiles et le graphe Compose constituent déjà les interfaces reproductibles du projet.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Conserver nvm, SDKMAN et Python système | Aucun changement immédiat ; outils connus | Trois chemins d'installation et d'activation ; dérive possible entre shells, IDE et agents ; version Python non épinglée sur le poste |
| Introduire Flox | Environnement hermétique ; manifeste partageable ; packages et services dans un même outil | Ajoute Nix et un second modèle de cycle de vie ; recouvre inutilement Compose ; coût d'apprentissage et d'exploitation disproportionné pour le projet solo |
| Exécuter tous les outils dans Compose ou un Dev Container | Isolation forte ; Docker déjà requis pour l'intégration | Ralentit les boucles natives ; complique les IDE et la génération ; ne supprime pas les prérequis hôte pour Docker, le DNS et les certificats |
| **Unifier Node, Java et Python avec mise** | Un manifeste ; activation ou exécution explicite ; lockfile multi-plateforme ; prise en charge de macOS, Linux et WSL2 | Un outil de poste supplémentaire à installer ; migration initiale ; lockfile à maintenir lors des mises à jour |

## Décision

Nous conservons le monolithe modulaire Quarkus et fixons **Java 25** comme version unique de compilation, de test et d'exécution du Backend. Le compilateur Maven cible la release 25. La génération OpenAPI, les tests et les images de build et d'exécution utilisent Temurin 25. Surplasse continue de suivre la **dernière version stable de Quarkus**, actuellement 3.37.4. Toute montée de version passe par les guides de migration, la vérification de l'alignement des extensions, la suite Backend complète, la construction de l'image et un contrôle de démarrage.

Le Maven Wrapper reste l'unique fournisseur de Maven et fixe Maven 3.9.16. Surefire 3.5.4 et Spotless 3.8.0 restent épinglés dans le build. Aucun Maven global n'est requis.

Nous retenons **mise** comme gestionnaire unique des runtimes du poste. Le fichier `mise.toml` versionné fixe les versions de référence suivantes :

| Outil | Version de référence | Usage |
|---|---|---|
| Node.js | 24.18.0 | Frontends, documentation, contrat et scripts locaux |
| Java Temurin | 25.0.3+9 LTS | Backend, génération OpenAPI et outils Java |
| Python | 3.12.13 | Génération et vérification des assets de marque |

Le fichier `mise.lock` versionné porte les versions résolues, les URL et les sommes de contrôle pour macOS et Linux sur architectures ARM64 et x86-64. WSL2 suit les entrées Linux. Une personne qui clone le dépôt approuve le manifeste avec `mise trust`, installe les outils avec `mise install --locked` et peut forcer leur contexte avec `mise exec -- <commande>`. L'activation du shell reste un confort, pas une condition de reproductibilité.

Les fichiers `.nvmrc` et `.sdkmanrc` sont supprimés après validation de la migration. Les commandes npm restent l'interface commune du projet. Nous ne recopions pas les builds, tests ou lancements dans des tâches mise. Les workflows GitHub Actions conservent leurs actions officielles d'installation et restent alignés sur Node 24, Java 25 et Python 3.12. Une modification de `mise.toml` ou `mise.lock` déclenche les workflows concernés afin de qualifier la nouvelle toolchain.

Cette décision ne change pas l'orchestration. Docker Compose reste l'unique cycle de vie des services en développement intégré et en production, conformément aux [ADR-0026](adr-0026-compose-commun.md) et [ADR-0028](adr-0028-cockpit-compose-et-rapports-allure.md). mise ne démarre ni PostgreSQL, ni Caddy, ni le Backend, ni les frontends comme services. Il ne remplace pas Docker, dnsmasq, mkcert ou le magasin de certificats du système. Il est absent du VPS de production.

PostgreSQL reste la source de vérité métier. Temporal n'entre ni dans le MVP ni dans la phase 2. Il sera réévalué seulement lorsqu'un parcours réel cumulera plusieurs besoins de longue durée, d'attente externe, de reprise, de compensation et de visibilité opérationnelle.

## Conséquences

### Positives

- Un clone porte un seul contrat de versions pour Node, Java et Python.
- `mise exec` donne le même contexte aux shells, IDE, scripts et agents sans dépendre de hooks propres à nvm ou SDKMAN.
- Le lockfile rend les téléchargements vérifiables et couvre les plateformes de développement prises en charge.
- Java 25, Quarkus courant, le Maven Wrapper et les images Temurin restent alignés avec la décision Backend précédente.
- Compose conserve seul les réseaux, volumes, healthchecks, dépendances et redémarrages de la pile.

### Négatives et dettes assumées

- Chaque poste doit installer et maintenir une version récente de mise.
- Les utilisateurs existants doivent retirer l'activation projet nvm et SDKMAN de leurs habitudes pour éviter deux sources concurrentes.
- Le lockfile doit être régénéré et relu lors de chaque changement de runtime.
- Les workflows GitHub Actions expriment encore les lignes de versions dans leurs actions d'installation. Renovate et la CI doivent empêcher leur dérive par rapport au manifeste.
- Le train Quarkus courant reste non LTS et impose toujours une qualification régulière de ses montées mineures.

## Références

- [Installer mise](https://mise.jdx.dev/installing-mise.html)
- [Démarrer avec mise](https://mise.jdx.dev/getting-started)
- [Java avec mise](https://mise.jdx.dev/lang/java.html)
- [Lockfile mise](https://mise.jdx.dev/dev-tools/mise-lock.html)
- [Quarkus 3.37.4](https://quarkus.io/blog/quarkus-3-37-4-released/)
- [Versions et maintenance de Quarkus](https://quarkus.io/releases/)
- [Notes de version Maven 3.9.16](https://maven.apache.org/docs/3.9.16/release-notes.html)
