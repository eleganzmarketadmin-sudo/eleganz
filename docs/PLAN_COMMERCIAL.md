# Plan commercial ELEGANZ — tarification et bouquets

Document de référence du plan commercial validé le 14 octobre 2026, en
réponse à la demande du propriétaire : les tarifications prévues n'étaient
plus adaptées à la taille et aux fonctionnalités réelles de la plateforme.
Repris ici en version courte et actionnable — la version complète, avec le
raisonnement détaillé, reste dans le doc partagé envoyé au propriétaire le
même jour (lien Claude Docs, hors dépôt).

Ce document décrit le **plan** (la cible commerciale) ; `PROJECT_STATUS.md`
dit ce qui, dans ce plan, est **déjà construit** en API/écrans.

## Constat de départ

Avant ce chantier, ELEGANZ Gestion facturait un frais d'ouverture fixe
(100 $, codé en dur dans `BillingService`) identique pour toute boutique,
sans aucun abonnement mensuel récurrent — alors que le moteur comptable
(Finance avancée, immobilisations, clôture, trésorerie, comptable externe…)
avait déjà beaucoup plus de valeur que ce que la tarification reflétait, et
que l'infrastructure de bouquets (`SubscriptionPlan`, `Shop.gestionBouquetId`,
CRUD admin complet) existait déjà mais n'était jamais peuplée ni appliquée à
rien.

## Modèle commercial général

Trois leviers de revenus, cumulables :
1. **Abonnement par bouquet** — mensuel, par boutique, selon le palier
   ELEGANZ Gestion choisi (ci-dessous).
