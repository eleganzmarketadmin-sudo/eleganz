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

## 8bis. Moteur de comptabilité en partie double (13 oct. 2026, Phase 2)

Démarré sur autorisation explicite du propriétaire ("démarrer", en réponse à
la question posée sur la priorité parmi les points différés du §7). Couvre
le premier point du §7 ci-dessus : **le §7 reste la liste de ce qui n'est
toujours pas livré par cette phase**, hormis le moteur en partie double
lui-même. Ce moteur reste volontairement minimal — assez pour produire un
journal général, un grand livre et une balance **réels** (alimentés par les
opérations déjà enregistrées), pas un système comptable complet au sens
SYSCOHADA (pas de clôture, pas d'états financiers réglementaires, pas de
gestion d'exercice verrouillé — ces points restent au §7).

### 9.1. Modèle de données

Réutilise le patron déjà validé pour `FiscalRule` (une seule table par
concept, séparée par `scope` SHOP/PLATFORM + `shopId` nullable, isolation
imposée côté service/contrôleur) :

```prisma
enum AccountNormalSide { DEBIT CREDIT }

model Account {
  id            String          @id @default(uuid())
  scope         FiscalRuleScope
  shopId        String?
  shop          Shop?           @relation(fields: [shopId], references: [id])
  code          String          // ex. "571", "701", "601" (SYSCOHADA révisé)
  label         String
  normalSide    AccountNormalSide
  systemDefined Boolean         @default(true) // seedé automatiquement vs créé manuellement
  active        Boolean         @default(true)
  createdAt     DateTime        @default(now())

  debitLines  JournalLine[] @relation("AccountDebitLines")
  // (une seule relation JournalLine -> Account ; voir modèle ci-dessous)

  @@unique([scope, shopId, code])
  @@index([scope, shopId])
}

enum JournalEntrySource { POS_SALE SHOP_ORDER EXPENSE PURCHASE INVOICE MANUAL }

model Journal {
  id      String          @id @default(uuid())
  scope   FiscalRuleScope
  shopId  String?
  shop    Shop?           @relation(fields: [shopId], references: [id])
  code    String          // VE (ventes), AC (achats), TR (trésorerie), OD (opérations diverses)
  label   String

  entries JournalEntry[]

  @@unique([scope, shopId, code])
}

model JournalEntry {
  id         String              @id @default(uuid())
  scope      FiscalRuleScope
  shopId     String?
  shop       Shop?               @relation(fields: [shopId], references: [id])
  journalId  String
  journal    Journal             @relation(fields: [journalId], references: [id])
  entryDate  DateTime
  label      String
  sourceType JournalEntrySource
  sourceId   String?             // id de PosSale/ShopOrder/Expense/Purchase/Invoice — null si MANUAL
  createdAt  DateTime            @default(now())

  lines JournalLine[]

  // Empêche une double comptabilisation de la même opération source — des
  // écritures MANUAL (sourceId = null) ne se bloquent jamais entre elles
  // (NULL n'entre jamais en conflit avec un index unique Postgres).
  @@unique([scope, shopId, sourceType, sourceId])
  @@index([scope, shopId, entryDate])
}

model JournalLine {
  id      String  @id @default(uuid())
  entryId String
  entry   JournalEntry @relation(fields: [entryId], references: [id])
  accountId String
  account   Account    @relation(fields: [accountId], references: [id])
  debit   Decimal @default(0) @db.Decimal(12, 2)
  credit  Decimal @default(0) @db.Decimal(12, 2)
  label   String?

  @@index([entryId])
  @@index([accountId])
}
```

Toute écriture (`JournalEntry` + ses `JournalLine`) est créée dans une seule
transaction Prisma, avec un contrôle systématique **avant insertion** :
somme des débits = somme des crédits de l'écriture, sinon l'opération est
rejetée (`InternalServerErrorException`) plutôt que d'enregistrer une
écriture déséquilibrée — aucune exception à cette règle, y compris pour les
écritures générées automatiquement.

### 9.2. Plan comptable minimal seedé (par boutique, et séparément pour ELEGANZ)

Comptes SYSCOHADA révisé réellement utilisés par les règles de
comptabilisation ci-dessous (liste volontairement courte — un compte n'est
créé que s'il sert à une écriture réelle générée par le code, jamais pour
« faire complet ») :

| Code | Libellé | Sens normal |
|------|---------|--------------|
| 5711 | Caisse USD | Débit |
| 5712 | Caisse CDF | Débit |
| 411  | Clients (créances, dont créances Marketplace à recevoir de la plateforme) | Débit |
| 401  | Fournisseurs (dettes) | Crédit |
| 601  | Achats de marchandises | Débit |
| 6220 | Charges de fonctionnement | Débit |
| 6221 | Charges administratives | Débit |
| 6222 | Charges commerciales | Débit |
| 661  | Charges de personnel | Débit |
| 641  | Impôts et taxes | Débit |
| 671  | Charges financières | Débit |
| 701  | Ventes de marchandises (caisse) | Crédit |
| 7012 | Ventes Marketplace | Crédit |

Côté ELEGANZ (`scope=PLATFORM`), un plan séparé et plus court : `5711`/`5712`
(trésorerie ELEGANZ), `411` (sommes dues par les boutiques, non utilisé tant
qu'aucune facture n'est en retard), `706` (produits des abonnements et
services, alimenté par `Invoice`/`DriverInvoice`/`ComptableInvoice` réglées).
**Aucun compte de type « sommes à reverser aux vendeurs » n'est alimenté
automatiquement** : la commission Marketplace (`ShopOrder.commissionAmount`)
n'est toujours pas calculée (§2 point 2), donc aucune écriture ne doit
inventer un montant de sommes collectées pour compte de tiers — ce point
reste listé au §7 (états financiers, trésorerie réelle) tant que la
commission elle-même n'est pas implémentée.

Le seed (`AccountingSeedService.ensureShopChartOfAccounts(shopId)` /
`ensurePlatformChartOfAccounts()`) est **idempotent** et appelé paresseusement
avant la première comptabilisation d'une boutique (`upsert` sur
`[scope, shopId, code]`) plutôt que par une migration de données — une
boutique déjà existante reçoit son plan comptable à sa première opération
comptabilisée, sans script de rattrapage distinct à exécuter.

