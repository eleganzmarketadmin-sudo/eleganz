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
2. **Commission sur les transactions** — ELEGANZ Market (marketplace), et,
   plus tard, d'autres services, prélevée sur les transactions plutôt que
   seulement via un abonnement fixe. **Construite et déployée** (calculée à
   la création de chaque commande, facturée séparément — voir ci-dessous).
3. **Services à la carte**, au-delà de l'abonnement mensuel, présentés en
   interne comme de la « location et hébergement ». **Crédits IA :
   construits et déployés** (14 oct. 2026) — voir ci-dessous. **SMS/WhatsApp
   premium : tarif préparé, fonctionnalité pas branchée** (aucun compte
   Twilio/WhatsApp Business). **Option de commission pour les livreurs : pas
   construite.**

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

## ELEGANZ Market — commission sur les transactions

**Construite et déployée (14 oct. 2026).** Taux de commission (%) réglable
depuis `/admin/tarifs`, soit par bouquet Marketplace (`SubscriptionPlan.
commissionRate`), soit globalement en filet de sécurité
(`PlatformSettings.marketplaceCommissionRateDefault`) — ordre de priorité :
taux du bouquet de la boutique, sinon taux global, sinon 0.

Calcul : à la création de chaque commande (`OrdersService.createOrder`),
une fois par sous-commande boutique (`ShopOrder.commissionAmount`), au taux
en vigueur à cet instant — jamais recalculé ensuite, même principe que le
taux de change CDF/USD (snapshot au moment de la transaction).

Facturation : déclenchement manuel depuis `/admin/tarifs`
(`POST /admin/billing/run-commission-billing`, bouton « Lancer la
facturation des commissions ») — agrège les `ShopOrder` au statut `CLOSED`
non encore facturées en une `Invoice{kind:"commission"}` par boutique, et
marque `ShopOrder.commissionInvoicedAt` dans la même transaction pour
exclure ces sous-commandes d'un prochain cycle (pas de double facturation).
Même logique manuelle que les autres cycles de facturation du projet
(aucun planificateur automatique nulle part).

## ELEGANZ Mon Comptable — bouquets premium (APPROUVÉ, CONSTRUIT ET VÉRIFIÉ EN PRODUCTION)

Proposé le 14 octobre 2026 ("prevoir egalement les proposition su eleganz
mon comptable"), **validé tel quel par le propriétaire le même jour**
("Oui et gerable totalement au niveau du centre de pilotage"), puis
construit et déployé en suivant la même discipline en deux temps que pour
le reste du projet (commit schéma seul, vérifié déployé, PUIS commit
code+UI, vérifié déployé) — parce que Mon Comptable a déjà des abonnés
payants réels sur l'offre actuelle et qu'un changement de grille tarifaire
touche des comptes en production, pas seulement une valeur de
configuration.

**Constat (lecture du code, pas d'hypothèse)** : contrairement à ELEGANZ
Gestion, Mon Comptable n'a aujourd'hui **aucun levier de différenciation
déjà construit** — un seul abonnement plat (1 $/mois ou 10 $/an, 6 mois
gratuits), et tout le module est disponible sans aucune limite : nombre
illimité d'« activités » suivies (`ComptableActivity` — commerce, location,
véhicule, service, autre), saisie illimitée, suivi de dettes/créances,
unités locatives, envois à des travailleurs, tableau de bord avec
historique et comparaison de périodes, rappels/agenda, export Excel/PDF de
la synthèse ET export d'un dossier de financement pour une demande de prêt
bancaire. Proposer des « bouquets » suppose donc de choisir *quoi* mettre
derrière un palier supérieur — une décision commerciale, pas technique,
d'où la nécessité de la soumettre avant de coder.

**Principe non négociable** : aucun abonné actuel ne doit perdre un accès
qu'il utilise déjà (même règle que pour le rattachement automatique au
bouquet "Pro" lors du chantier Gestion). L'offre actuelle deviendrait donc
le palier de base ("Essentiel"), inchangée, et les paliers supérieurs
n'ajoutent que de la valeur nouvelle.

