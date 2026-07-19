---
label: "ADR-0008 : Magic link restaurateur"
order: 80
icon: law
description: Authentification des restaurateurs par magic link envoyé par email, et absence totale de compte pour le client final.
---

# ADR-0008 : Authentification des restaurateurs par magic link, clients sans compte

## Statut

**Accepté**, 2026-07-18.

## Contexte

Surplasse a deux populations d'utilisateurs aux besoins d'authentification radicalement différents.

### Le restaurateur

Le restaurateur accède au Dashboard pour suivre ses commandes en temps réel, gérer sa carte et consulter ses métriques. Il s'authentifie aussi lors de l'[embarquement](../produit/parcours/onboarding-restaurateur.md) et lors de la revendication de son espace pré-généré. C'est un professionnel souvent pressé, peu appétent pour les outils informatiques, qui jongle déjà avec des dizaines de comptes (fournisseurs, banque, réseaux sociaux, plateformes de livraison). Un mot de passe de plus est un irritant réel : oublié, réinitialisé, noté sur un papier près de la caisse, partagé avec l'équipe.

### Le client

Le client scanne un QR code à table, consulte la carte, commande et paie. Le principe produit est sans ambiguïté depuis la [vision](../produit/vision.md) : sans application ni compte. Toute friction d'inscription sur ce parcours détruirait la promesse du produit. La question de l'authentification du client final n'est donc pas « comment », mais « comment garantir qu'il n'y en a jamais besoin ».

### Faits qui cadrent la décision

| Fait | Conséquence |
|---|---|
| L'email est déjà le canal de la relation avec le restaurateur | Revendication de l'espace, notifications, factures : tout passe par l'email. Il est de fait l'identifiant naturel. |
| Une base de mots de passe est un actif à protéger | Hachage, politique de complexité, détection de fuite, parcours de réinitialisation : autant de code et de risque évitables (voir [Sécurité](../architecture/securite.md)). |
| Un seul type d'utilisateur authentifié au MVP | Pas d'équipes, pas de rôles, pas de fédération d'identité à ce stade. Un serveur d'identité complet serait sans objet. |
| La réinitialisation de mot de passe passe par l'email de toute façon | Toute solution à mot de passe hérite déjà de la dépendance à la délivrabilité email, sans en tirer la simplicité. |

## Options considérées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Magic link par email** | Aucun mot de passe à créer ni à retenir : les restaurateurs n'en veulent pas un de plus. Aucune base de mots de passe à protéger. S'appuie sur l'email, qui est de toute façon le canal de la relation. Connexion et revendication unifiées par un jeton opaque à usage unique. | Dépendance à la délivrabilité email : un lien en spam est une connexion échouée. Sessions à concevoir et gérer nous-mêmes. Légère latence à la connexion (aller-retour boîte mail). |
| **Email et mot de passe** | Modèle universellement compris, connexion immédiate sans dépendre de la boîte mail à chaque session. | Base de mots de passe à protéger, parcours de réinitialisation à construire (qui repose in fine sur l'email, donc la dépendance demeure), mots de passe faibles ou réutilisés inévitables sur cette population, credential stuffing possible. |
| **OIDC avec Keycloak autohébergé** | Standard ouvert, gestion fine des rôles et des équipes, SSO possible, chemin tout tracé vers des besoins d'entreprise. | Une pièce mobile lourde de plus à opérer (déploiement, sauvegardes, mises à jour de sécurité, thème de connexion) pour un seul type d'utilisateur au MVP. Complexité sans bénéfice immédiat. |

### Analyse

**Email et mot de passe** est l'option par défaut de l'industrie, mais elle cumule le pire des deux mondes pour Surplasse : elle ajoute une base de secrets à protéger et un parcours de réinitialisation à construire, tout en conservant la dépendance à l'email (la réinitialisation passe par lui). Sur la population visée, les mots de passe seront faibles, réutilisés ou affichés près de la caisse : la sécurité théorique du modèle ne survivrait pas au terrain.

**Keycloak** répond à des questions que Surplasse ne se pose pas encore : rôles, équipes, fédération, SSO. C'est un excellent outil, mais c'est un service à part entière à déployer, sauvegarder, superviser et mettre à jour, sur une infrastructure (VPS avec Docker Compose) que l'on veut garder minimale. L'opérer pour servir un unique type d'utilisateur au MVP serait un contresens.

**Le magic link** aligne la sécurité sur la réalité de l'usage : la boîte mail du restaurateur est déjà, de fait, la clé de son compte (comme elle l'est chez tous les concurrents via « mot de passe oublié »). Autant en faire le mécanisme officiel, supprimer les mots de passe, et concentrer l'effort de durcissement sur un seul chemin.

