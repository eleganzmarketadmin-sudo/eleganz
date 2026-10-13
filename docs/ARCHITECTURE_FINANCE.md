# Finance & Comptabilité — architecture

Document d'architecture rédigé **avant** le code, conformément à la demande du
13 oct. 2026 (§20 du prompt complémentaire officiel) : analyser l'existant,
décider ce qui est réutilisé, documenter les écarts, puis développer en
phases. Ce document couvre le module "FINANCE & COMPTABILITÉ" pour les
boutiques (ELEGANZ Gestion) et pour ELEGANZ elle-même (Centre de pilotage).

**Portée réellement livrée à cette étape (Phase 1)** — à ne jamais présenter
comme plus avancée que ça : tableau de bord financier (estimations à partir
des données réelles), charges, règles fiscales applicables à la boutique
(bibliothèque + configuration + versionnement, sans vérification
professionnelle en ligne ni déclaration électronique), et leur miroir minimal
côté ELEGANZ. **Non livré à cette étape** (voir "Reporté" en fin de document) :
moteur de comptabilité en partie double / écritures / journaux / grand livre,
assistant de clôture, états financiers réglementaires (bilan, compte de
résultat, TFT), invitation de comptable externe, simulation fiscale
approfondie, déclarations électroniques. Les écrans correspondants ne sont
**pas créés** tant qu'ils ne reposent pas sur un vrai moteur — conformément à
l'exigence explicite de ne jamais présenter de données fictives.

## 1. Ce qui existe déjà et est réutilisé tel quel

Recherche complète dans `packages/database/prisma/schema.prisma` et les
services API avant toute modification (voir aussi le journal d'analyse — ce
document en est la synthèse actionnable) :

- **Ventes boutique** : `PosSale`/`PosSaleLine`/`PosPayment` — revenu,
  encaissements confirmés (`PosPayment.confirmed`), marge (quand
  `Variant.costPrice` est renseigné). `PosService.dailyDashboard` distingue
  déjà CA / encaissements confirmés / marge et renvoie `marginReliable: false`
  quand la marge n'est pas calculable — ce principe de prudence est repris
  tel quel dans le tableau de bord Finance.
- **Commandes Marketplace** : `Order`/`ShopOrder`/`OrderPayment` — revenu
  (`subtotal`) et encaissements par sous-commande.
- **Achats** : `Supplier`/`Purchase` — réutilisés en l'état pour le total des
  achats, malgré leurs limites (voir §4, Reporté).
- **Charges** : `Expense` (module `apps/api/src/operations`) — réutilisé et
  étendu d'un champ `currency` (absent jusqu'ici, contrairement à `PosSale`/
  `ComptableEntry`).
- **Taux de change** : `PlatformSettings.cdfPerUsd` + `ExchangeRateHistory` —
  réutilisés pour l'affichage multidevise du tableau de bord ; aucun calcul
  fiscal ne convertit rétroactivement un montant déjà enregistré.
- **Abonnements/encaissements ELEGANZ** : `ShopSubscription`/`Invoice`
  (boutique), `DriverInvoice`, `ComptableInvoice` — réutilisés pour le
  tableau de bord Finance ELEGANZ (revenus par source), sans créer de
  quatrième table dupliquée.
- **Patron de conception repris de Mon Comptable** (`ComptableEntry`/
  `ComptableDebt`/`ComptableDebtPayment`) : séparation stricte par devise,
  jamais de fusion CDF/USD, distinction direction/catégorie — ce patron
  inspire le tableau de bord Finance, mais **aucune table de Mon Comptable
  n'est réutilisée directement** : ce module reste rattaché à `User`, jamais
  à `Shop`, et les deux restent des carnets séparés pour l'instant (voir
  Reporté : "unification Mon Comptable / Finance boutique").

## 2. Écarts confirmés (ne pas prétendre qu'ils sont comblés)

