# Maintenance — notes d'environnement

## Génération du client Prisma dans cet environnement de développement (Claude)

`pnpm db:generate` échoue ici avec `403 Forbidden` sur `binaries.prisma.sh` : le bac à sable réseau de cette session limite les sorties à quelques registres (npm, GitHub) et ce domaine n'y figure pas. **Ce n'est pas une erreur du schéma ni du code** — sur une machine de développement normale ou un runner CI avec accès internet complet, `pnpm db:generate` fonctionnera sans modification.

À vérifier/relancer dès que le projet tourne hors de ce bac à sable (poste local, CI, serveur de build) :

```bash
pnpm install
pnpm db:generate   # télécharge le moteur Prisma, nécessite un accès réseau complet
pnpm --filter @eleganz/api build
```

Si l'environnement cible impose aussi des restrictions réseau, configurer `PRISMA_ENGINES_MIRROR` vers un miroir interne plutôt que `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING` (qui ne contourne pas un blocage réseau, seulement une vérification de somme de contrôle).

Conséquence pratique : `apps/api` n'a jamais pu être compilé (`tsc`/`nest build`) dans ce bac à sable, puisqu'il dépend des types générés par Prisma. Le premier vrai build a eu lieu sur Railway (12 octobre 2026) et a révélé deux catégories d'erreurs invisibles jusque-là :
- Deux vrais bugs de types (corrigés) : `SubscriptionPlansService` passait un `Record<string, unknown>` brut là où Prisma attend `Prisma.InputJsonValue` (`featuresJson`), et `ShopMembershipGuard` lisait `request.params.shopId` sans caster (`@types/express@5` type les paramètres de route en `string | string[]`).
- Une vague d'erreurs `TS2742` (« inferred type cannot be named without a reference to .../prisma/client/runtime/library ») sur quasiment toutes les méthodes retournant directement une requête Prisma — cause : `"declaration": true` dans `apps/api/tsconfig.json` (hérité du starter NestJS), qui n'a aucune utilité ici puisque l'API n'est jamais consommée comme bibliothèque compilée. Mis à `false`, ce qui a éliminé la vague d'erreurs d'un coup sans toucher au code applicatif.

## Application automatique du schéma en production (`prisma db push`)

`@prisma/client` régénère bien le client à chaque `pnpm install` (son propre
hook `postinstall` lance `prisma generate`), mais ça ne crée jamais les
colonnes/tables côté base — ça ne fait que régénérer du code TypeScript. Tant
qu'aucune étape ne lance `prisma db push` (ou `migrate deploy`), un champ
ajouté au schéma (ex. `Order.buyerWhatsapp`, le modèle `Review`) reste invisible
en base même après déploiement, et l'API plante dès qu'elle essaie de lire/
écrire ce champ.

Depuis le 12 octobre 2026, `apps/api`'s `start` script (`package.json`) lance
`prisma db push --accept-data-loss --skip-generate` avant `node dist/main.js` —
donc chaque redémarrage Railway du service API applique automatiquement tout
changement additif du schéma (nouvelle colonne nullable, nouveau modèle,
nouvelle relation) à la base de production, sans étape manuelle. **Important** :
`--accept-data-loss` ne doit jamais couvrir un changement réellement destructeur
(suppression de colonne, passage d'une colonne à `NOT NULL` sur une table déjà
peuplée, renommage) — ce genre de changement doit être fait à la main, avec une
vraie review, pas via ce mécanisme automatique. Tous les changements de schéma
faits par ce mécanisme jusqu'ici sont strictement additifs (nouvelles colonnes
nullables, nouveaux modèles).

## Build Next.js (`next build`) dans cet environnement de développement (Claude)

`next build` échoue ici aussi : `next/font/google` (utilisé par `app/fonts.ts`
pour Fraunces, IBM Plex Sans et IBM Plex Mono) va chercher le CSS des polices
sur `fonts.googleapis.com` **au moment du build**, et ce domaine n'est pas non
plus sur la liste des sorties réseau autorisées dans ce bac à sable. **Ce
n'est pas une erreur du code** — sur un poste de dev ou un CI avec accès
réseau complet, `next build` fonctionnera normalement.

Conséquence concrète pour le service worker de l'app shell (`public/sw.js`,
phase 2 du mode hors-ligne, `docs/ARCHITECTURE_HORS_LIGNE.md`) : impossible
dans ce bac à sable de connaître à l'avance les noms de fichiers statiques
figés par le build (`/_next/static/...`) pour les précharger à l'installation
du service worker. La stratégie retenue est donc une mise en cache *à
l'usage* (runtime caching) plutôt qu'un préchargement au build — voir les
commentaires en tête de `public/sw.js`. Une fois le projet buildable (hors de
ce bac à sable), cette stratégie reste valide ; un préchargement du build
pourrait être ajouté en complément mais n'est pas nécessaire.

