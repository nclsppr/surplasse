# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Surplasse sert trois publics reliés par le même parcours. Le restaurateur indépendant découvre le produit, crée ou revendique son établissement, puis pilote son activité. Les membres d'équipe travaillent pendant le service depuis les vues Salle, Cuisine ou Gestion selon leur rôle. Le client consulte la carte, commande et paie à table ou à emporter, sans application ni compte.

## Product Purpose

Surplasse donne aux restaurants indépendants leur propre canal de commande directe. À partir des informations de l'établissement, d'une photo de la carte et de visuels maîtrisés, le produit structure une carte numérique, publie un mini-site, permet la commande et le paiement, puis transmet la commande à l'équipe en temps réel.

Le succès signifie que le restaurant peut exploiter ce canal sans projet informatique, que le client termine son parcours rapidement sur mobile et que l'équipe garde une lecture fiable de chaque commande pendant le service.

## Positioning

Surplasse n'est pas une marketplace. Le restaurant conserve son identité, ses prix, ses clients et sa relation directe. Le mécanisme distinctif relie un QR à table, une carte numérique propre à l'établissement, un paiement intégré et un Dashboard opérationnel dans un seul canal maîtrisé par le restaurant. Le slogan est « Le circuit court de la commande. »

## Operating Context

Onboarding est une vitrine et un tunnel d'embarquement pour des restaurateurs très sollicités. Commande est utilisée sur téléphone, souvent en 4G et parfois d'une seule main après le scan d'un QR. Dashboard reste ouvert pendant des heures sur téléphone, tablette ou poste fixe, dans des environnements de salle et de cuisine où la vitesse de lecture, les cibles tactiles et la visibilité des états priment.

Trois applications web distinctes consomment un Backend Quarkus et un contrat OpenAPI uniques. Les domaines publics viennent des profils centralisés. Les frontends ne codent jamais de suffixe de domaine ni d'origine de repli.

## Capabilities and Constraints

- React 19, TypeScript strict, Vite, React Router et TanStack Query forment le socle frontend.
- `frontends/shared/` reste la source du client API généré, des clés de requête et des utilitaires transverses.
- Commande doit rendre la carte interactive en moins de deux secondes sur un réseau 4G moyen. Son bundle reste mesuré séparément.
- L'authentification restaurateur repose sur des cookies hôte uniquement émis par le Backend. Le Dashboard utilise les appels avec credentials et un flux SSE par établissement.
- Les textes visibles passent par la couche i18n. La terminologie canonique du dépôt s'applique à toutes les variantes.
- Les quatre SVG de `brand/` restent les seules sources du logo. Ils ne sont ni reconstruits, ni recolorés.
- L'expérience demandée ajoute Onboarding2, Commande2 et Dashboard2 comme implémentations visuelles alternatives. Elles doivent préserver les mêmes règles fonctionnelles et peuvent être retirées sans migration de données ni modification du Backend. Une tranche qui passe encore vers l'original, comme le tunnel d'Onboarding2 actuel, reste signalée comme non paritaire.
- Le nouveau système est fondé uniquement sur le dépôt public MIT d'Untitled UI React. Les ressources PRO ne sont pas incluses sans décision de licence séparée.
- Aucune variante expérimentale ne devient une cible de production sans nouvelle décision documentée.

## Brand Commitments

Le nom Surplasse, le slogan, l'orange de signature `#FA550C` et les SVG canoniques sont fixes. Archivo reste la police d'interface auto-hébergée. Les noms d'établissement peuvent utiliser Parisienne dans un contexte éditorial, sans jamais reconstituer le mot-symbole Surplasse.

La marque doit montrer le produit en action et rester distincte d'une marketplace, d'un faux terminal technique et du décor générique d'un restaurant. Les surfaces destinées aux établissements laissent l'identité du restaurant s'exprimer sans sacrifier l'accessibilité, le prix, la navigation ou la performance.

## Evidence on Hand

Le dépôt contient un Backend exécutable, un contrat OpenAPI, le client TypeScript généré, Commande et un premier Dashboard couverts par des tests, ainsi qu'un Onboarding statique et une démonstration interactive. Les assets de marque et les QR de démonstration sont versionnés sous `brand/`.

Aucun témoignage client, volume d'usage, benchmark commercial ou preuve de conversion ne doit être inventé. Les données de démonstration restent explicitement présentées comme synthétiques.

## Product Principles

1. Préserver le canal direct et la propriété de la relation client.
2. Montrer l'état réel du système, surtout pendant le paiement et le service.
3. Faire disparaître la complexité technique derrière des parcours courts et réversibles.
4. Garder une source de vérité unique pour le contrat, les données, les domaines et les règles métier.
5. Comparer les choix de présentation avec des preuves de parité, d'accessibilité et de performance.

## Accessibility & Inclusion

Les trois applications visent WCAG 2.2 niveau AA. Les parcours doivent fonctionner au clavier et au lecteur d'écran, ne jamais dépendre de la couleur seule, respecter la réduction du mouvement et conserver des cibles tactiles d'au moins 44 x 44 px sur Commande. Les thèmes propres aux établissements restent soumis aux mêmes contrôles de contraste.
