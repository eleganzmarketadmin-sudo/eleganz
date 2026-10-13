# Base de données

Schéma complet : `packages/database/prisma/schema.prisma`. Ce fichier explique le raisonnement, pas chaque champ.

## Blocs du modèle

1. **Identité & accès** — `User`, `Address`. Un seul modèle `User` pour tous les rôles (acheteur, vendeur, livreur, staff admin), distingué par `role`.
2. **Boutiques** — `Shop`, `ShopStaff`. `Shop.mode` (`PRIVATE` / `MARKETPLACE` / `HYBRID`) est le champ pivot de tout le projet : il détermine si le catalogue est public, si la facturation Marketplace s'applique, etc. `Shop.freeTrialDurationDays` et `freeTrialStartedAt` portent la décision #3 (période gratuite configurable).
3. **Catalogue & stock** — `Product`, `Variant`, `StockMovement`. `StockMovement` est volontairement une table de mouvements (pas seulement un compteur sur `Variant`) pour garder un historique auditable et permettre une réservation transactionnelle (`ONLINE_SALE_RESERVED`) qui empêche la double vente entre caisse et Marketplace.
4. **ELEGANZ Gestion** — `PosSale`, `PosSaleLine`, `PosPayment`, `CommercialDocument`, `Supplier`, `Purchase`, `Expense`, `ShopCustomer`. `CommercialDocument.isFiscallyHomologated` reste `false` par défaut (décision #9) — ne jamais forcer à `true` sans validation DGI confirmée.
5. **ELEGANZ Marketplace** — `Order` (commande globale client), `ShopOrder` (sous-commande par boutique, visible uniquement par son vendeur), `OrderLine`, `OrderPayment`, `Dispute`. Le découpage Order/ShopOrder porte l'exigence « commandes multivendeurs » du prompt maître (§48).
6. **Livraison** — `Driver`, `DeliveryZone` (réseau plateforme, fermé à l'inscription publique depuis le 13 oct. 2026 — voir décision ci-dessous) ; `ShopDriver` (13 oct. 2026) — livreur propre à une boutique, sans compte, sans vérification plateforme : `id, shopId, fullName, phone?, vehicleType?, active`. `ShopOrder.shopDriverId` référence ce livreur pour le suivi de remise.
7. **Monétisation** — `SubscriptionPlan` (séparé par `PlanCategory` : `MARKETPLACE` ou `GESTION`, décision #10 — un commerçant Gestion seul ne paie jamais les frais/commissions Marketplace), `ShopSubscription`, `Invoice`, `AiCreditWallet`, `AiCreditTransaction`, `AiService`.
8. **Audit** — `AuditLog`, exigé pour toute action sensible (prompt §41).
9. **Finance & Comptabilité (13 oct. 2026, Phase 1)** — voir `docs/ARCHITECTURE_FINANCE.md` pour le détail complet (schéma, séparation des accès, ce qui est différé). Résumé des ajouts :
   - `Shop` : 8 champs d'identité fiscale (`fiscalLegalName`, `fiscalLegalForm`, `fiscalIdNumber`, `fiscalAddress`, `fiscalJurisdiction`, `fiscalRegime`, `fiscalExercice`, `fiscalVatRegistered`) — propres à chaque boutique, jamais partagés avec ELEGANZ.
   - `Expense.currency` (`USD` par défaut, ou `CDF`) — ajouté à la table `Expense` existante pour préparer la trésorerie multi-devises (pas encore de compte de trésorerie réel, voir ci-dessous).
   - `FiscalRule` / `FiscalRuleVersion` — modélise les « Règles fiscales applicables à la boutique » ET « … à ELEGANZ » dans une **seule** table, distinguée par `scope` (`SHOP` / `PLATFORM`) et `shopId` (nullable). La séparation stricte boutique/ELEGANZ exigée par le prompt maître (§11, §14) est appliquée au niveau service/contrôleur (les routes boutique ne lisent/écrivent jamais `scope: PLATFORM`, et réciproquement), pas par deux tables physiques distinctes — choix documenté et assumé dans `docs/ARCHITECTURE_FINANCE.md` §3.2, reconsidérable plus tard. `FiscalRuleVersion` porte l'historique complet (ancienne/nouvelle valeur, motif, auteur, date d'effet).
   - `StaffRole.ACCOUNTANT` (existait déjà dans l'enum mais n'était câblé à aucun contrôle d'accès) — première utilisation réelle : gating des routes d'écriture Finance (`OWNER`/`MANAGER`/`ACCOUNTANT`).

## Toujours pas modélisé (dettes connues, voir `docs/ARCHITECTURE_FINANCE.md` §2 et §7)

- Aucun moteur de comptabilité en partie double / journal / grand livre (SYSCOHADA-révisé) — le module Finance Phase 1 agrège les tables existantes (`PosSale`, `ShopOrder`, `Expense`, `Purchase`, `Supplier`), il ne tient pas d'écritures comptables.
- `ShopOrder.commissionAmount` existe dans le schéma mais n'est calculé ni écrit nulle part dans l'API — tout affichage de commission dans le module Finance dit explicitement « non implémentée ».
- `Supplier.balanceOwed` est bien incrémenté/décrémenté par `SuppliersService` (`recordPurchase`/`settleDebt`), mais sans ligne de détail ni historique de paiement par achat.
- Aucun compte de trésorerie multi-devises avec solde courant ; pas de taux de change figé par transaction (`PlatformSettings.cdfPerUsd` reste un taux système unique et courant).
- `Invoice`, `DriverInvoice`, `ComptableInvoice` sont trois tables structurellement identiques mais séparées — candidat à normalisation, volontairement non fait cette phase.

## Décisions de modélisation à ne pas défaire sans raison

- Un seul `StockMovement` pour la caisse et le Marketplace (pas deux systèmes de stock séparés à synchroniser).
- Deux `SubscriptionPlan.category` distinctes (Gestion / Marketplace), jamais fusionnées, pour respecter la décision #10.
- `CommercialDocument.type` distingue explicitement `INVOICE_INTERNAL` (non homologué) de `INVOICE_FISCAL` (homologué) — ne jamais les fusionner en un seul type « facture ».

## Pas encore modélisé (à faire en phase 4+)

- File d'opérations hors-ligne (queue locale + réconciliation) pour le mode caisse sans connexion.
- Détail des quotas par `SubscriptionPlan` (`featuresJson` est un espace réservé générique, à structurer une fois les bouquets définitifs validés).
