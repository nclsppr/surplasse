---
label: "ADR-0002 : contract-first"
order: 20
icon: law
description: Le contrat OpenAPI est la source de vérité de l'API, le code est généré des deux côtés, jamais l'inverse.
---

# ADR-0002 : contract-first, le contrat OpenAPI comme source de vérité

## Statut

Accepté, 2026-07-18.

## Contexte

L'API de Surplasse a une particularité structurante : elle est consommée par trois frontends distincts. Onboarding, Commande et Dashboard sont trois applications React séparées (voir [ADR-0004](adr-0004-trois-frontends-react.md)), avec des cycles de développement propres, mais qui parlent toutes au même Backend. Chaque endpoint a donc potentiellement trois consommateurs, et chaque changement de forme (un champ renommé, un enum étendu, un code d'erreur ajouté) peut casser jusqu'à trois applications en silence si rien ne le détecte.

La deuxième contrainte est le typage de bout en bout. Le Backend est en Java, les frontends en TypeScript strict. Sans mécanisme partagé, la frontière HTTP est un trou dans le typage : les DTO Java et les types TypeScript sont maintenus à la main des deux côtés, et leur divergence n'est détectée qu'à l'exécution. Pour un développeur seul qui alterne entre les deux mondes, ce genre de bug est exactement celui qui coûte une soirée.

La troisième contrainte est méthodologique. Sur un projet solo, il n'y a pas de revue d'API par un pair : le seul moment où la conception d'un endpoint peut être examinée froidement, c'est avant son implémentation. Il faut donc un artefact de conception qui existe indépendamment du code, qu'on peut relire, faire évoluer et versionner comme un document.

La question est donc : où vit la vérité de l'API, et dans quel sens circule-t-elle ?

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Contract-first** : `api/openapi.yaml` écrit à la main, interfaces Java et clients TypeScript générés depuis lui | Source de vérité unique et neutre ; typage bout en bout garanti par génération ; le contrat est un lieu de conception relisible avant tout code ; les frontends peuvent démarrer sur des mocks dérivés du contrat | Chaîne de génération à installer et maintenir ; friction sur les petits changements (éditer le YAML puis régénérer, même pour un champ) ; qualité inégale des générateurs selon les cibles |
| **Code-first** : annotations sur le code Java, spec OpenAPI générée, clients TS générés depuis la spec | Aucune double saisie côté Backend ; la spec est toujours conforme à l'implémentation par construction | La conception se fait dans le code : les choix d'API sont pris en implémentant, pas en concevant ; la spec générée reflète les idiomes Java plutôt qu'un design d'API assumé ; le Backend devient bloquant pour tout travail frontend |
| **Pas de spec formelle** : appels `fetch` écrits à la main, types TypeScript maintenus manuellement | Zéro outillage, démarrage immédiat | Trois frontends à synchroniser à la main ; aucune détection de rupture avant l'exécution ; la connaissance de l'API n'existe que dans les têtes et les sources ; intenable au-delà de quelques endpoints |

## Décision

Nous retenons le **contract-first**. Le fichier `api/openapi.yaml` (OpenAPI 3.1) est la source de vérité de l'API, désigné dans toute la documentation comme **le contrat**. Le sens de circulation est unique et non négociable :

```
                        api/openapi.yaml
                          (le contrat)
                               |
              +----------------+----------------+
              | génération                      | génération
              v                                 v
   backend/contrat/                    frontends/shared/
   interfaces Java + DTO               client TypeScript typé
              |                                 |
              | implémente                      | consomment
              v                                 v
        Backend Quarkus              Onboarding, Commande, Dashboard
```

Le Backend implémente les interfaces générées ; les trois frontends consomment le client TypeScript généré, exposé par le package `frontends/shared/`. Le code généré n'est jamais édité à la main. Toute évolution de l'API commence par une modification du contrat, dans le même commit que les régénérations et les adaptations qu'elle entraîne (ce que rend possible le [monorepo, ADR-0001](adr-0001-monorepo.md)).

L'argument décisif est le rapport entre un producteur et trois consommateurs. Avec un seul frontend, le code-first serait défendable ; avec trois, la spec cesse d'être une courtoisie documentaire et devient l'interface contractuelle réelle du système. La faire dériver de l'implémentation reviendrait à laisser le Backend dicter sa forme aux trois autres applications.

Le second argument est que le contrat est le lieu de conception. Concevoir un endpoint dans le YAML, avec ses schémas, ses codes d'erreur et ses exemples, force à penser l'API du point de vue du consommateur avant d'écrire une ligne d'implémentation. La structure détaillée du contrat et ses conventions de nommage sont décrites dans [la page API](../architecture/api.md).

## Conséquences

### Positives

- Une rupture de contrat est une erreur de compilation, côté Java comme côté TypeScript : les trois frontends sont protégés au build, pas découverts cassés en production.
- Le typage est continu du schéma PostgreSQL à l'écran React, la frontière HTTP comprise.
- Les frontends peuvent être développés contre des mocks dérivés du contrat avant que l'endpoint n'existe côté Backend ; le contrat découple les chantiers.
- Le diff du fichier `api/openapi.yaml` est un journal lisible de l'évolution de l'API, complémentaire des ADR.
- Le contrat sert de documentation d'API exécutable (validation, exemples), sans doc parallèle à maintenir.

### Négatives et dettes assumées

- La chaîne de génération (générateur d'interfaces Java, générateur de client TypeScript, scripts d'orchestration) est un outillage à installer, versionner et maintenir ; ses montées de version peuvent produire des diffs générés bruyants. Charge assumée.
- Chaque changement d'API, même trivial, paie le cycle complet : éditer le YAML, régénérer, adapter. Cette friction est le prix de la cohérence et elle est assumée ; elle incite d'ailleurs à des évolutions d'API réfléchies plutôt qu'impulsives.
- Le support d'OpenAPI 3.1 est inégal selon les générateurs ; le choix précis des générateurs et leurs options restent à trancher lors de la mise en place de la chaîne, et pourront faire l'objet d'un ADR si le sujet s'avère structurant.
- Le code généré est parfois moins idiomatique que du code écrit à la main ; on s'interdit de le retoucher, quitte à vivre avec ses lourdeurs.

!!! warning Règle pratique
Si une divergence est constatée entre le contrat et une implémentation, c'est toujours l'implémentation qui est en tort. Corriger le code, jamais tordre le contrat pour ratifier un écart.
!!!
