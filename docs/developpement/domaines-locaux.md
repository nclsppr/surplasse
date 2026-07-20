---
label: Domaines locaux
order: 15
icon: globe
description: Installation de surplasse.test, DNS wildcard, HTTPS mkcert, routage Caddy et cockpit des modules locaux.
---

# Domaines locaux et cockpit

Le développement local reproduit la topologie publique de Surplasse avec le domaine racine `surplasse.test`. Le DNS, le certificat et Caddy acceptent n'importe quel sous-domaine direct. Créer un établissement ne demande donc jamais de modifier `/etc/hosts`, le certificat ou le reverse proxy.

L'[ADR-0016](../decisions/adr-0016-topologie-domaines-locaux.md) consigne le choix de dnsmasq, mkcert, Caddy et du cockpit. Cette pile est réservée au développement. La production utilise `surplasse.com`, un DNS public et un certificat Let's Encrypt obtenu par défi DNS-01.

## Démarrage rapide sur macOS

Prérequis du démarrage nominal : Homebrew, Node.js 24, Java 21 et Docker démarré. Python 3 sert seulement à régénérer les assets QR de marque. Le premier setup installe `dnsmasq`, `nss`, `mkcert` et `caddy` avec Homebrew. `nss` permet aussi à mkcert d'enregistrer son autorité pour Firefox. Le script détecte `brew --prefix`, sur Apple Silicon comme sur Mac Intel.

Depuis la racine du dépôt :

```bash
# Install project dependencies once
npm ci
(cd frontends/shared && npm ci)
(cd frontends/commande && npm ci)
(cd frontends/dashboard && npm ci)

# Install the wildcard DNS and the local certificate once
npm run local:setup

# Start or reload the HTTPS reverse proxy
npm run local:proxy

# Open the module cockpit and keep this terminal open
npm run local:cockpit
```

Ouvrir ensuite `https://local.surplasse.test`. Le bouton « Démarrer le parcours principal » lance Mailpit, le Backend, Commande et le Dashboard. PostgreSQL suit automatiquement les Dev Services du Backend. L'Onboarding et la documentation peuvent être lancés séparément depuis leur carte.

Le cockpit ne lance jamais une commande `sudo`. Caddy doit donc être démarré avant lui. Les logs des processus Node, Java, Vite et Retype restent dans son terminal. Mailpit tourne en conteneur détaché : ses messages se lisent dans son interface ou avec `docker logs surplasse-mailpit`.

## Inventaire permanent des URL

La source de vérité est `config/domains/development.env`. Le cockpit affiche ces URL, leurs sondes et leur état. Les ports ne sont que les destinations internes de Caddy.

| URL HTTPS | Destination locale | État |
|---|---:|---|
| `https://surplasse.test` | Onboarding statique, port 4173 | Disponible |
| `https://www.surplasse.test` | Redirection vers l'apex | Disponible |
| `https://dashboard.surplasse.test` | Dashboard Vite, port 5174 | Disponible |
| `https://api.surplasse.test` | Backend Quarkus, port 8080 | Disponible |
| `https://docs.surplasse.test` | Retype, port 5005 | Disponible |
| `https://local.surplasse.test` | Cockpit Node, port 4174 | Développement seulement |
| `https://mail.surplasse.test` | Mailpit, port 8025 | Développement seulement |
| `https://app.surplasse.test` | Aucun module | Réservé, réponse 503 |
| `https://admin.surplasse.test` | Aucun module | Réservé, réponse 503 |
| `https://{slug}.surplasse.test` | Commande Vite, port 5173 | Wildcard établissement |

Les noms réservés sont `www`, `api`, `dashboard`, `docs`, `app`, `admin`, `local` et `mail`. Cette liste vit dans `RESERVED_SUBDOMAINS`. `app` et `admin` anticipent des usages possibles, mais ne doivent pas être présentés comme des applications existantes.

Un certificat wildcard ne couvre qu'un niveau. `chez-paul.surplasse.test` est valide, `table.chez-paul.surplasse.test` ne l'est pas.

## Ce que fait le setup macOS

`scripts/setup-local-domain.sh` est idempotent. Une nouvelle exécution conserve seulement une paire certificat et clé cohérente, signée par l'autorité mkcert courante, couvrant l'apex et le wildcard, et valide encore au moins sept jours. Sinon, elle la régénère. Le domaine installé est mémorisé dans `~/.config/surplasse/local-domain.state` : changer `APP_BASE_DOMAIN` retire l'ancien resolver et les anciennes feuilles avant d'installer le nouveau domaine.

