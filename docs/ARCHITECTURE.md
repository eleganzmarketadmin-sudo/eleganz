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

## Livraison — réseau plateforme fermé au public (13 oct. 2026)

Le réseau de livreurs plateforme (`Driver`, inscription publique, zones, vérification) est **fermé à l'inscription de nouveaux livreurs** sur décision explicite du propriétaire : le risque de malhonnêteté d'un premier livreur non vérifié pourrait nuire au lancement, et la plateforme ne peut pas garantir le sérieux d'un livreur qu'elle n'a pas elle-même qualifié. Le code et le schéma (`Driver`, `DeliveryZone`, `DriverBillingStatus`) sont conservés intacts pour une réactivation future — seule `registerDriver()` lève désormais une erreur. À la place, chaque boutique gère ses propres livreurs via `ShopDriver` (sans compte, sans vérification plateforme, sous la responsabilité de la boutique) ; le changement de statut de remise passe par la route générique existante `PATCH /shops/:shopId/orders/:shopOrderId/status`.

## Finance & Comptabilité (13 oct. 2026, Phase 1)

Voir **`docs/ARCHITECTURE_FINANCE.md`** pour l'architecture complète (modèle de données, séparation stricte boutique/ELEGANZ au niveau service/contrôleur et pas seulement à l'affichage — exigence explicite du prompt maître §11/§14 —, plan de tests, et la liste assumée de tout ce qui est délibérément différé : comptabilité en partie double SYSCOHADA, assistant de clôture, états financiers réglementaires, invitation/vérification d'un comptable externe, simulation fiscale, déclarations électroniques, immobilisations/amortissements, analyses et prévisions). En bref :

- Module « Finance & Comptabilité » côté boutique (`/finance`, tableau de bord / charges / règles fiscales) et son miroir côté ELEGANZ (`/admin/finance`), chacun alimenté par les données réelles existantes (`PosSale`, `ShopOrder`, `Expense`, `Purchase`, `Supplier`), jamais par des données fictives.
- Séparation stricte boutique ↔ ELEGANZ : les routes boutique (`/shops/:shopId/finance/...`) ne lisent/écrivent jamais de règle fiscale `scope: PLATFORM`, et les routes admin (`/admin/finance/...`) ne lisent/écrivent jamais de règle `scope: SHOP` ni ne prennent de `shopId` — contrôlé par construction, pas seulement par un filtre d'affichage.
- Le tableau de bord ELEGANZ distingue explicitement (A) la valeur totale des transactions des vendeurs (pas un revenu ELEGANZ) de (B) les revenus réellement attribuables à ELEGANZ (abonnements, frais livreur, Mon Comptable), conformément à l'exemple des 100 $ / 10 $ de commission du prompt maître (§13).

## Ce qui reste à trancher techniquement (pas encore des décisions du propriétaire)

- Fournisseur d'hébergement définitif (VPS) et de stockage objet.
- Fournisseur d'embeddings pour la recherche par photo.
- Mécanisme précis de synchronisation hors-ligne (file d'opérations locale + réconciliation, à spécifier en détail avant implémentation — décision #8 confirme que c'est prioritaire pour la V1).
