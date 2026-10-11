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

## Commandes utiles

```bash
pnpm install              # dépendances de tout le monorepo
pnpm dev:api               # API NestJS en local (port 3001)
pnpm dev:web                # Frontend Next.js en local (port 3000)
pnpm --filter @eleganz/api build   # vérifie que l'API compile
```