| | Essentiel (actuel, inchangé) | Pro | Premium |
|---|---|---|---|
| Prix | 1 $/mois ou 10 $/an (inchangé) | 3 $/mois ou 30 $/an | 7 $/mois ou 70 $/an |
| Activités suivies simultanément | 1 | 5 | Illimité |
| Saisie, dettes/créances, unités locatives, envois travailleurs | ✓ | ✓ | ✓ |
| Tableau de bord — historique | 3 derniers mois | Illimité | Illimité |
| Comparaison de périodes | — | ✓ | ✓ |
| Rappels et agenda proactifs | — | ✓ | ✓ |
| Export synthèse Excel/PDF | ✓ | ✓ | ✓ |
| Export dossier de financement (banque) | — | — | ✓ |

Raisonnement par ligne : la limite à 1 activité sur l'Essentiel reflète
l'usage réel observé (une personne qui ne suit qu'une seule activité n'a
besoin de rien de plus) sans rien retirer à qui en suit déjà plusieurs —
voir le principe de migration ci-dessous. L'historique/comparaison et les
rappels sont une couche de confort qui a du sens à monétiser une fois
qu'une personne gère plusieurs activités à la fois. Le dossier de
financement est réservé au palier le plus élevé parce que c'est la seule
fonctionnalité du module tournée vers un tiers externe (un banquier) plutôt
que l'usage quotidien — une vraie raison de payer plus, pas une limite
arbitraire.

**Migration des abonnés existants** : comme pour Gestion, tout compte
Mon Comptable déjà actif au moment du déploiement a été automatiquement
rattaché au palier "Pro" (jamais Essentiel) par
`ComptablePlansService.rattacherAbonnesSansBouquet()` (exécuté une fois au
démarrage du service) pour ne perdre aucun accès déjà utilisé — en
particulier s'il suivait déjà plus d'une activité. Tout nouvel abonnement
créé après ce chantier démarre en revanche directement sur "Essentiel"
(`getOrCreateSubscription` ne rattache plus jamais un nouveau compte à
"Pro" par défaut).

**Construit, déployé et vérifié en production (14 octobre 2026)** :
- Schéma : nouveau modèle `ComptablePlan` (nom, prix mensuel/annuel,
  `maxActivities` nullable = illimité, `featuresJson`, actif/inactif),
  lié à `ComptableSubscription.bouquetId` (nullable, pour la migration).
- Gating réel vérifié par appel API direct sur un compte de test, sur les
  trois paliers : limite d'activités simultanées (409 au-delà de
  `maxActivities` sur Essentiel, succès illimité sur Pro/Premium), agenda
  complet (403 sur Essentiel, 200 sur Pro/Premium — les rappels prioritaires
  de la page d'accueil restent eux toujours visibles, à dessein, car ils
  portent des alertes de facturation critiques), comparaison entre
  activités (403 sur Essentiel, 200 sur Pro/Premium), historique du
  tableau de bord (plafonné à 60 jours sans le palier, 730 jours avec),
  export du dossier de financement bancaire (403 sur Essentiel ET Pro,
  200 PDF uniquement sur Premium).
- Changement de bouquet en libre-service par l'abonné
  (`POST comptable/subscription/bouquet`), vérifié également par appel API.
- Facturation (`ComptableBillingService`) : le montant facturé à
  l'expiration de l'essai gratuit et à chaque renouvellement provient du
  prix du bouquet rattaché (`bouquet.monthlyPrice`/`yearlyPrice`), avec le
  tarif plat global (`PlatformSettings.comptableMonthlyFee`/`comptableYearlyFee`)
  gardé uniquement comme filet de sécurité si un abonnement se retrouvait
  sans bouquet.
- Section « Bouquets ELEGANZ Mon Comptable » dans `/admin/tarifs` :
  entièrement gérable depuis le Centre de pilotage, aucune valeur figée
  dans le code — prix, limite d'activités et chacune des quatre
  fonctionnalités se règlent par bouquet, création de nouveaux bouquets,
  activation/désactivation ; vérifiée visuellement dans le navigateur
  (champs correctement pré-remplis avec les valeurs réelles).

## Espace Livreur — révision