## Décision

**Les restaurateurs s'authentifient par magic link envoyé par email. Le client final n'a jamais de compte.**

### Côté restaurateur

```
Restaurateur           Dashboard              Backend               Boîte mail
     |                     |                     |                      |
     |  saisit son email   |                     |                      |
     |-------------------->|  demande de lien    |                      |
     |                     |-------------------->|  jeton opaque,        |
     |                     |                     |  usage unique,       |
     |                     |                     |  durée courte        |
     |                     |                     |--------------------->|
     |  ouvre l'email et clique sur le lien      |                      |
     |<--------------------------------------------------------------- |
     |-------------------------------------------->  session ouverte   |
```

- Le restaurateur saisit son email sur le Dashboard ou dans le tunnel d'embarquement. Le backend émet un jeton aléatoire opaque, à usage unique et à durée de vie courte. Seule son empreinte est conservée en base et le lien envoyé par email transporte le jeton en clair jusqu'à la page intermédiaire.
- La [revendication](../produit/parcours/onboarding-restaurateur.md) d'un espace pré-généré repose sur la même mécanique : prouver le contrôle d'une adresse email légitime pour l'établissement suffit à prendre possession de l'espace.
- Les sessions restaurateur suivent le modèle décrit dans la page [Sécurité](../architecture/securite.md) : jeton de session à durée courte, renouvellement révocable, cookies durcis, déconnexion de tous les appareils possible. L'émission des liens est limitée en fréquence pour empêcher l'inondation d'une boîte mail.

### Côté client

- Le client final reçoit un **jeton de session anonyme lié à l'établissement et à la table** au moment du scan du QR code. Ce jeton porte le panier et la commande, rien d'autre. Aucune inscription, aucune donnée d'identité exigée.
- C'est un principe produit autant qu'une décision technique : il est non négociable au même titre que l'absence d'application, et il réduit d'autant le périmètre [RGPD](../operations/rgpd.md) côté client.

### Keycloak et OIDC : écartés, pas rejetés

Keycloak et OIDC ne sont pas rejetés définitivement : ils sont **écartés au MVP**. Si des équipes, des rôles par établissement ou une fédération d'identité apparaissent au catalogue des besoins, une migration vers un fournisseur OIDC sera réévaluée par un nouvel ADR. Le backend garde cette porte ouverte en isolant l'authentification derrière une interface unique, et le contrat décrit l'authentification en termes de sessions, pas de mécanique d'emails.

### Paramètres fixés et ouverts

La page [Sécurité](../architecture/securite.md) et le contrat fixent les durées du parcours restaurateur. Les paramètres qui ne conditionnent pas encore l'implémentation restent ouverts :

| Paramètre | Valeur | Statut |
|---|---|---|
| Durée de validité du magic link | 15 minutes | Fixé |
| Nombre d'utilisations d'un lien | Un seul, strictement | Fixé par cet ADR |
| JWT de session | 15 minutes | Fixé |
| Refresh token | 30 jours, rotation à chaque usage | Fixé |
| Limitation d'émission des liens | Par email et par adresse IP ; seuils configurables | Principe fixé, seuils à calibrer |
| Durée du jeton de session anonyme client | Le temps du repas, pas plus | À trancher |
| Fournisseur d'email transactionnel | Acteur spécialisé avec suivi de délivrabilité | À trancher (voir [Intégrations](../architecture/integrations.md)) |

### Portée des cookies

Les deux cookies restaurateur sont **hôte uniquement pour l'API**, soit `api.surplasse.com` en production et `api.surplasse.test` en développement. Aucun attribut `Domain` n'est posé. Le Dashboard et l'Onboarding peuvent néanmoins les utiliser : les requêtes visent l'API, qui est précisément l'hôte du cookie, et le navigateur les envoie avec les credentials. Le flux `EventSource` du Dashboard suit la même règle avec `withCredentials: true`.

Le choix écarte volontairement `Domain=.surplasse.com` et `Domain=.surplasse.test`. Cette portée élargie n'apporte rien au parcours et rendrait les cookies disponibles lors des requêtes vers chaque mini-site. Les cookies restent `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` pour le JWT et `Path=/v1/auth/sessions` pour le refresh token. Le développement local utilise HTTPS avec mkcert afin de tester exactement cet invariant.