Il réalise les opérations suivantes :

1. il lit et valide `config/domains/development.env` ;
2. il installe les formules Homebrew manquantes `dnsmasq`, `nss`, `mkcert` et `caddy` ;
3. il crée un LaunchAgent utilisateur `com.surplasse.local-dns` ;
4. il lance dnsmasq sur `127.0.0.1:53535`, limité à la zone `surplasse.test` ;
5. il délègue cette zone avec `/etc/resolver/surplasse.test` ;
6. il exécute `mkcert -install` ;
7. il crée le certificat et la clé sous `.certs/` ;
8. il vérifie une résolution wildcard directement auprès de dnsmasq.

Le certificat est équivalent à :

```bash
mkdir -p .certs
mkcert \
  -cert-file .certs/surplasse.test.pem \
  -key-file .certs/surplasse.test-key.pem \
  surplasse.test "*.surplasse.test"
```

`.certs/` est ignoré par Git. Ne jamais copier dans le dépôt la clé privée, les certificats locaux, `rootCA.pem` ou `rootCA-key.pem` de mkcert.

### Autorisations demandées

macOS demande une interaction ou un mot de passe administrateur pour :

- approuver l'autorité mkcert dans le trousseau système ;
- créer `/etc/resolver/surplasse.test` ;
- vider le cache DNS système ;
- faire écouter Caddy sur le port 443 ;
- créer et utiliser le socket d'administration Caddy protégé sous `/var/run/surplasse-local/`.

dnsmasq lui-même écoute sur le port non privilégié 53535 dans la session utilisateur. Le cockpit et tous les modules applicatifs restent sans privilège.

## Démarrer, arrêter et recharger Caddy

Le Caddyfile local vit dans `infra/local/Caddyfile`. Il écoute uniquement sur `127.0.0.1` et utilise le certificat mkcert. Son API d'administration n'écoute sur aucun port TCP : elle passe par `/var/run/surplasse-local/caddy-admin.sock`, dans un répertoire accessible uniquement à `root`. Les scripts emploient `sudo` pour valider la propriété, recharger ou arrêter cette instance.

```bash
# Validate, start, or reload the Surplasse instance
npm run local:proxy

# Stop only the Caddy instance identified as Surplasse
npm run local:proxy:stop
```

Le script refuse de recharger ou d'arrêter une instance inconnue derrière le socket d'administration. Si le socket existe mais ne répond plus, les commandes échouent sans le supprimer et demandent une inspection manuelle. Caddy conserve le `Host` original et reconstruit `X-Forwarded-Host`, `X-Forwarded-Proto` et `X-Forwarded-For`. Le Backend ne leur fait confiance qu'en profil de développement et seulement si la connexion vient de la boucle locale.

Le proxy route par nom d'hôte. Les restaurants ne reçoivent aucune entrée individuelle : le dernier handler wildcard transmet tout sous-domaine non réservé à Commande.

## Utiliser le cockpit

Le cockpit est un serveur Node.js 24 sans dépendance tierce. Il écoute sur `127.0.0.1:4174` et n'est jamais construit ni déployé en production.

```bash
# Start the cockpit
npm run local:cockpit

# Run its isolated test suite
npm run local:cockpit:test
```

Il classe les éléments en applications, outils, dépendances et domaines réservés. Pour chaque module, il affiche les URL utiles, le port, l'état et la dernière erreur courte. Les états distinguent notamment un module arrêté, en démarrage, prêt, dégradé, lancé hors du cockpit ou en conflit de port.

Seules des commandes déclarées dans `scripts/dev-cockpit/registry.mjs` peuvent être lancées. Le navigateur ne fournit jamais une commande, un argument ou un chemin. Le serveur vérifie `Host`, `Origin` et un jeton anti-CSRF pour toute mutation. Il écoute sur la boucle locale, n'active aucun CORS et ne montre ni secret, ni contenu d'email, ni magic link.

Un processus lancé hors du cockpit peut être détecté, mais son bouton d'arrêt reste désactivé. Un arrêt depuis l'interface ne vise que le groupe de processus créé par cette instance du cockpit. Mailpit reçoit un label Docker de propriété équivalent. Fermer le cockpit tente d'arrêter ses propres processus, jamais les autres.

Caddy, dnsmasq et mkcert restent hors de ce registre car leur cycle de vie nécessite des droits système. Stripe CLI reste manuel car sa session est interactive et fournit les deux secrets `whsec_...` des destinations de paiement et Accounts v2.

## Tester un nouvel établissement

Aucune installation supplémentaire n'est nécessaire. Avec Commande et le Backend démarrés :

