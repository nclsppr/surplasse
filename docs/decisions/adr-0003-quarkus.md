---
label: "ADR-0003 : Quarkus"
order: 30
icon: law
description: Quarkus est le framework du Backend, retenu pour sa boucle de développement, son empreinte sur VPS et la maturité de l'écosystème Java.
---

# ADR-0003 : Quarkus pour le Backend

## Statut

Accepté, 2026-07-18.

## Contexte

Le Backend est l'unique processus applicatif de Surplasse : il implémente [le contrat](../architecture/api.md), porte toute la logique métier et la persistance, intègre Stripe et l'API Claude, et pousse le temps réel vers le Dashboard et le mini-site Commande. Le choix de son framework est la décision technique la plus engageante du projet : tout le code métier en héritera.

Le domaine est transactionnel par nature. Une commande traverse des états (panier, validée, payée, en préparation, prête), déclenche un paiement Stripe dont les webhooks arrivent de façon asynchrone, et doit rester cohérente avec la disponibilité des produits de la carte. Ce métier appelle des transactions solides, un ORM mûr, des migrations disciplinées : le terrain classique de l'écosystème Java d'entreprise.

Les contraintes d'exploitation sont à l'opposé du cliché Java d'entreprise : la cible de déploiement est un VPS modeste sous Docker Compose, pas un cluster. L'empreinte mémoire du processus et son temps de démarrage comptent, car ils déterminent ce qui tient sur la machine à côté de PostgreSQL et des frontends servis en statique.

Enfin, la contrainte humaine : un développeur seul, qui alterne chaque jour entre le Backend et trois frontends React. La vitesse de la boucle de retour (modifier, recharger, vérifier) pèse plus lourd que sur un projet d'équipe, et l'affinité de Nicolas avec l'écosystème Java (des années de pratique, les réflexes, les outils) est un facteur de productivité légitime à assumer plutôt qu'à ignorer au nom d'une neutralité de façade.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Quarkus** (Java 21, Maven multi-modules) | Mode dev avec rechargement à chaud quasi instantané ; Dev Services (PostgreSQL éphémère automatique en dev et test) ; empreinte mémoire et démarrage optimisés, option native GraalVM ouverte ; standards Jakarta et MicroProfile ; SSE natif ; écosystème Java mûr pour le transactionnel | Écosystème plus petit que Spring ; certaines extensions moins mûres ; base de réponses communautaires plus mince |
| **Spring Boot** | Écosystème le plus vaste du monde Java ; documentation et réponses communautaires pléthoriques ; recrutement facile (sans objet ici) | Empreinte mémoire et démarrage sensiblement supérieurs à périmètre égal ; boucle de développement plus lente ; magie de l'auto-configuration plus opaque ; l'avantage écosystème est marginal sur le périmètre réellement utilisé |
| **Node (NestJS ou Fastify)** | Un seul langage avec les frontends ; démarrage rapide ; écosystème npm immense | Typage TypeScript non garanti à l'exécution ; ORM et gestion transactionnelle moins mûrs que JPA pour un métier d'états et d'argent ; NestJS réintroduit la lourdeur d'un framework d'entreprise sans en apporter les garanties ; moindre affinité de Nicolas côté serveur |

## Décision

Nous retenons **Quarkus**, en version 3.x (dernière LTS), sur Java 21 (LTS), en projet Maven multi-modules, conformément à la stack de référence de `docs/AGENTS.md`.

Le premier argument est l'expérience de développement. Le mode dev de Quarkus recompile et recharge l'application à la sauvegarde, en une fraction de seconde ; les Dev Services font apparaître un PostgreSQL jetable en conteneur sans aucune installation locale. Pour un développeur seul qui saute en permanence entre le contrat, le Backend et les frontends, cette boucle courte est un multiplicateur de productivité quotidien, pas un confort. C'est le point où Quarkus domine nettement Spring Boot à métier égal.

Le deuxième argument est l'adéquation à la cible d'exploitation. Quarkus a été conçu pour réduire l'empreinte mémoire et le temps de démarrage d'une application Java ; sur un VPS modeste qui héberge aussi la base de données, ces mégaoctets comptent. La compilation native GraalVM reste une option de repli documentée si l'empreinte devenait critique, sans réécriture.

Le troisième argument est la maturité de l'écosystème Java pour le métier transactionnel : Hibernate ORM avec Panache, transactions JTA, Flyway pour les migrations, des années de robustesse éprouvée sur exactement le type de problème que posent une commande et un paiement. Le pari de Node aurait échangé cette maturité contre l'unification du langage, un gain jugé cosmétique face au risque sur la couche la plus sensible du système.

Le dernier argument est l'affinité de Nicolas avec l'écosystème Java. Sur un projet solo, la productivité réelle du seul développeur est une donnée d'architecture. Choisir la stack où les réflexes existent déjà, c'est réserver le budget d'apprentissage aux sujets qui le méritent (Stripe, l'extraction de carte par IA, le produit lui-même).

Spring Boot est écarté sans acrimonie : c'est l'option la plus proche, et la portabilité des standards Jakarta rendrait une migration concevable. Il perd sur la boucle de développement et l'empreinte, sans avantage compensatoire à cette échelle.

## Conséquences

### Positives

- La boucle de développement backend (sauvegarde, rechargement, vérification) se compte en secondes, Dev Services compris : un clone du dépôt et une JVM suffisent pour travailler.
- L'empreinte mémoire du Backend laisse de la marge sur le VPS pour PostgreSQL et le reste de la pile, avec l'option native en réserve.
- Le métier transactionnel repose sur des briques éprouvées (Hibernate, JTA, Flyway) plutôt que sur des équivalents plus jeunes.
- L'appui sur les standards Jakarta et MicroProfile limite l'adhérence propriétaire : les compétences et une grande partie du code resteraient portables vers un autre framework Java.
- Le SSE natif de Quarkus couvre le besoin temps réel sans dépendance supplémentaire (voir [ADR-0006](adr-0006-sse.md)).
- La structure Maven multi-modules donne des frontières de domaines vérifiées par le compilateur (détaillée dans [la page Backend](../architecture/backend.md)).

### Négatives et dettes assumées

- L'écosystème Quarkus est plus petit que celui de Spring : moins d'extensions, moins d'articles, moins de réponses toutes faites. Quand une extension manque ou est immature, il faudra écrire l'intégration à la main ; ce coût est assumé.
- Certaines extensions Quarkus sont moins mûres que leurs équivalents Spring ; chaque extension adoptée doit être évaluée sur son état réel, pas sur sa page de présentation.
- Le choix éloigne le Backend du langage des frontends : deux chaînes d'outillage cohabitent dans le monorepo, conséquence déjà actée par [ADR-0001](adr-0001-monorepo.md).
- La compilation native, si elle devient nécessaire, apporte ses propres contraintes (réflexion, temps de build) ; elle est volontairement exclue du périmètre MVP et sera instruite le moment venu.

!!! info Périmètre de la décision
Cet ADR fixe le framework du Backend. Les choix qui en découlent mais restent distincts (structure des modules Maven, conventions de code, stratégie de tests) sont documentés dans [la page Backend](../architecture/backend.md) et les pages de [développement](../developpement/index.md), sous l'autorité du présent ADR.
!!!
