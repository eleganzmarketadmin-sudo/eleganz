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