```bash
curl -I https://restaurant-invente.surplasse.test

# macOS
open 'https://le-cormoran.surplasse.test/?table=tbl_2f8e6a4c0b9d7e1f'

# Linux desktop; on WSL2, paste the URL into the selected browser
xdg-open 'https://le-cormoran.surplasse.test/?table=tbl_2f8e6a4c0b9d7e1f'
```

Commande extrait seulement un sous-domaine direct. Elle refuse un nom réservé, un suffixe trompeur tel que `le-cormoran.surplasse.test.example` et un nom imbriqué. L'extraction utilise `APP_BASE_DOMAIN`, jamais une hypothèse sur `.com`.

Le routage wildcard peut servir l'application pour n'importe quel nom valide. Le Backend doit cependant connaître l'établissement pour que sa carte se charge. Le seed actuel contient `le-cormoran`. Un nom inventé confirme donc le DNS, le certificat, Caddy et le chargement de Commande, pas l'existence d'une carte en base.

## Vérifier DNS, certificat et services

Sur macOS, vérifier d'abord dnsmasq puis la résolution système :

```bash
# Direct dnsmasq wildcard response
dig +short @127.0.0.1 -p 53535 restaurant-invente.surplasse.test A

# macOS scoped resolver
dscacheutil -q host -a name restaurant-invente.surplasse.test
scutil --dns | grep -A6 'surplasse.test'
```

Les deux premières commandes doivent faire apparaître `127.0.0.1`. Vérifier ensuite le certificat et le routage :

```bash
openssl x509 \
  -in .certs/surplasse.test.pem \
  -noout -subject -issuer -ext subjectAltName

curl -I https://surplasse.test
curl -I https://api.surplasse.test
curl -I https://dashboard.surplasse.test
curl -I https://demo.surplasse.test
curl -I https://restaurant-invente.surplasse.test
curl -I https://admin.surplasse.test
```

Une erreur 502 signifie que DNS, TLS et Caddy fonctionnent, mais que le module de destination est arrêté. Une réponse 503 sur `app` ou `admin` est volontaire. Le cockpit aide à distinguer ces cas.

## Régénérer le certificat

Le certificat couvre déjà l'apex et tous les futurs sous-domaines directs. Il n'est pas régénéré à chaque restaurant. Le renouveler après expiration ou après un changement du domaine de base :

```bash
npm run local:certificates:regenerate
npm run local:proxy
```

Le setup remplace seulement les deux fichiers feuille sous `.certs/`. Il conserve l'autorité mkcert partagée avec les autres projets.

## Désinstaller

```bash
npm run local:proxy:stop
npm run local:remove
```

La suppression arrête le LaunchAgent dnsmasq de Surplasse, retire sa configuration utilisateur, supprime chaque resolver connu seulement s'il porte le marqueur Surplasse, puis efface les certificats feuille correspondants du dépôt. Elle vérifie à la fois le dernier domaine mémorisé et le profil de développement courant afin de nettoyer aussi une migration interrompue. Elle ne désinstalle ni les formules Homebrew, ni l'autorité mkcert, car elles peuvent servir à d'autres projets.

Pour retirer aussi l'autorité mkcert, utiliser séparément la procédure officielle de mkcert après avoir vérifié qu'aucun autre projet local ne l'utilise.

## Configuration publique et production

Les deux fichiers versionnés ne contiennent aucun secret :

| Fichier | Usage |
|---|---|
| `config/domains/development.env` | `.test`, Vite en mode développement, Backend local, Caddy et cockpit |
| `config/domains/production.env` | `.com`, builds Vite de production et future pile VPS |

Ils définissent le schéma, le domaine racine et les URL canoniques. Les frontends les chargent au build. L'Onboarding statique reçoit un `runtime-config.js` généré et vérifié en CI. Le Backend consomme les mêmes noms sous forme de variables d'environnement.

`COOKIE_DOMAIN` est présent et vide pour rendre la décision visible. Les cookies `surplasse_session` et `surplasse_refresh` restent hôte uniquement sur `api.surplasse.test` ou `api.surplasse.com`. Ils sont `Secure`, `HttpOnly` et `SameSite=Lax`. Définir `.surplasse.test` exposerait une session restaurateur à tous les mini-sites.

Le CORS local accepte seulement l'apex et un sous-domaine HTTPS direct de `surplasse.test`. Le Backend reçoit cette liste dans `CORS_PUBLIC_ORIGINS` et n'autorise jamais les credentials. Caddy les ajoute seulement pour les origines exactes du Dashboard et de l'Onboarding. Les mini-sites accèdent aux routes publiques sans credentials. La configuration `%prod` applique le même refus par défaut avec les origines `.com`.