### Coordination de la rotation entre onglets

La réutilisation d'un refresh token déjà tourné révoque toute sa famille. Le Dashboard doit donc empêcher deux onglets de renouveler simultanément la même session. Chaque renouvellement prend le Web Lock exclusif `surplasse:restaurateur-session-refresh`. Après acquisition, l'onglet relit la session courante avant toute rotation : une réponse authentifiée signifie qu'un autre onglet a déjà renouvelé les cookies et la requête initiale peut être rejouée. Une réponse 401 autorise un unique appel de rotation sous le verrou.

Le canal BroadcastChannel `surplasse:restaurateur-session` propage la session restaurateur non secrète après une connexion ou un renouvellement, ainsi que l'effacement de session après une déconnexion. Les cookies restent `HttpOnly` et ne transitent jamais par ce canal. Si Web Locks n'est pas disponible, le Dashboard échoue de manière sûre au premier JWT expiré : il efface son état local et demande une nouvelle connexion, sans tenter de rotation concurrente. Ce choix évite toute tolérance idempotente supplémentaire dans le Backend.

!!! warning Le fournisseur d'email devient critique
Avec le magic link, l'envoi d'email n'est plus une commodité : c'est le chemin de connexion. Le choix du fournisseur d'email transactionnel (délivrabilité, SPF, DKIM, DMARC, supervision des rebonds) reste à trancher et sera traité dans la page [Intégrations](../architecture/integrations.md).
!!!

## Conséquences

### Positives

- **Aucun secret d'authentification réutilisable en base** : la compromission de la base de données ne livre aucun mot de passe, ni côté restaurateur ni côté client (il n'y a pas de compte client).
- **Un parcours de connexion aligné sur la population visée** : pas de mot de passe à inventer à la caisse un midi de service, pas de parcours « mot de passe oublié » à construire ni à supporter.
- **Connexion et revendication partagent la même mécanique** de jeton opaque envoyé par email : moins de code, moins de surface d'attaque, une seule chose à durcir.
- **Le parcours client reste sans friction** : scanner, commander, payer. La promesse « sans application ni compte » est tenue par construction.
- **Surface opérationnelle minimale au MVP** : pas de serveur d'identité à déployer, sauvegarder et mettre à jour sur le VPS.
- **Périmètre de données personnelles réduit** : pas de compte client, pas de profil, pas d'historique nominatif côté client final.

### Négatives et dettes assumées

- **La délivrabilité email conditionne l'accès au produit** : le fournisseur SMTP devient un composant critique, à superviser comme tel (voir [Observabilité](../operations/observabilite.md)). Un incident de délivrabilité est un incident d'authentification.
- **La gestion de session est à notre charge** : émission, durée de vie, renouvellement, révocation, protection des jetons. C'est précisément ce qu'un serveur d'identité aurait fourni ; nous assumons de l'écrire et de le tester nous-mêmes, en le spécifiant dans le contrat.
- **La sécurité du compte restaurateur repose sur celle de sa boîte mail** : une boîte compromise donne accès au Dashboard. Dette assumée, identique en pratique à celle du parcours « mot de passe oublié » des solutions classiques.
- **La connexion est un peu plus lente qu'avec un mot de passe** (aller-retour par la boîte mail) : des sessions suffisamment longues côté Dashboard, sur l'appareil habituel du restaurateur, rendent cette friction rare en pratique.
- **Une migration OIDC ultérieure aura un coût** (reprise des sessions, nouveau parcours de connexion) : l'isolation de l'authentification derrière une interface unique du backend vise à le contenir, pas à l'annuler.

### Critères de remise en cause

La décision sera réexaminée par un nouvel ADR si l'un de ces signaux apparaît :

- un besoin d'équipes ou de rôles par établissement (serveurs avec accès restreint au Dashboard, gérant multi-établissements avec délégations) : c'est le déclencheur prévu de la réévaluation OIDC ;
- un taux d'échec de connexion lié à la délivrabilité email qui devient un motif de contact support récurrent ;
- une demande forte et vérifiée des restaurateurs pour un mode de connexion alternatif (code à usage unique par SMS, passkeys), qui serait alors étudié en complément du magic link plutôt qu'en remplacement.
