---
label: Tickets GitHub
order: 10
icon: issue-opened
description: Règles utilisées par les skills pour lire, créer, trier et fermer les tickets GitHub de Surplasse.
---

# Suivi des tickets avec GitHub

Les tickets et leurs spécifications vivent dans GitHub Issues pour
`nclsppr/surplasse`. Exécuter la CLI `gh` depuis ce dépôt pour qu'elle résolve
le remote.

## Conventions

- Créer un ticket avec `gh issue create --title "..." --body "..."`. Utiliser
  un heredoc pour un corps sur plusieurs lignes.
- Lire un ticket avec
  `gh issue view <numéro> --json number,title,body,author,createdAt,updatedAt,state,labels,comments`.
- Lister les tickets avec
  `gh issue list --state open --limit 1000 --json number,title,body,labels,comments`,
  puis appliquer les filtres `--label`, `--state` et `--jq` nécessaires.
- Commenter avec `gh issue comment <numéro> --body "..."`.
- Ajouter ou retirer un label avec
  `gh issue edit <numéro> --add-label "..."` ou
  `gh issue edit <numéro> --remove-label "..."`.
- Fermer un ticket avec `gh issue close <numéro> --comment "..."`.

## Pull requests comme surface de triage

**PRs as a request surface: no.** Passer cette valeur à `yes` uniquement si les
pull requests externes doivent entrer dans la file de triage des tickets.

Si la valeur devient `yes`, utiliser les commandes `gh pr` correspondantes :

- Lire une pull request avec `gh pr view <numéro> --comments` et
  `gh pr diff <numéro>`.
- Lister les pull requests externes avec
  `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open&per_page=100' | jq -s 'add | map(select(.author_association == "CONTRIBUTOR" or .author_association == "FIRST_TIME_CONTRIBUTOR" or .author_association == "NONE"))'`.
- Commenter, étiqueter ou fermer avec `gh pr comment`, `gh pr edit` et
  `gh pr close`.

GitHub partage la même séquence de numéros entre tickets et pull requests. Pour
un numéro seul comme `#42`, exécuter `gh pr view 42`, puis
`gh issue view 42` si nécessaire.

## Opérations des skills

Lorsqu'un skill demande de publier dans le suivi des tickets, créer un ticket
GitHub. Lorsqu'il demande de récupérer le ticket concerné, exécuter
`gh issue view <numéro> --comments`.

## Opérations Wayfinder

La carte est un ticket unique. Ses tickets enfants portent le travail.

- Créer la carte avec le label `wayfinder:map`. Son corps contient Notes,
  Decisions-so-far et Fog.
- Relier chaque enfant avec les sous-tickets GitHub. Si cette fonction n'est
  pas disponible, ajouter l'enfant à une liste de tâches dans la carte et
  placer `Part of #<carte>` au début de son corps. Appliquer un seul label
  `wayfinder:<type>` parmi `research`, `prototype`, `grilling` et `task`.
- Représenter les blocages avec les dépendances de tickets GitHub. Ajouter une
  relation avec
  `gh api --method POST repos/<owner>/<repo>/issues/<enfant>/dependencies/blocked_by -F issue_id=<identifiant-base-du-bloquant>`.
  Obtenir cet identifiant avec
  `gh api repos/<owner>/<repo>/issues/<numéro> --jq .id`. Si les dépendances ne
  sont pas disponibles, placer `Blocked by: #<numéro>` au début du corps.
- Construire la frontière depuis les enfants ouverts de la carte. Retirer les
  tickets déjà assignés et ceux qui ont un blocage ouvert. Le premier ticket
  restant dans l'ordre de la carte est le prochain travail.
- Réclamer un enfant avec `gh issue edit <numéro> --add-assignee @me`. Cette
  commande est la première écriture de la session.
- Résoudre un enfant en publiant la réponse, en fermant le ticket, puis en
  ajoutant son pointeur de contexte et son lien dans Decisions-so-far.