À vérifier/relancer dès que le projet tourne hors de ce bac à sable :

```bash
pnpm --filter @eleganz/web build
```

## Stockage objet des images produits (Cloudflare R2)

Compte créé par le propriétaire du projet (décision du 11 octobre 2026).
Variables à renseigner dans `apps/api/.env` en local, ou dans les variables
d'environnement du service d'hébergement en production — voir
`apps/api/.env.example` pour la liste complète et son explication
(`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`R2_PUBLIC_BASE_URL`). Jamais codées en dur dans le code.

`R2_PUBLIC_BASE_URL` suppose que le bucket a son accès public activé (R2 →
le bucket → Settings → Public Access → Allow Access via le domaine `r2.dev`
fourni par Cloudflare, ou un domaine personnalisé une fois branché) — sans
ça, les photos uploadées ne s'afficheront pas sur la vitrine Marketplace
(erreur 401/403 côté navigateur).

Le flux d'upload (`StorageService`, `apps/api/src/storage/`) ne fait jamais
transiter le fichier par notre propre serveur : le navigateur de la boutique
obtient une URL R2 signée à durée limitée (`POST
/shops/:shopId/products/:productId/images/upload-url`) puis envoie l'image
directement à R2, et seule l'URL publique définitive est ensuite enregistrée
sur `Product.images` via `PATCH /shops/:shopId/products/:productId`.

## Commandes utiles

```bash
pnpm install              # dépendances de tout le monorepo
pnpm dev:api               # API NestJS en local (port 3001)
pnpm dev:web                # Frontend Next.js en local (port 3000)
pnpm --filter @eleganz/api build   # vérifie que l'API compile
```

## Créer le compte administrateur ELEGANZ

Un compte `ADMIN_*` ne peut pas être créé via `/auth/register` (réservé à
BUYER/SHOP_OWNER, volontairement). Le seul chemin prévu est le script de seed
(`packages/database/prisma/seed.ts`), qui crée ou met à jour le mot de passe
du compte décidé par le propriétaire (décision #5 :
`eleganzmarket.admin@gmail.com`) avec le rôle `ADMIN_SUPER`.

```bash
ELEGANZ_ADMIN_EMAIL=eleganzmarket.admin@gmail.com \
ELEGANZ_ADMIN_PASSWORD=<mot de passe choisi par le propriétaire> \
pnpm --filter @eleganz/database seed:admin
```

Aucun mot de passe par défaut n'est codé en dur : sans `ELEGANZ_ADMIN_PASSWORD`,
le script s'arrête sans rien créer. À exécuter une fois la base de données
réelle en place (hors de ce bac à sable, puisque `prisma generate` y est
bloqué — voir plus haut).

## Piège fréquent : tout nouveau module avec `@UseGuards(JwtAuthGuard)` doit importer `AuthModule`

**Incident du 13 oct. 2026** : le déploiement du module ELEGANZ Mon Comptable
a fait planter **toute** l'API en production (502 "Application failed to
respond" sur tous les endpoints, pas seulement les nouveaux), pendant plus de
10 minutes, parce que `ComptableModule` déclarait des contrôleurs utilisant
`@UseGuards(JwtAuthGuard)` sans importer `AuthModule`. Log Railway :

```
[Nest] ERROR [ExceptionHandler] Nest can't resolve dependencies of the
JwtAuthGuard (?). Please make sure that the argument JwtService at index [0]
is available in the ComptableModule context.
```

`JwtAuthGuard` dépend de `JwtService`, fourni par `JwtModule` et
ré-exporté par `AuthModule` (voir `apps/api/src/auth/auth.module.ts`). Au
démarrage, Nest tente d'instancier tous les providers de tous les modules
déclarés dans `app.module.ts` — si un seul échoue, **le processus entier
ne démarre pas** (`node dist/main.js` sort en `exit status 1`), ce qui
explique pourquoi une panne localisée à un seul module a mis l'intégralité
de l'API hors service.

**Règle à appliquer systématiquement pour tout nouveau module** : dès qu'un
contrôleur utilise `@UseGuards(JwtAuthGuard)` (ou tout autre guard qui
dépend de `JwtService`/`AuthService`), son module doit lister `AuthModule`
dans `imports`. Voir `admin-cockpit.module.ts`, `admin-settings.module.ts`
ou `comptable.module.ts` pour le pattern correct.

**Leçon sur le processus de déploiement** : ce bac à sable n'a aucun accès
aux logs Railway (`railway whoami` → non autorisé) et ne peut pas exécuter
`prisma generate`/`tsc` complet sur `apps/api` (réseau bloqué vers
`binaries.prisma.sh`) — seule une vérification syntaxique (parser TS) est
possible, qui ne détecte pas ce genre d'erreur de câblage NestJS (résolue
seulement à l'exécution, au démarrage du conteneur). En conséquence, pour
tout nouveau module volumineux touchant à la fois le schéma Prisma et du
code applicatif : **déployer en deux temps** — (1) schéma Prisma seul, sans
enregistrer le nouveau module dans `app.module.ts`, vérifier que l'API
survit ; (2) code applicatif ensuite, vérifié séparément. Si une panne
totale survient sans accès aux logs, `git revert --no-edit <commit>` pour
rétablir le service immédiatement, diagnostiquer ensuite une fois les logs
obtenus (demander au propriétaire un copier-coller de l'onglet "Deploy
Logs" du service concerné sur le dashboard Railway).

## Piège fréquent : les commentaires `/** ... */` sont invalides dans `schema.prisma`

**Incident du 13 oct. 2026 (bis)** : le modèle `ExchangeRateHistory` a été
documenté avec un commentaire de style JSDoc (`/** ... */`), syntaxe
invalide dans le langage de schéma Prisma — **seuls `//` (et `///` pour la
doc générée) sont acceptés**. Résultat : `prisma generate` échoue à la
validation (`P1012`, "This line is invalid. It does not start with any
known Prisma schema keyword."), donc `prisma db push` échoue aussi au
démarrage du conteneur — mais ici Railway a gardé l'ancienne version en
service plutôt que de planter (contrairement à l'incident `AuthModule`
ci-dessus, qui lui faisait planter le process), donc **le symptôme était
silencieux : l'API restait saine, seule la nouvelle route répondait 404 en
boucle**, sans aucune erreur visible sans les logs de build.

**Règle à appliquer systématiquement** : dans `packages/database/prisma/schema.prisma`,
toujours utiliser `//` ligne par ligne pour documenter un modèle ou un
champ, jamais `/** ... */` (qui est valide en TypeScript mais pas en
Prisma Schema Language). Comme `prisma validate`/`generate` ne peuvent pas
tourner dans ce bac à sable (réseau bloqué, voir plus haut), c'est une
relecture manuelle du diff qui doit attraper ce genre d'erreur avant de
pousser — ou, si une route nouvellement ajoutée répond 404 en boucle bien
après le délai de déploiement habituel alors que le reste de l'API va
bien, soupçonner en premier un échec silencieux de `prisma generate`/`db push`
plutôt qu'un problème de câblage NestJS.

## Piège fréquent : `startsWith` sur un préfixe de route qui n'est pas aussi un segment

**Incident du 13 oct. 2026 (ter)** : `espaceAuth()` (`apps/web/app/lib/api.ts`)
choisissait la clé de jeton à utiliser avec `chemin.startsWith("/livreur")`,
pour distinguer l'espace livreur plateforme (`/livreur/...`) des deux autres
espaces. Lors de l'ajout de la nouvelle page **Livreurs** d'ELEGANZ Gestion
(`/livreurs` — gestion des livreurs propres à la boutique), ce
`startsWith` a aussi matché `/livreurs` : la page utilisait alors
silencieusement le jeton de l'espace livreur plateforme (vide, puisque le
compte boutique ne s'y est jamais connecté) au lieu du jeton Gestion.
Résultat : tous les appels API de cette page échouaient silencieusement
(401, intercepté par un simple `.catch` non bloquant côté `shop-context.tsx`),
et l'écran affichait en boucle "Aucune boutique n'est encore associée à ce
compte" alors que le compte en avait bien une — aucune erreur console, et
`read_network_requests` ne montrait même pas de requête `/shops/mine` partie
(le fetch ne se déclenche que si `user` est non nul, lui-même dépendant du
même jeton mal choisi).

**Règle à appliquer systématiquement** : un `startsWith("/prefixe")` sur un
chemin n'est sûr que si aucune autre route ne commence par la même chaîne de
caractères sans être le même segment — `/livreur` et `/livreurs` partagent un
préfixe mais sont deux pages différentes. Toujours vérifier la frontière de
segment explicitement (`chemin === "/x" || chemin.startsWith("/x/")`) dès
qu'un chemin de test sert à distinguer des espaces applicatifs (ici,
`espaceAuth()`), et plus généralement avant de nommer une nouvelle route
dans n'importe quel module, vérifier qu'elle ne commence pas par le nom
(pluriel ou non) d'un module existant déjà testé par préfixe ailleurs dans
le code (`grep -rn 'startsWith("/<préfixe>' apps/web`).
