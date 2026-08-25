---
label: "ADR-0048 : bord Cloudflare hybride"
order: 480
icon: law
description: "Pourquoi Cloudflare porte le bord et les statiques tandis qu'Atlas conserve le coeur transactionnel Quarkus et PostgreSQL."
---

# ADR-0048 : bord Cloudflare hybride et coeur transactionnel Atlas

## Statut

Accepté, 2026-08-25.

Remplace l'[ADR-0045](adr-0045-atlas-unique-production.md). Les décisions relatives à Quarkus, PostgreSQL, SSE, Stripe, aux migrations séparées et à la production testeurs restent applicables.

## Contexte

Surplasse est un MVP fermé. Ses quatre surfaces web sont des builds statiques, mais son Backend est déjà un monolithe Quarkus transactionnel. Les commandes, paiements, remboursements, sessions restaurateur, webhooks Stripe et événements SSE reposent sur PostgreSQL, Hibernate, Flyway, des verrous pessimistes, un verrou consultatif PostgreSQL et des transactions courtes coordonnées autour des appels Stripe.

Cloudflare peut servir les fichiers statiques, terminer TLS, filtrer les requêtes et rapprocher le contenu des utilisateurs. D1, Durable Objects, Queues, Workflows et Workers Containers offrent aussi des primitives applicatives. Les adopter toutes maintenant imposerait cependant une réécriture du coeur, une deuxième sémantique transactionnelle et plusieurs surfaces opératoires avant même le premier client.

Atlas est partagé avec d'autres produits. Déplacer les statiques Surplasse ne supprime donc ni le VPS ni sa facture. Le choix doit réduire la complexité propre à Surplasse sans prétendre produire une économie de trésorerie qui n'existe pas encore.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Conserver tout Surplasse sur Atlas | Aucun nouveau fournisseur d'exécution, un seul runbook historique | Bord statique couplé au VPS, certificats et routage à opérer, origine actuellement fragile |
| Réécrire immédiatement le Backend sur Workers et D1 | Plateforme Cloudflare presque exclusive, facturation à l'usage | Réécriture de Java, JPA, Flyway, transactions, verrous, Stripe et SSE, risque fonctionnel disproportionné |
| Exécuter Quarkus dans Workers Containers | Réutilisation partielle de l'image JVM | PostgreSQL externe toujours nécessaire, coût permanent, démarrages et exploitation supplémentaires pour un MVP |
| Utiliser Cloudflare au bord et Atlas pour le coeur | Migration progressive, statiques mondiaux, rollback court, aucune migration de données | Deux plateformes actives ; 5 USD d'abonnement supplémentaire si le compte ne paie pas déjà Workers Paid |

## Décision

Nous retenons une architecture hybride. Un Worker unique et un binding Workers Static Assets deviennent la cible du bord public. Le bundle agrège Onboarding, Commande, Dashboard et Nimbus sous des préfixes internes. Le Worker route selon le nom d'hôte, reproduit la liste blanche Onboarding, les réponses 404 et 503, la redirection `www`, les noms réservés et les fallbacks propres à chaque application. Les préfixes internes ne deviennent jamais des URL publiques.

Le même Worker force HTTPS, protège `/q` et `/q/*`, puis transmet toute autre requête `api.surplasse.com` sans lire le corps ni reconstruire la réponse. Le drapeau `global_fetch_private_origin` maintient le passage vers l'origine de la zone au lieu de reboucler sur la Route Worker. Ce sous-appel contourne aussi les autres Workers et les règles de sécurité ou de cache de la zone, qui ne sont donc jamais appliqués une seconde fois. Le corps des webhooks Stripe, les cookies hôte uniquement, les en-têtes CORS et les flux SSE restent sous l'autorité du Backend et de Caddy à l'origine.

Atlas conserve Quarkus, PostgreSQL, Flyway, les rôles de base, les secrets, les sauvegardes, Prometheus et Grafana. `vps-infra` conserve l'autorité d'admission et d'activation de la production, y compris les enregistrements DNS, les Routes Worker et le futur Cloudflare Tunnel. La configuration Wrangler du produit ne contient aucune Route. Le dépôt Surplasse produit et vérifie le candidat Worker, son manifeste statique et la release Backend. Une réussite productrice ne prouve jamais une activation publique.

Le stockage objet futur sera R2 plutôt que MinIO. Aucun bucket n'est créé avant l'implémentation du domaine `generation`. PostgreSQL conservera les métadonnées, R2 les objets privés et publiés, et le Backend gardera une interface S3-compatible. Cloudflare Images pourra créer les variantes après validation et réencodage des uploads.

Turnstile sera ajouté aux formulaires exposés lorsqu'ils deviendront dynamiques. AI Gateway pourra entourer OpenAI quand la génération existera, avec cache et journalisation des contenus désactivés jusqu'à la revue RGPD. Cloudflare Email Service reste un essai séparé tant que son statut bêta, ses quotas et sa délivrabilité ne sont pas qualifiés. D1, Durable Objects, Queues, Workflows, Hyperdrive et Workers Containers ne font pas partie du MVP livré.

Le plan Workers Paid à 5 USD par compte et par mois est la base retenue pour la production testeurs. Le coût marginal d'abonnement vaut 5 USD si Surplasse déclenche le premier abonnement, ou 0 USD si le compte est déjà Paid et conserve assez de quotas partagés. Le Worker s'exécute avant les assets pour router par hôte, donc chaque requête traverse le compteur Workers même si le fichier statique reste servi par Static Assets. Cette simplicité est acceptée tant que les 10 millions de requêtes et 30 millions de millisecondes CPU incluses couvrent le pilote. Le coût est mesuré par route avant toute optimisation.

Workers Logs et Traces restent désactivés tant que les URL de suivi contiennent une capacité d'accès. Les CSP de Commande, Dashboard et Onboarding sont servies au bord. La migration suit des portes réversibles : candidat local et CI, version Cloudflare sans route publique, apex, hôtes statiques nommés, API après qualification Tunnel, wildcard en dernier, puis retrait éventuel des conteneurs statiques après une période d'observation et un exercice de retour arrière. Aucune migration de données n'est incluse.

## Conséquences

### Positives

- le bord statique, TLS et le wildcard quittent le chemin critique du VPS ;
- les quatre surfaces partagent un seul déploiement et un seul contrat de routage testé ;
- le coeur transactionnel et ses preuves PostgreSQL restent inchangés ;
- le basculement ne demande ni migration de schéma, ni double écriture, ni changement Stripe ;
- R2 remplace un futur service MinIO avant que des données existent ;
- chaque étape possède une porte, une sonde publique et un retour arrière explicite.

### Négatives et dettes assumées

- Cloudflare ajoute 5 USD par mois si le compte n'est pas déjà Workers Paid, sans réduire immédiatement la facture Atlas partagée ;
- le Worker et Atlas doivent être observés comme deux parties de la même production ;
- le routage par hôte impose `run_worker_first` et facture les invocations statiques ;
- Caddy reste temporairement présent à l'origine, puis Tunnel ajoute une dépendance de plateforme ;
- les endpoints Stripe Connect de même origine restent fermés en production testeurs tant qu'ils ne sont pas replacés dans le Backend ;
- une sortie complète du VPS demanderait une décision et un projet de migration distincts, avec restauration, paiements, email et concurrence de données prouvés.
