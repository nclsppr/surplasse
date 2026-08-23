# Instructions du dépôt

- Pour tout travail dans `docs/`, lire et appliquer `docs/AGENTS.md`. Ces instructions documentaires s'appliquent uniquement à `docs/`.
- Toute tâche qui prévoit ou exige le déploiement, la rotation ou la révocation d'un secret sur Atlas doit aussi mettre à jour `nclsppr/vps-infra` avant sa clôture. Ajouter ou mettre à jour ce secret dans `secrets/registry.json`, le registre canonique requis pour reconstruire Atlas depuis un hôte vierge. Versionner seulement le contrat et les métadonnées, jamais la valeur, un condensat dérivé de la valeur, un fichier déchiffré ou un chemin source privé. Si la tâche n'autorise pas la modification de `vps-infra`, signaler le blocage et ne pas déclarer le travail terminé.
