# Architecture technique

## Stack (décision #1)

- **Frontend** : Next.js (React, TypeScript) — interfaces client, vendeur, caisse (POS), livreur, admin.
- **Backend** : NestJS (TypeScript) — API unique servant Gestion et Marketplace.
- **Base de données** : PostgreSQL auto-hébergé, accédé via Prisma (`packages/database/prisma/schema.prisma`).
- **Stockage objet** : compatible S3 (images produits, documents PDF) — fournisseur à choisir au moment du déploiement (décision d'engagement financier, nécessite l'accord du propriétaire).
- **Paiements** : agrégateur Moneroo en premier (décision #2), passerelle carte séparée pour la diaspora, intégrations directes opérateurs préparées en parallèle.
- **Recherche** : moteur hybride — recherche structurée PostgreSQL (full-text + filtres) pour la correspondance exacte, embeddings d'image via API externe pour la recherche par photo. Pas d'IA générative à chaque requête (maîtrise des coûts).

## Pourquoi pas Supabase

Le contrôle total des données et l'absence de dépendance à un BaaS tiers ont été jugés prioritaires pour la facturation, les abonnements et les suspensions — une logique commerciale sensible mieux maîtrisée dans un backend applicatif classique que dans les contraintes d'un BaaS. Supabase reste une option de repli si l'exploitation d'un serveur devient un fardeau.

## Monorepo

```
apps/api/      NestJS — modules : auth, shops, catalog, stock, pos, orders,
                payments, billing, ai-credits, admin-cockpit, delivery
apps/web/      Next.js — espaces : buyer, shop-pos, shop-marketplace, driver, admin
packages/database/prisma/schema.prisma   schéma unique partagé
docs/          documentation permanente (ce dossier)
```

## Principe d'unicité du stock

`StockMovement` est la seule table qui modifie `Variant.stockQty`, que la vente vienne de la caisse (`PosSale`) ou d'une commande en ligne (`ShopOrder`). Toute écriture doit être transactionnelle (une transaction DB par vente) pour empêcher la double vente décrite dans le complément stratégique (§5 : exemple des 10 chemises bleues XL).

## Droits d'accès

Contrôlés au niveau du service (API), jamais seulement dans l'affichage du frontend — exigence explicite du prompt maître (§11). `ShopStaff.role` (OWNER/MANAGER/CASHIER/STOCK_KEEPER/SALES_LEAD/ACCOUNTANT) et `User.role` côté admin (`ADMIN_SUPER`, `ADMIN_FINANCE`, etc.) portent les permissions. Toute action sensible passe par `AuditLog`.

## Ce qui reste à trancher techniquement (pas encore des décisions du propriétaire)

- Fournisseur d'hébergement définitif (VPS) et de stockage objet.
- Fournisseur d'embeddings pour la recherche par photo.
- Mécanisme précis de synchronisation hors-ligne (file d'opérations locale + réconciliation, à spécifier en détail avant implémentation — décision #8 confirme que c'est prioritaire pour la V1).
