---
label: "ADR-0027 : Playwright et Allure 3"
icon: law
description: Des tests E2E Playwright rejouables sur chaque cible, avec un rapport Allure 3 et un historique JSONL isolé par environnement.
---

# ADR-0027 : Playwright et Allure 3 pour les tests E2E

## Statut

Accepté, 2026-07-22.

## Contexte

Surplasse doit vérifier régulièrement qu'une pile complète reste accessible depuis l'extérieur. Les healthchecks de conteneurs ne prouvent ni le routage par nom d'hôte, ni le chargement réel des frontends, ni la cohérence des URL publiques injectées dans les builds. La même suite doit pouvoir cibler le cluster local, la production et, si elle est créée plus tard, une UAT.

Une exécution horaire produit aussi une série temporelle. Un rapport isolé aide au diagnostic immédiat, mais ne permet pas de voir un test devenir instable ou une panne se répéter. Le résultat doit donc rester consultable après le lancement et conserver son historique sans confondre les cibles.

Les parcours complets de commande et de paiement créent des données et sollicitent Stripe. Les exécuter toutes les heures en production serait dangereux et fausserait les données métier. La surveillance fonctionnelle et la qualification complète ont des rythmes et des environnements différents.

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| Requêtes `curl` seulement | Très rapide, aucune dépendance navigateur | Ne valide pas l'exécution JavaScript, le rendu ni la navigation réelle |
| Playwright avec son rapport HTML natif | Intégration directe, traces utiles | Pas d'historique durable commun entre les lancements |
| Playwright avec Allure Report 2 | Écosystème connu | Historique par dossiers à recopier, version précédente du générateur |
| Playwright avec Allure Report 3 et historique par cible | Rapport rejouable, fichier historique JSONL unique, tendances, même exécution partout | Package supplémentaire, navigateur à installer, conservation CI à exploiter |

## Décision

Nous retenons Playwright avec Chromium pour les tests E2E et Allure Report 3 pour le rapport. Le package autonome `e2e/` verrouille Playwright, `allure-playwright` et la CLI `allure`. Allure reçoit les résultats Playwright, génère un rapport Awesome autonome et conserve au plus 2 160 lancements, soit environ 90 jours à une exécution par heure.

Chaque lancement sélectionne explicitement `development`, `production` ou `custom`. Les deux profils connus chargent `config/domains/` comme toutes les applications. Une cible `custom` exige un identifiant et un domaine racine HTTPS, puis dérive les hôtes Onboarding, Backend, Dashboard et Commande. Elle ne modifie pas la configuration du produit et ne provisionne pas une UAT : une telle pile devra encore posséder son propre profil applicatif cohérent avant de pouvoir être testée.

Résultats, traces, rapport et `history.jsonl` vivent dans des publications immuables sous `.surplasse/e2e/{history-id}/releases/{run-id}/`. Un fichier `current.json` désigne la publication visible par une bascule atomique. Le cockpit et la commande d'ouverture ne lisent jamais un répertoire de génération ni une publication orpheline. Les profils connus conservent les identifiants `development` et `production`. Une cible `custom` ajoute à son identifiant une empreinte déterministe de son domaine racine. Réutiliser un nom d'UAT pour un autre serveur ne peut donc ni fusionner leurs historiques, ni croiser leurs caches. En CI, le pointeur et l'historique de la cible sont restaurés puis sauvegardés par le cache GitHub. L'artefact de chaque lancement contient aussi les publications avec le rapport, les résultats bruts, les diagnostics Playwright et l'historique afin de rester rejouable après une éviction du cache.

Le workflow horaire exécute uniquement des lectures : identité Caddy, readiness du Backend, redirection canonique, fermeture d'un sous-domaine réservé, landing Onboarding, écran de connexion Dashboard et carte publique d'un établissement témoin facultatif. Il ne demande pas de magic link, ne crée pas de session de table, de commande, de paiement ou de remboursement. Les parcours complets restent des tests de qualification sur une pile éphémère ou une UAT utilisant Stripe en mode test.

## Conséquences

Conséquences positives :

- le même code contrôle le cluster local, la production et une cible future sans URL codée dans les tests ;
- un échec conserve sa capture, sa vidéo, sa trace, les résultats bruts et un rapport HTML ;
- les tendances et changements de statut restent propres à chaque cible ;
- la quality gate Allure marque le rapport et le lanceur transmet un test rouge au workflow après avoir généré les preuves ;
- les sondes horaires restent sans effet métier.

Conséquences négatives et dettes assumées :

- Chromium et les dépendances Linux de Playwright augmentent le temps d'installation de la CI ;
- le cache GitHub peut être évincé, donc l'artefact reste nécessaire comme sauvegarde rejouable ;
- une exécution planifiée GitHub peut être retardée et ne remplace pas une sonde de disponibilité dédiée ;
- le smoke de Commande reste ignoré tant qu'aucun slug témoin n'est configuré pour la cible ;
- Firefox, WebKit, les parcours authentifiés et les flux financiers ne font pas partie de la surveillance horaire initiale ;
- une future UAT exige un profil de déploiement applicatif en plus de la cible E2E `custom`.