Le contrôle automatisé lance un Caddy éphémère avec Docker et vérifie les réponses pour le Dashboard, l'Onboarding, un mini-site et une origine externe :

```bash
npm run local:cors:test
```

Toute future URL de restaurant, de QR code, d'email, d'authentification ou de paiement consomme cette configuration. Les retours Stripe actuels utilisent l'URL du navigateur, qui garde naturellement `.test` en local et `.com` en production.

Après une modification d'un profil, régénérer l'Onboarding et les QR, puis lancer les contrôles de fraîcheur :

```bash
npm run domains:generate
python3 scripts/generate_brand_assets.py
npm run domains:check
```

## Linux et Windows avec WSL2

Le setup et la suppression automatiques refusent Linux et WSL2 avant toute modification système. Les scripts de Caddy et tous les modules applicatifs restent portables. La procédure suivante cible Ubuntu LTS et les distributions Debian récentes avec `systemd-resolved`.

### Ubuntu avec un navigateur Linux

Installer les logiciels de développement. `python3-venv` n'est requis que pour régénérer les QR :

```bash
sudo apt update
sudo apt install dnsmasq dnsutils libnss3-tools mkcert caddy python3-venv

# The project owns the Caddy process; disable the distribution service
sudo systemctl disable --now caddy
mkcert --version
caddy version
```

Créer la configuration DNS wildcard explicite :

```bash
sudo tee /etc/dnsmasq.d/surplasse-local.conf >/dev/null <<'EOF'
# Managed manually for Surplasse local development.
port=53535
listen-address=127.0.0.1
bind-interfaces
no-resolv
no-hosts
domain-needed
local=/surplasse.test/
address=/surplasse.test/127.0.0.1
EOF

sudo dnsmasq --test
sudo systemctl enable --now dnsmasq
```

Déclarer ensuite une route persistante `systemd-resolved` vers ce port. Avant de continuer, `resolvectl status lo` permet de vérifier qu'aucun autre outil ne gère déjà le lien loopback :

```bash
sudo tee /etc/systemd/system/surplasse-local-resolver.service >/dev/null <<'EOF'
[Unit]
Description=Route the Surplasse local domain to dnsmasq
After=dnsmasq.service systemd-resolved.service
Requires=dnsmasq.service systemd-resolved.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/resolvectl dns lo 127.0.0.1:53535
ExecStart=/usr/bin/resolvectl domain lo ~surplasse.test
ExecStop=/usr/bin/resolvectl revert lo

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now surplasse-local-resolver.service
```

Installer l'autorité et générer la feuille locale depuis la racine du dépôt :

```bash
mkcert -install
mkdir -p .certs
mkcert \
  -cert-file .certs/surplasse.test.pem \
  -key-file .certs/surplasse.test-key.pem \
  surplasse.test "*.surplasse.test"
chmod 600 .certs/surplasse.test-key.pem

dig +short @127.0.0.1 -p 53535 demo.surplasse.test A
resolvectl query demo.surplasse.test
npm run local:proxy
npm run local:cockpit
```

Le premier démarrage de Caddy demande `sudo` pour le port 443. L'arrêt applicatif utilise `Ctrl+C` pour le cockpit et `npm run local:proxy:stop` pour Caddy. Pour suspendre seulement la route DNS :

```bash
sudo systemctl stop surplasse-local-resolver.service
sudo systemctl start surplasse-local-resolver.service
```

Pour désinstaller la configuration Surplasse, sans retirer les paquets ni l'autorité mkcert partagée :

```bash
npm run local:proxy:stop
sudo systemctl disable --now surplasse-local-resolver.service
sudo rm -f /etc/systemd/system/surplasse-local-resolver.service
sudo rm -f /etc/dnsmasq.d/surplasse-local.conf
sudo systemctl daemon-reload
sudo systemctl restart dnsmasq
rm -f .certs/surplasse.test.pem .certs/surplasse.test-key.pem
rmdir .certs 2>/dev/null || true
```

Cette pile DNS, mkcert et cockpit est réservée au développement. Elle n'est jamais installée sur le VPS de production, où le DNS est public et le Caddy Compose cible utilise Let's Encrypt.

### Ubuntu sous WSL2 avec un navigateur WSLg

Suivre exactement la procédure Ubuntu précédente. Les commandes du dépôt, leur démarrage, leur santé et leur arrêt sont identiques. Le navigateur WSLg utilise la confiance NSS installée par `mkcert -install` dans la distribution.