### 9.3. Règles de comptabilisation automatique (`AccountingService`)

Déclenchée **après** l'opération métier existante (jamais en réécrivant
l'historique), avec l'écriture gardée par l'unicité `[scope, shopId,
sourceType, sourceId]` ci-dessus — appeler deux fois la comptabilisation
d'une même vente ne crée jamais deux écritures.

- **`PosSale`** (vente caisse, statut `COMPLETED`) : Débit Caisse (5711 ou
  5712 selon `PosSale.currency`) du montant `totalAmount`, Crédit `701`. Le
  commentaire du modèle `PosSaleLine` rappelle que l'argent est réellement
  encaissé à la caisse — pas de créance client ici.
- **`Expense`** : Débit le compte de charge correspondant au groupe de la
  catégorie (mapping statique des 6 familles du §3.3 vers 6220/6221/6222/
  661/641/671), Crédit Caisse (5711/5712 selon `Expense.currency`) — une
  charge est supposée payée immédiatement, cohérent avec l'absence de notion
  de « charge à payer » dans le schéma actuel (limite documentée, pas
  comblée ici).
- **`Purchase`** : Débit `601`, Crédit `401` si `Purchase.onCredit` (champ
  ajouté cette phase — jusqu'ici `onCredit` n'existait que comme paramètre
  transitoire du DTO, jamais conservé ; voir §9.4), sinon Crédit Caisse. Les
  achats ne portent pas de devise dans le schéma actuel (`Purchase.amount`
  sans `currency`) — limite déjà connue, non comblée ici ; la comptabilisation
  suppose USD par défaut comme le reste du module avant l'ajout de
  `Expense.currency`, et l'écran correspondant le rappelle.
- **`ShopOrder`** (commande Marketplace) : comptabilisée **une seule fois**,
  au passage à `RECEIVED_CONFIRMED` ou `CLOSED` (réception confirmée) : Débit
  `411` (créance envers la plateforme — la boutique a vendu mais rien ne
  modélise encore le reversement réel des fonds par ELEGANZ), Crédit `7012`
  du `subtotal`. **Limite assumée et documentée** : rien ne vient
  automatiquement solder ce compte `411` à la réception effective des fonds,
  puisqu'aucun mécanisme de reversement réel n'existe encore (voir §7,
  « Compte de trésorerie multidevise réel ») — la créance reste donc ouverte
  indéfiniment dans le grand livre jusqu'à ce qu'un vrai flux de reversement
  soit modélisé. Ce n'est pas un bug caché : c'est documenté ici et redit
  dans l'écran grand livre/balance.
- **`Invoice`/`DriverInvoice`/`ComptableInvoice`** (scope PLATFORM, revenu
  ELEGANZ) : comptabilisées au passage à `status=PAID` uniquement (jamais à
  la facturation) : Débit Caisse ELEGANZ, Crédit `706`.

Aucune règle de TVA n'écrit automatiquement dans `445` : la bibliothèque de
règles fiscales (§3.2) n'a toujours pas de moteur de calcul réel (§3.2, note
sur la fonction de simulation), donc aucune écriture fiscale n'est générée
tant que ce calcul n'existe pas — afficher une TVA automatique inventée
serait exactement l'erreur que le prompt interdit.

### 9.4. Petit complément de schéma lié (`Purchase.onCredit`)

`Purchase.onCredit Boolean @default(false)` est ajouté au modèle existant
(champ manquant jusqu'ici : `SuppliersService.recordPurchase` recevait déjà
`dto.onCredit` mais ne le conservait pas sur l'enregistrement, seulement sur
`Supplier.balanceOwed` de façon globale — voir §2 point 3, qui reste
partiellement vrai : toujours aucune ligne de paiement échelonné, mais
chaque achat sait désormais s'il a été fait à crédit). Changement additif,
non destructif : les achats déjà enregistrés reçoivent `false` par défaut
(hypothèse "payé" pour l'historique, la plus sûre pour ne pas créer de dette
fournisseur rétroactive inventée).

### 9.5. API et écrans

- `GET /shops/:shopId/finance/journal?from=&to=&journal=` — journal général
  (toutes écritures, triées par date), gardé par `ShopMembershipGuard`.
- `GET /shops/:shopId/finance/grand-livre?compte=` — mouvements d'un compte
  + solde cumulé.
- `GET /shops/:shopId/finance/balance?from=&to=` — balance (tous comptes,
  total débit/crédit/solde), avec un contrôle de cohérence affiché (somme
  débit = somme crédit sur toute la période, sinon un signal d'anomalie
  visible plutôt que masqué).
- Mêmes trois routes en miroir sous `/admin/finance/...` (scope PLATFORM
  uniquement, même séparation stricte qu'au §3.2/§5/§6).
- Écran `/finance/comptabilite` (et son miroir `/admin/finance/comptabilite`)
  présente le journal, un sélecteur de compte pour le grand livre, et la
  balance — toujours avec la mention « généré automatiquement à partir des
  opérations enregistrées, ne remplace pas une comptabilité tenue par un
  professionnel » (cohérent avec le statut `CONFIGUREE` jamais présenté comme
  `VERIFIEE` au §3.2).

### 9.6. Ce qui reste déclaré non comblé par ce chantier

Le §7 ci-dessus reste la référence : ce chantier livre uniquement le moteur
d'écritures (journal/grand livre/balance réels), pas la clôture, pas les
états financiers réglementaires (bilan/compte de résultat/TFT — qui
nécessiteront des règles de regroupement par classe de compte, non
construites ici), pas de verrouillage d'exercice, pas de rapprochement
bancaire. La créance Marketplace (`411`) qui ne se solde jamais
automatiquement (§9.3) est une limite connue et assumée, pas une régression
silencieuse.

## 8ter. États financiers réglementaires simplifiés (13 oct. 2026, Phase 3)

Chantier choisi par le propriétaire parmi les points différés au §9.6, dans la
continuité directe de la Phase 2 (§8bis) : le moteur de comptabilité en partie
double existe déjà et génère des écritures réelles équilibrées ; ce chantier
ajoute uniquement une **lecture regroupée** de ces mêmes écritures par classe
de compte, sans aucune nouvelle écriture ni nouvelle table.

### 9bis.1. Ce qui est construit

- **Compte de résultat** (sur une période `[from, to)`) : regroupe les comptes
  de classe 6 (charges, solde normal débiteur) et de classe 7 (produits,
  solde normal créditeur) du plan comptable minimal déjà seedé (§9.2),
  calcule `résultat net = total produits − total charges`.
- **Bilan** (à une date donnée `asOf`) : regroupe les comptes de classes 1 à 5
  cumulés **depuis l'origine** (pas seulement sur la période affichée) —
  actif = comptes à solde normal débiteur (411 Clients, 5711/5712 Caisse),
  passif = comptes à solde normal créditeur (401 Fournisseurs). Le résultat
  net cumulé depuis l'origine (classes 6/7) est ajouté au passif en
  « Résultat net de l'exercice » pour équilibrer le bilan — convention
  standard en l'absence d'un compte de capital social saisi par ailleurs
  (aucun compte de classe 1 n'est seedé à ce jour : le plan comptable
  minimal du §9.2 ne modélise ni apport ni capital).
- Nouvelles méthodes `AccountingQueryService.compteDeResultat()` et
  `.bilan()`, nouvelles routes `GET /shops/:shopId/finance/compte-resultat`,
  `GET /shops/:shopId/finance/bilan` et leurs miroirs
  `/admin/finance/compte-resultat` / `/admin/finance/bilan` (scope PLATFORM).
- Écran `/finance/comptabilite` : deux nouvelles entrées dans le sélecteur
  « Vue » (Compte de résultat, Bilan) ; écran admin : sections ajoutées sous
  le journal/la balance existants.

### 9bis.2. Ce que ce chantier ne livre toujours pas

Conformément au §9.6 : ni clôture de période (chantier séparé, §voir tâche
« Assistant de clôture »), ni verrouillage d'exercice, ni TFT (tableau des
flux de trésorerie — nécessiterait un suivi des mouvements de trésorerie par
nature, pas seulement les soldes des comptes 5711/5712), ni rapprochement
bancaire, ni sous-totaux réglementaires détaillés (résultat d'exploitation /
financier / HAO séparés — le plan comptable minimal actuel ne distingue pas
ces trois blocs par des comptes dédiés). Ces états restent des **estimations
générées automatiquement**, jamais un substitut à une liasse fiscale établie
par un professionnel — la même réserve déjà affichée pour le reste du module.

## 8quater. Immobilisations et amortissements (13 oct. 2026, Phase 4)

Chantier choisi par le propriétaire parmi les points différés au §7/§9.6,
dans la continuité de la Phase 3 (§8ter). Amortissement **linéaire
uniquement** — aucune autre méthode (dégressif, etc.) à cette phase.

### 9ter.1. Ce qui est construit

- Nouveaux modèles `Asset` (une immobilisation : libellé, date
  d'acquisition, coût, durée d'amortissement en mois, statut mis au rebut)
  et `AssetDepreciation` (une ligne par mois réellement comptabilisé pour un
  actif donné — clé composite `[assetId, periodDate]` **sans champ
  nullable**, donc sans le piège déjà documenté dans `MAINTENANCE.md`).
- Nouveaux comptes seedés pour la boutique : `2441` (Matériel et mobilier de
  bureau, actif), `2841` (Amortissements du matériel, contra-actif
  créditeur bien que classe 2), `681` (Dotations aux amortissements,
  charge). Nouvelle valeur d'enum `JournalEntrySource.DEPRECIATION`.
- `AssetsService.runDepreciationForMonth(shopId, periodDate)` : pour chaque
  immobilisation active dont la durée n'est pas écoulée, calcule la dotation
  mensuelle (coût ÷ durée) et la comptabilise (Débit 681 / Crédit 2841) via
  `AccountingService.postAssetDepreciation()`. **Action explicite
  déclenchée par l'utilisateur** (bouton « Comptabiliser les dotations »
  dans l'écran Immobilisations, avec le mois en paramètre) — **pas de
  scheduler serveur à cette phase** : présenter une comptabilisation
  automatique mensuelle silencieuse serait mentir sur ce qui tourne
  réellement. Idempotent par actif et par mois.
- `AccountingQueryService.bilan()` modifié : les comptes dont le code
  commence par `28` (amortissements, contra-actif) sont désormais présentés
  en **déduction de l'actif** (valeur nette comptable), pas comme une ligne
  de passif — traitement comptable standard, nécessaire pour qu'un bilan
  avec immobilisations reste à la fois équilibré et lisible.
- Nouvelles routes `shops/:shopId/assets` (GET liste, POST création, POST
  `:assetId/mise-au-rebut`, POST `depreciation/run?period=AAAA-MM`).
- Nouvel onglet **Immobilisations** dans `/finance` (ELEGANZ Gestion) :
  formulaire de création, liste avec valeur nette calculée, mise au rebut,
  et le bouton de comptabilisation des dotations du mois choisi.

### 9ter.2. Ce que ce chantier ne livre pas

Pas de comptabilisation automatique périodique (voir ci-dessus — choix
assumé, pas un oubli) ; pas de table de durées réglementaires par catégorie
d'immobilisation (durée saisie librement par l'utilisateur) ; pas
d'amortissement dégressif ni d'autres méthodes ; pas de miroir ELEGANZ
(immobilisations non pertinentes pour la plateforme elle-même à ce stade,
aucun actif propre modélisé ailleurs dans l'application) ; pas de plus/
moins-value de cession calculée à la mise au rebut (le statut est
enregistré, mais aucune écriture de sortie d'actif n'est générée — limite
connue, à traiter si un besoin réel apparaît).

## 8quinquies. Assistant de clôture de période (13 oct. 2026, Phase 5)

Chantier choisi par le propriétaire parmi les points différés au §9.6.
Verrouille un mois comptable et fige un résumé, sans transformer l'outil en
registre légalement immuable (la réouverture reste possible).

### 9quater.1. Ce qui est construit

- Nouveau modèle `AccountingClosure` (`scope`, `shopId`, `periodDate`,
  totaux débit/crédit et résultat net figés au moment de la clôture,
  `closedBy`).
- `AccountingService.enregistrer()` (point d'entrée unique de toute
  écriture, quel que soit son origine) refuse désormais toute écriture dont
  la date tombe dans un mois déjà clôturé (`ConflictException`). Comme les
  appelants (`ExpensesService`, `PosService`, etc.) avalent déjà l'échec de
  comptabilisation sans annuler l'opération métier (`.catch(... logger.error)`
  — décision déjà prise en Phase 2), clôturer un mois ne bloque jamais une
  vente ou une dépense réelle : seule son écriture comptable échoue
  silencieusement (journalisée côté serveur), ce qui est le comportement
  voulu pour un mois qu'on a choisi de clôturer.
- `ClosureService.close()` : calcule et fige le résumé (balance + compte de
  résultat du mois, déjà construits en Phase 2/3) puis verrouille.
  `.reopen()` : supprime la clôture (réouverture assumée, pas un registre
  légalement immuable à ce stade de maturité du produit). `.list()` :
  historique des clôtures.
- Routes `GET/POST shops/:shopId/finance/clotures`,
  `DELETE shops/:shopId/finance/clotures/:periode` (+ miroir
  `/admin/finance/clotures`).
- Nouvel onglet **Clôture** dans `/finance` (ELEGANZ Gestion) : choix du
  mois, bouton de clôture, historique avec réouverture.

### 9quater.2. Ce que ce chantier ne livre pas

Pas de clôture d'exercice annuel distincte (un exercice se clôture ici mois
par mois, sans notion de report à nouveau ni d'affectation du résultat) ;
pas de génération de liasse fiscale à la clôture ; pas de rôle dédié
"peut clôturer mais pas rouvrir" (même permission OWNER/MANAGER/ACCOUNTANT
pour les deux actions, comme pour le reste du module) ; pas de verrouillage
au niveau de la base de données (uniquement applicatif, dans
`AccountingService.enregistrer()` — une écriture insérée par un autre
chemin que ce service contournerait le verrou, mais aucun chemin de ce type
n'existe dans le code à ce jour).

## 8. Plan de tests (sous-ensemble réellement exécuté à cette phase)

Documenté avec résultats réels dans `docs/PROJECT_STATUS.md` après
implémentation — couvre au minimum : création/consultation d'une règle
fiscale boutique, historisation de version, isolation boutique A / boutique
B, isolation boutique / ELEGANZ (une boutique ne peut pas lire/écrire les
règles `scope=PLATFORM`), calcul du tableau de bord à partir de données QA
réelles, cohérence devise sur les charges.