1. Aucun moteur de comptabilité en partie double (journaux/comptes/écritures
   équilibrées) n'existe nulle part dans la plateforme.
2. `ShopOrder.commissionAmount` existe dans le schéma mais n'est **jamais
   calculé ni écrit** par l'API (vérifié par recherche exhaustive) — toute
   donnée de commission affichée doit le dire explicitement ("à configurer").
3. `Supplier.balanceOwed` est un compteur brut, jamais historisé, et
   `Purchase` n'a pas de lignes ni de paiements échelonnés.
4. Aucun compte de trésorerie multidevise (caisse/banque/mobile money) —
   seules des lignes de transaction existent, pas de solde de compte.
5. Aucun taux de change figé par transaction — seul un taux système courant.
6. Aucun identifiant fiscal (NIF, RCCM, forme juridique) sur `Shop`.
7. `StaffRole.ACCOUNTANT` existe mais n'est câblé à aucune permission.

Ces écarts ne sont pas comblés dans cette phase, sauf le point 6 (ajout de
champs d'identité fiscale sur `Shop`, nécessaires à l'écran "Règles fiscales
applicables à la boutique").

## 3. Modèle de données ajouté (Phase 1)

### 3.1. Identité fiscale de la boutique

Champs ajoutés à `Shop` : `fiscalLegalName?`, `fiscalLegalForm?`,
`fiscalIdNumber?`, `fiscalAddress?`, `fiscalJurisdiction?`, `fiscalRegime?`,
`fiscalExercice?` (ex. "01/01-31/12"), `fiscalVatRegistered Boolean
@default(false)`. Tous optionnels et vides par défaut — rien n'est déduit ni
présumé pour une boutique qui ne les a pas renseignés.

### 3.2. Règles fiscales — architecture à 3 niveaux, une seule table

Le prompt exige une séparation stricte entre (1) le référentiel central,
(2) les paramètres de chaque boutique, et (3) le profil fiscal d'ELEGANZ
elle-même, **mise en œuvre dans le modèle de données et les contrôles
d'accès, pas seulement dans l'affichage**.

Décision d'architecture : un seul modèle `FiscalRule`, avec un champ
`scope` (`SHOP` | `PLATFORM`) et un `shopId` nullable (toujours rempli si
`scope=SHOP`, toujours `null` si `scope=PLATFORM`) — plutôt que deux ou trois
tables Prisma dupliquées. La séparation stricte exigée par le prompt est
appliquée **dans la couche service/contrôleur**, jamais par simple
confiance dans l'affichage :

- Les routes boutique (`/shops/:shopId/finance/fiscal-rules`) ne lisent et
  n'écrivent **jamais** que des lignes `scope=SHOP AND shopId=<cette
  boutique>` — vérifié par une clause `where` systématique côté service,
  jamais par un filtre côté frontend.
- Les routes admin (`/admin/finance/fiscal-rules`) ne lisent et n'écrivent
  **jamais** que des lignes `scope=PLATFORM` — une boutique n'a aucun moyen,
  même en forgeant une requête, d'atteindre ces lignes (le contrôleur ne
  prend même pas de `shopId` en paramètre pour cette route).
- Aucune route ne permet de modifier plusieurs boutiques à la fois, et
  aucun job ne propage un changement d'un `scope` vers l'autre : modifier
  une règle ELEGANZ ne touche jamais une ligne `shopId`, et réciproquement.

Ce choix (une table, deux scopes, séparation imposée par le code plutôt que
par le schéma) est documenté ici explicitement pour qu'une revue future sache
que c'est une décision assumée, pas un raccourci non voulu. Si un besoin futur
exige une isolation physique plus forte (ex. tables séparées par exigence
réglementaire), cette décision est reconsidérable sans perdre les données
(migration par simple `scope`/`shopId`).

```prisma
enum FiscalRuleScope { SHOP PLATFORM }
enum FiscalRuleCategory { TVA IMPOT RETENUE CONTRIBUTION AUTRE }
enum FiscalRuleStatus { PROPOSEE CONFIGUREE VERIFIEE OBSOLETE }

model FiscalRule {
  id               String   @id @default(uuid())
  scope            FiscalRuleScope
  shopId           String?
  shop             Shop?    @relation(fields: [shopId], references: [id])
  label            String
  category         FiscalRuleCategory
  rateOrFormula    String
  baseCalcul       String?
  champApplication String?
  regime           String?
  effectiveFrom    DateTime
  effectiveTo      DateTime?
  sourceReference  String?
  status           FiscalRuleStatus @default(PROPOSEE)
  lastModifiedBy   String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  versions FiscalRuleVersion[]

  @@index([shopId])
  @@index([scope])
}

model FiscalRuleVersion {
  id            String   @id @default(uuid())
  ruleId        String
  rule          FiscalRule @relation(fields: [ruleId], references: [id])
  oldValue      Json?
  newValue      Json
  authorId      String?
  motif         String?
  effectiveDate DateTime
  status        FiscalRuleStatus
  createdAt     DateTime @default(now())

  @@index([ruleId])
}
```

Statuts conformes au §5.5 du prompt : `PROPOSEE` (modèle préconfiguré, jamais
appliqué automatiquement), `CONFIGUREE` (ajustée par la boutique elle-même —
n'emporte aucune garantie de conformité légale du seul fait d'être
enregistrée, rappelé explicitement dans l'interface), `VERIFIEE` (vérifiée
par un professionnel identifié — **non implémenté à cette phase** : il n'y a
pas encore de mécanisme d'invitation de comptable externe, donc ce statut
existe dans le modèle mais ne peut être atteint aujourd'hui que par une
bascule manuelle, à documenter comme limite), `OBSOLETE`.

La fonction "Simuler les conséquences de cette modification" (§5.8) n'est
**pas implémentée** à cette phase (aucun moteur de calcul fiscal réel
n'existe encore pour simuler un impact) — l'écran l'indique honnêtement
("fonction à venir") plutôt que de simuler un résultat inventé.

### 3.3. Charges

`Expense` reçoit un champ `currency` (`"USD" | "CDF"`, défaut `"USD"`) pour
rester cohérent avec `PosSale.currency`. La liste de catégories de l'API
(`EXPENSE_CATEGORIES`) est réalignée sur la taxonomie du prompt (§8) :
Fonctionnement, Personnel, Charges administratives, Charges commerciales,
Fiscalité, Financement — en sous-catégories libres à l'intérieur de ces
six groupes, pour rester compatible avec les charges déjà enregistrées
(valeurs existantes conservées, pas de migration destructive).

## 4. Tableau de bord financier (boutique)

`GET /shops/:shopId/finance/dashboard?from=&to=` agrège, pour la période
demandée : CA (somme `PosSale.totalAmount` + `ShopOrder.subtotal`), achats
(somme `Purchase.amount`), charges (somme `Expense.amount`, par devise),
marge brute (réutilise le calcul de `PosService`, avec le même drapeau
`marginReliable`), résultat estimé (CA − achats − charges, **jamais** appelé
"résultat net" ni "bénéfice certifié" dans l'interface), trésorerie estimée
(somme des encaissements confirmés − somme des charges payées, explicitement
une estimation, pas un solde de compte réel puisqu'aucun compte de
trésorerie n'existe encore), dettes fournisseurs (`Supplier.balanceOwed`,
avec un avertissement sur sa fiabilité actuelle — voir §2 point 3), créances
clients (`ShopCustomer.creditBalance`), impôts dus (0 tant qu'aucune règle
fiscale n'a de montant calculé associé — pas de calcul fiscal automatique à
cette phase, uniquement la bibliothèque de règles).

Chaque chiffre du tableau de bord porte un statut visible : "estimation à
partir des opérations enregistrées" — jamais "certifié" ni "audité".

## 5. Mirror ELEGANZ (Centre de pilotage)

`GET /admin/finance/dashboard` sépare explicitement (conformément à
l'exemple des 100 $ / 10 $ de commission du prompt §13.3) :
- **(A)** valeur totale des transactions des vendeurs (somme des `ShopOrder.subtotal` + `PosSale.totalAmount`, tous vendeurs) — jamais présentée comme un revenu ELEGANZ ;
- **(B)** revenus réellement attribuables à ELEGANZ : abonnements boutique/Gestion (`Invoice`), abonnements Mon Comptable (`ComptableInvoice`), frais livreur (`DriverInvoice`) — réellement encaissés (`status=PAID`) vs facturés ;
- **(C)/(D)** commission marketplace : affichée à **0, avec la mention explicite "non implémentée"**, puisque `ShopOrder.commissionAmount` n'est jamais calculé aujourd'hui (voir §2 point 2) — afficher un chiffre inventé ici serait exactement l'erreur que le prompt interdit.

`/admin/finance/fiscal-rules` gère les lignes `FiscalRule{scope: PLATFORM}` —
complètement indépendantes des règles boutique, selon le modèle du §3.2.

## 6. Sécurité et confidentialité

- Toute route boutique passe par `ShopMembershipGuard` (isolation déjà
  éprouvée ailleurs dans le code) — une boutique ne peut jamais lire les
  données Finance d'une autre boutique.
- Les routes `/admin/finance/*` exigent un rôle `ADMIN_*` (même garde que le
  reste du Centre de pilotage) — un membre de boutique ne peut jamais les
  atteindre, et réciproquement un administrateur technique générique n'a pas
  un accès automatique aux règles fiscales d'une boutique via ces routes
  (il faudrait passer par les routes boutique, donc par `ShopMembershipGuard`,
  donc être réellement membre de cette boutique).
- Rôle `StaffRole.ACCOUNTANT` : les routes Finance boutique acceptent
  `OWNER, MANAGER, ACCOUNTANT` en écriture (lecture ouverte à tout membre
  actif) — première utilisation réelle de ce rôle, jusqu'ici non câblé.

## 7. Reporté (ne pas construire tant que l'étape précédente n'est pas réelle)

- Moteur de comptabilité en partie double (journaux, comptes, écritures,
  SYSCOHADA système normal/minimal de trésorerie) — nécessite un vrai plan
  comptable et des règles de génération d'écritures, à spécifier séparément.
- Assistant de clôture (14 étapes du prompt §11).
- États financiers réglementaires (bilan, compte de résultat, TFT, grand
  livre, balance) — dépendent du moteur en partie double ci-dessus.
- Invitation et accès d'un comptable/conseiller fiscal externe (le statut
  `VERIFIEE` du modèle `FiscalRule` existe mais n'a pas de flux
  d'invitation/vérification réel à cette phase).
- Fonction de simulation fiscale.
- Déclarations électroniques / transmission aux administrations.
- Immobilisations et amortissements.
- Analyses et prévisions (comparaisons de périodes, tendances, prévisions de
  trésorerie).
- Normalisation des trois tables d'invoice dupliquées (`Invoice`/
  `DriverInvoice`/`ComptableInvoice`).
- Compte de trésorerie multidevise réel (comptes avec solde, rapprochements).
- Unification Mon Comptable / Finance boutique (aujourd'hui deux carnets
  séparés, rattachés respectivement à `User` et à `Shop`).

## 8. Plan de tests (sous-ensemble réellement exécuté à cette phase)

Documenté avec résultats réels dans `docs/PROJECT_STATUS.md` après
implémentation — couvre au minimum : création/consultation d'une règle
fiscale boutique, historisation de version, isolation boutique A / boutique
B, isolation boutique / ELEGANZ (une boutique ne peut pas lire/écrire les
règles `scope=PLATFORM`), calcul du tableau de bord à partir de données QA
réelles, cohérence devise sur les charges.