### WSL2 avec un navigateur Windows

Le chemin recommandé nécessite Windows 11 avec le réseau WSL en mode miroir. Dans `%UserProfile%\.wslconfig` côté Windows :

```ini
[wsl2]
networkingMode=mirrored
dnsTunneling=true
firewall=true
```

Appliquer ce changement depuis PowerShell, puis adapter dnsmasq dans Ubuntu au port DNS standard attendu par Windows :

```powershell
wsl --shutdown
```

```bash
# Run inside Ubuntu after WSL has restarted
sudo sed -i 's/^port=53535$/port=53/' /etc/dnsmasq.d/surplasse-local.conf
sudo sed -i 's/127\.0\.0\.1:53535/127.0.0.1/' /etc/systemd/system/surplasse-local-resolver.service
sudo systemctl daemon-reload
sudo systemctl restart dnsmasq surplasse-local-resolver.service

WINDOWS_PROFILE="$(wslpath "$(cmd.exe /c 'echo %USERPROFILE%' | tr -d '\r')")"
cp "$(mkcert -CAROOT)/rootCA.pem" "${WINDOWS_PROFILE}/Downloads/surplasse-mkcert-rootCA.pem"
```

Dans un PowerShell lancé comme administrateur, ajouter la règle DNS et l'autorité publique :

```powershell
Add-DnsClientNrptRule -Namespace ".surplasse.test" -NameServers "127.0.0.1"
certutil.exe -addstore -f Root "$env:USERPROFILE\Downloads\surplasse-mkcert-rootCA.pem"

Resolve-DnsName demo.surplasse.test
curl.exe -I https://demo.surplasse.test
```

Ne jamais copier ni importer `rootCA-key.pem`. Les modules se lancent toujours dans Ubuntu avec `npm run local:proxy` puis `npm run local:cockpit`. Pour retirer l'intégration Windows :

```powershell
Get-DnsClientNrptRule |
  Where-Object Namespace -eq '.surplasse.test' |
  Remove-DnsClientNrptRule -Force
Remove-Item "$env:USERPROFILE\Downloads\surplasse-mkcert-rootCA.pem" -ErrorAction SilentlyContinue
```

L'autorité mkcert n'est pas supprimée automatiquement du magasin Windows, car elle peut servir à d'autres projets. La retirer exige d'identifier son empreinte dans `Cert:\LocalMachine\Root`. Hors mode miroir, l'adresse WSL change et demanderait une règle NRPT à maintenir : ce chemin n'est pas supporté. Le développement Windows natif reste non supporté, toutes les commandes s'exécutent dans Ubuntu sous WSL2.

## Dépannage

| Symptôme | Vérification | Action |
|---|---|---|
| Le navigateur signale un certificat inconnu | `mkcert -CAROOT`, puis présence de `.certs/surplasse.test.pem` | relancer le setup et accepter l'ajout au trousseau |
| Un domaine ne résout pas | requêtes `dig` et `dscacheutil` ci-dessus | relancer le LaunchAgent avec le setup, puis vider le cache DNS |
| Caddy répond 502 | carte correspondante dans le cockpit | démarrer le module ciblé |
| Caddy refuse de démarrer | `lsof -nP -iTCP:443 -sTCP:LISTEN` et `/var/run/surplasse-local/caddy-admin.sock` | arrêter le processus concurrent, ne pas modifier les ports Surplasse |
| Vite répond 403 | vérifier le hostname demandé | utiliser l'apex ou un sous-domaine direct de `surplasse.test` |
| HMR ne se reconnecte pas | console réseau du navigateur | vérifier que la page est ouverte en HTTPS via Caddy, pas par le port Vite |
| Le Dashboard perd sa session | URL de la page et URL de l'API | utiliser `dashboard.surplasse.test` avec `api.surplasse.test`, sans retour à localhost |

## Ajouter un futur module ou logiciel

Le commit qui introduit un processus local met à jour les cinq endroits suivants :

1. `config/domains/` s'il reçoit un domaine ;
2. `infra/local/Caddyfile` s'il reçoit une route ;
3. `scripts/dev-cockpit/registry.mjs` s'il peut être piloté sans privilège ;
4. cette page avec installation, configuration, lancement, santé, arrêt, plateformes et destination de production ;
5. `docs/operations/` si le module existe aussi sur Ubuntu LTS en production.

Une bibliothèque sans processus documente seulement sa commande de test. Un logiciel interactif ou privilégié reste manuel et apparaît comme dépendance, jamais comme commande arbitraire dans le cockpit.
