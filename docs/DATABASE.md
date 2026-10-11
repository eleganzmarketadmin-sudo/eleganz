# Base de données

Schéma complet : `packages/database/prisma/schema.prisma`. Ce fichier explique le raisonnement, pas chaque champ.

## Blocs du modèle

1. **Identité & accès** — `User`, `Address`. Un seul modèle `User` pour tous les rôles (acheteur, vendeur, livreur, staff admin), distingué par `role`.
2. **Boutiques** — `Shop`, `ShopStaff`. `Shop.mode` (`PRIVATE` / `MARKETPLACE` / `HYBRID`) est le champ pivot de tout le projet : il détermine si le catalogue est public, si la facturation Marketplace s'applique, etc. `Shop.freeTrialDurationDays` et `freeTrialStartedAt` portent la décision #3 (période gratuite configurable).
3. **Catalogue & stock** — `Product`, `Variant`, `StockMovement`. `StockMovement` est volontairement une table de mouvements (pas seulement un compteur sur `Variant`) pour garder un historique auditable et permettre une réservation transactionnelle (`ONLINE_SALE_RESERVED`) qui empêche la double vente entre caisse et Marketplace.
4. **ELEGANZ Gestion** — `PosSale`, `PosSaleLine`, `PosPayment`, `CommercialDocument`, `Supplier`, `Purchase`, `Expense`, `ShopCustomer`. `CommercialDocument.isFiscallyHomologated` reste `false` par défaut (décision #9) — ne jamais forcer à `true` sans validation DGI confirmée.
5. **ELEGANZ Marketplace** — `Order` (commande globale client), `ShopOrder` (sous-commande par boutique, visible uniquement par son vendeur), `OrderLine`, `OrderPayment`, `Dispute`. Le découpage Order/ShopOrder porte l'exigence « commandes multivendeurs » du prompt maître (§48).
6. **Livraison** — `Driver`, `DeliveryZone`.
7. **Monétisation** — `SubscriptionPlan` (séparé par `PlanCategory` : `MARKETPLACE` ou `GESTION`, décision #10 — un commerçant Gestion seul ne paie jamais les frais/commissions Marketplace), `ShopSubscription`, `Invoice`, `AiCreditWallet`, `AiCreditTransaction`, `AiService`.
8. **Audit** — `AuditLog`, exigé pour toute action sensible (prompt §41).

## Décisions de modélisation à ne pas défaire sans raison

- Un seul `StockMovement` pour la caisse et le Marketplace (pas deux systèmes de stock séparés à synchroniser).
- Deux `SubscriptionPlan.category` distinctes (Gestion / Marketplace), jamais fusionnées, pour respecter la décision #10.
- `CommercialDocument.type` distingue explicitement `INVOICE_INTERNAL` (non homologué) de `INVOICE_FISCAL` (homologué) — ne jamais les fusionner en un seul type « facture ».

## Pas encore modélisé (à faire en phase 4+)

- File d'opérations hors-ligne (queue locale + réconciliation) pour le mode caisse sans connexion.
- Détail des quotas par `SubscriptionPlan` (`featuresJson` est un espace réservé générique, à structurer une fois les bouquets définitifs validés).
