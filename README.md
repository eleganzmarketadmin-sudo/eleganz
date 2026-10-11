# ELEGANZ

Plateforme commerciale pour la RDC (Kinshasa en priorité), composée de deux produits construits sur un socle unique :

- **ELEGANZ Gestion** — logiciel de caisse et de gestion commerciale pour les commerçants physiques (en développement en premier).
- **ELEGANZ Marketplace** — place de marché multivendeurs en ligne (en développement ensuite).

Une boutique fonctionne dans l'un de trois modes : `PRIVATE` (gestion uniquement), `MARKETPLACE` (vente en ligne uniquement) ou `HYBRID` (les deux, stock unifié). Voir `docs/ARCHITECTURE.md`.

## Démarrer ici

Si vous reprenez ce projet dans une nouvelle session, lisez dans l'ordre :

1. `docs/PROJECT_OVERVIEW.md` — ce qu'est ELEGANZ et pourquoi.
2. `docs/DECISIONS.md` — les décisions déjà validées par le propriétaire du projet (ne pas les re-trancher sans raison).
3. `docs/ARCHITECTURE.md` — stack technique et structure du monorepo.
4. `docs/DATABASE.md` — modèle de données et son raisonnement.
5. `docs/PROJECT_STATUS.md` — ce qui est fait, en cours, pas commencé.
6. `docs/NEXT_ACTIONS.md` — la prochaine tâche concrète à reprendre.

## Structure du monorepo

```
apps/
  api/        # Backend NestJS (ELEGANZ Gestion + Marketplace, API unique)
  web/        # Frontend Next.js (interfaces client, vendeur, caisse, admin)
packages/
  database/   # Schéma Prisma partagé (packages/database/prisma/schema.prisma)
docs/         # Documentation permanente du projet
```

## État actuel

Squelette initial seulement — voir `docs/PROJECT_STATUS.md`. Aucun service n'est déployé, aucun compte de paiement ou d'hébergement n'a été créé.