2. **Commission future sur les transactions** — ELEGANZ Market (marketplace)
   et, plus tard, d'autres services, prélevée sur les transactions plutôt
   que seulement via un abonnement fixe. **Pas encore construite** (le
   champ `ShopOrder.commissionAmount` existe dans le schéma mais n'est
   calculé nulle part dans l'API — voir "à construire" ci-dessous).
3. **Services à la carte**, au-delà de l'abonnement mensuel, présentés en
   interne comme de la « location et hébergement » : crédits IA
   (`AiCreditWallet`/`AiCreditTransaction`, modèle existant mais non
   monétisé), SMS/WhatsApp premium, option commission pour les livreurs.
   **Pas encore construits.**

Dans tous les cas, **la durée des périodes de gratuité reste réglable à
volonté par l'administrateur**, boutique par boutique ou globalement
(`Shop.freeTrialDurationDays`, `PlatformSettings.driverFreeMonths`/
`comptableFreeMonths`) — ce principe, déjà en place avant ce chantier,
n'a pas changé.

## ELEGANZ Gestion — les 3 bouquets de départ

Valeurs de départ, **entièrement modifiables depuis `/admin/tarifs` sans
redéploiement** (prix, frais d'ouverture, limites, fonctionnalités) :

| | Starter | Pro | Premium |
|---|---|---|---|
| Frais d'ouverture | 20 $ | 50 $ | 100 $ |
| Abonnement mensuel | 5 $ | 20 $ | 45 $ |
| Produits actifs max. | 50 | 500 | illimité |
| Taille d'équipe max. (hors propriétaire) | 2 | 10 | illimité |
| Finance avancée (journal, grand livre, balance, états financiers, simulation fiscale, analytique) | — | ✓ | ✓ |
| Immobilisations et amortissements | — | — | ✓ |
| Clôture comptable mensuelle | — | — | ✓ |
| Relevé de trésorerie | — | — | ✓ |
| Comptable externe | — | — | ✓ |
| Variantes de produits (taille/couleur)* | — | ✓ | ✓ |
| Export Excel/PDF* | — | ✓ | ✓ |

\* Déclarées dans `featuresJson`, réglables depuis `/admin/tarifs`, et
réellement appliquées : `variantesProduits` bloque la création de variantes
en lot (`POST .../variants/bulk`, pas la variante simple requise pour
vendre — voir le commentaire dans `catalog.controller.ts`) ;
`exportExcelPdf` bloque l'export Excel du catalogue et l'export
Excel/PDF des relevés d'activité.

Toute boutique déjà active avant ce chantier a été rattachée automatiquement
au bouquet **Pro** (jamais Starter) pour ne perdre aucun accès qu'elle
utilisait déjà.

## ELEGANZ Market — commission future sur les transactions

Pas encore construite. Le champ `ShopOrder.commissionAmount` existe dans le
schéma, prêt à être rempli, mais aucun calcul ni aucune facturation ne s'y
rattache aujourd'hui. Prochaine étape suggérée : taux de commission
configurable depuis `/admin/tarifs` (par défaut ou par bouquet Marketplace),
calculé à la validation de la commande, agrégé dans un relevé périodique
comme les abonnements boutique.

## ELEGANZ Mon Comptable — révision

Hors scope de ce chantier (tarification déjà en place et jugée adaptée :
1 $/mois ou 10 $/an, 6 mois gratuits). Non modifié.

## Espace Livreur — révision

Hors scope de ce chantier (tarification déjà en place et jugée adaptée :
10 $ d'ouverture, 5 $/mois, 8 mois gratuits). Piste notée pour plus tard :
option de commission sur les courses plutôt qu'un abonnement fixe, demandée
dans le brief du 14 octobre mais pas encore conçue.

## Services à la carte (au-delà de l'abonnement)

Pas encore construits : crédits IA, SMS/WhatsApp premium. Le modèle de
données des crédits IA existe déjà (`AiCreditWallet`/`AiCreditTransaction`)
mais n'est monétisé nulle part.

## Règles de gratuité

Inchangées par ce chantier — déjà 100 % réglables par l'administrateur avant
ce travail, et volontairement laissées ainsi :
- Boutiques : `Shop.freeTrialDurationDays` (90 jours par défaut), décompté
  depuis `freeTrialStartedAt` (l'entrée en relation, pas une date globale).
- Livreurs : `PlatformSettings.driverFreeMonths`, décompté depuis la
  validation du dossier par l'admin.
- Mon Comptable : `PlatformSettings.comptableFreeMonths`, décompté depuis la
  première activation effective de l'abonnement.

## Déjà construit (ce chantier, 14 octobre 2026) vs à construire

**Construit et vérifié en production** :
- Seed idempotent des 3 bouquets Gestion de départ, par nom (pas par
  catégorie — voir l'incident ci-dessous), sans jamais écraser un bouquet
  déjà modifié par l'admin.
- `SubscriptionPlan.openingFee` : frais d'ouverture par bouquet, lu par
  `BillingService.processTrialExpirations` (avec un filet de sécurité à
  100 $ si une boutique se retrouve sans bouquet).
- `BillingService.runMonthlyBilling()` + `POST /admin/billing/run-monthly-billing` :
  premier cycle de facturation mensuelle récurrente pour les boutiques
  actives, au tarif de leur bouquet.
- Gating par fonctionnalité (`@RequiresGestionFeature`, `ShopMembershipGuard`)
  sur Finance avancée, Immobilisations, Clôture, Trésorerie.
- Limite de taille d'équipe (`maxEquipe`) et accès au rôle Comptable externe,
  appliqués dans `ShopsService.inviteStaff`.
- Limite de produits actifs (`maxActiveProducts`), appliquée dans
  `CatalogService.createProduct`.
- `/admin/tarifs` : frais d'ouverture, taille d'équipe max. et tableau de
  cases à cocher par fonctionnalité pour les bouquets Gestion (remplace le
  champ texte libre, conservé pour les bouquets Marketplace) ; section
  « Facturation des boutiques » (vérifier les gratuités échues, lancer la
  facturation mensuelle, suspendre les impayés).

**Incident corrigé en cours de route** : un bouquet de test "Essentiel"
(catégorie GESTION) existait déjà en base avant ce chantier ; la première
version de la garde de seed vérifiait « un bouquet Gestion existe-t-il déjà »
et s'est arrêtée dès ce premier bouquet trouvé — Starter/Pro/Premium n'ont
donc pas été créés au premier déploiement malgré un déploiement réussi.
Corrigé pour vérifier chaque bouquet par son nom. "Essentiel" n'a pas été
supprimé (geste destructif non demandé) — à retirer manuellement depuis
`/admin/tarifs` si souhaité.

**Délibérément pas construit** (prochain lot, hors scope de ce chantier) :
- Commission sur les transactions ELEGANZ Market (`ShopOrder.commissionAmount`).
- Monétisation des crédits IA, SMS/WhatsApp premium.
- Option de commission pour les livreurs (plutôt qu'abonnement fixe).
- Planificateur automatique du cycle de facturation mensuelle des boutiques
  (déclenchement manuel par l'admin, comme pour les livreurs et Mon
  Comptable — limite déjà documentée pour ces deux modules).

## Recommandation

Prochaine étape suggérée au propriétaire, par ordre de valeur/effort : (1)
commission ELEGANZ Market, car c'est le second levier de revenu explicitement
demandé et le champ existe déjà dans le schéma ; (2) services à la carte
(crédits IA, SMS/WhatsApp) ; (3) option de commission livreur.