Hors scope de ce chantier (tarification déjà en place et jugée adaptée :
10 $ d'ouverture, 5 $/mois, 8 mois gratuits). Piste notée pour plus tard :
option de commission sur les courses plutôt qu'un abonnement fixe, demandée
dans le brief du 14 octobre mais pas encore conçue.

## Services à la carte (au-delà de l'abonnement)

**Crédits IA — construits et déployés (14 oct. 2026).** Une boutique demande
un nombre de crédits (`POST shops/:shopId/ai-credits/top-up`) ; le montant
facturé est figé au prix unitaire en vigueur au moment de la demande
(`PlatformSettings.aiCreditUnitPrice`, réglable depuis `/admin/tarifs`).
Comme pour la commission, aucun crédit n'est accordé avant qu'un
administrateur marque la facture payée
(`POST admin/ai-credits/top-ups/:invoiceId/mark-paid`) — à ce moment précis,
le portefeuille (`AiCreditWallet.balance`) est crédité et une
`AiCreditTransaction{service:"top_up"}` historise l'opération. Le coût en
crédits de chaque service IA (recherche par photo, génération de visuel,
etc.) se règle service par service dans un catalogue admin
(`AiService`, CRUD complet, actif/inactif) — jamais ici globalement. Testé
de bout en bout en production (demande, facture, marquage payé, solde
crédité, double-paiement refusé).

**SMS/WhatsApp premium — tarif préparé, pas branché.** Un interrupteur et un
tarif mensuel sont réglables depuis `/admin/tarifs`
(`PlatformSettings.smsWhatsappPremiumEnabled`/`smsWhatsappPremiumMonthlyFee`),
pour que l'admin puisse préparer/afficher le prix sans attendre
l'intégration technique — mais aucun envoi réel n'y est encore rattaché
(aucun compte Twilio/WhatsApp Business configuré).

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
- Gating réel de `variantesProduits` (création de variantes en lot
  uniquement — jamais la variante simple requise pour vendre) et
  `exportExcelPdf` (export Excel du catalogue + export Excel/PDF des
  relevés d'activité), vérifié en production.
- Commission ELEGANZ Market : calcul par sous-commande à la création,
  taux par bouquet Marketplace ou taux global par défaut, facturation
  manuelle agrégée par boutique (`run-commission-billing`), champs admin
  dans `/admin/tarifs` (par bouquet et taux par défaut global).
- Crédits IA : demande d'achat par la boutique au prix unitaire configuré,
  octroi des crédits uniquement après marquage "payée" par un admin
  (`AiCreditTopUp`), catalogue des services IA administrable (`AiService`),
  interrupteur + tarif SMS/WhatsApp premium (préparation de prix). Testé de
  bout en bout en production avec un compte boutique jetable.
- Bouquets ELEGANZ Mon Comptable (Essentiel/Pro/Premium) : voir la section
  dédiée ci-dessus — gating par palier testé de bout en bout en production
  sur un compte jetable, migration automatique des abonnés existants vers
  "Pro", section admin entièrement gérable depuis `/admin/tarifs`.

**Incident corrigé en cours de route** : un bouquet de test "Essentiel"
(catégorie GESTION) existait déjà en base avant ce chantier ; la première
version de la garde de seed vérifiait « un bouquet Gestion existe-t-il déjà »
et s'est arrêtée dès ce premier bouquet trouvé — Starter/Pro/Premium n'ont
donc pas été créés au premier déploiement malgré un déploiement réussi.
Corrigé pour vérifier chaque bouquet par son nom. "Essentiel" n'a pas été
supprimé (geste destructif non demandé) — à retirer manuellement depuis
`/admin/tarifs` si souhaité.

**Délibérément pas construit** (prochain lot, hors scope de ce chantier) :
- Envoi réel SMS/WhatsApp (aucun compte Twilio/WhatsApp Business) — seul le
  tarif est préparé.
- Option de commission pour les livreurs (plutôt qu'abonnement fixe).
- Planificateur automatique des cycles de facturation (boutiques, livreurs,
  Mon Comptable, commissions, crédits IA) — déclenchement manuel par
  l'admin partout, limite déjà documentée.

## Recommandation

Prochaine étape suggérée au propriétaire, par ordre de valeur/effort : (1)
brancher un vrai fournisseur IA (image, génération) pour que les crédits IA
aient une utilité réelle au-delà de la facturation ; (2) compte
Twilio/WhatsApp Business pour activer le SMS/WhatsApp premium ; (3) option
de commission livreur.
