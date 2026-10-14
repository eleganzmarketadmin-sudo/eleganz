import { ConflictException, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingSeedService } from "./accounting-seed.service";
import { FiscalRuleScope, JournalEntrySource } from "@eleganz/database";

interface LigneBrouillon {
  accountCode: string;
  debit?: number;
  credit?: number;
  label?: string;
}

// Mapping des 6 familles de charges (docs/ARCHITECTURE_FINANCE.md §3.3) vers
// les comptes de charges seedés — un groupe non reconnu tombe sur les
// "charges de fonctionnement" plutôt que de bloquer la comptabilisation.
const COMPTE_PAR_FAMILLE: Record<string, string> = {
  fonctionnement: "6220",
  personnel: "661",
  charges_administratives: "6221",
  charges_commerciales: "6222",
  fiscalite: "641",
  financement: "671",
};

// Chaque sous-catégorie de dépense (EXPENSE_CATEGORIES côté DTO) est
// rattachée à l'une des 6 familles ci-dessus. Tenu ici plutôt que dans le DTO
// pour que le mapping comptable reste la seule responsabilité de ce service.
const FAMILLE_PAR_CATEGORIE: Record<string, string> = {
  loyer: "fonctionnement",
  eau: "fonctionnement",
  electricite: "fonctionnement",
  internet: "fonctionnement",
  telecommunications: "fonctionnement",
  entretien: "fonctionnement",
  reparations: "fonctionnement",
  fournitures: "fonctionnement",
  abonnements_logiciels: "fonctionnement",
  salaires: "personnel",
  primes: "personnel",
  charges_sociales: "personnel",
  honoraires: "charges_administratives",
  frais_bancaires: "charges_administratives",
  assurances: "charges_administratives",
  transport: "charges_commerciales",
  carburant: "charges_commerciales",
  publicite: "charges_commerciales",
  promotions: "charges_commerciales",
  livraison: "charges_commerciales",
  emballages: "charges_commerciales",
  commissions: "charges_commerciales",
  impots_taxes: "fiscalite",
  interets_frais_financiers: "financement",
  remboursement_capital: "financement",
  // valeurs historiques antérieures à la taxonomie du 13 oct. 2026
  transport_livraison: "charges_commerciales",
  autre: "fonctionnement",
};

function compteCaisse(currency: string): string {
  return currency === "CDF" ? "5712" : "5711";
}

/**
 * Comptabilisation en partie double — voir docs/ARCHITECTURE_FINANCE.md
 * §8bis. Chaque méthode est appelée APRÈS l'opération métier existante
 * (jamais en réécrivant l'historique), et chaque écriture est gardée contre
 * la double comptabilisation par l'unicité [scope, shopId, sourceType,
 * sourceId] — appeler deux fois la même méthode pour la même source ne crée
 * jamais deux écritures (upsert implicite via try/catch sur la contrainte).
 */
@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seed: AccountingSeedService,
  ) {}

  async postPosSale(sale: { id: string; shopId: string; totalAmount: unknown; currency: string; status: string }) {
    if (sale.status === "CANCELLED") return;
    await this.seed.ensureShopChartOfAccounts(sale.shopId);
    const montant = Number(sale.totalAmount);
    await this.enregistrer({
      scope: FiscalRuleScope.SHOP,
      shopId: sale.shopId,
      journalCode: "VE",
      entryDate: new Date(),
      label: `Vente caisse ${sale.id.slice(0, 8)}`,
      sourceType: JournalEntrySource.POS_SALE,
      sourceId: sale.id,
      lignes: [
        { accountCode: compteCaisse(sale.currency), debit: montant },
        { accountCode: "701", credit: montant },
      ],
    });
  }

  async postExpense(expense: { id: string; shopId: string; amount: unknown; currency: string; category: string }) {
    await this.seed.ensureShopChartOfAccounts(expense.shopId);
    const montant = Number(expense.amount);
    const famille = FAMILLE_PAR_CATEGORIE[expense.category] ?? "fonctionnement";
    const compteCharge = COMPTE_PAR_FAMILLE[famille] ?? COMPTE_PAR_FAMILLE.fonctionnement;
    await this.enregistrer({
      scope: FiscalRuleScope.SHOP,
      shopId: expense.shopId,
      journalCode: "OD",
      entryDate: new Date(),
      label: `Charge (${expense.category}) ${expense.id.slice(0, 8)}`,
      sourceType: JournalEntrySource.EXPENSE,
      sourceId: expense.id,
      lignes: [
        { accountCode: compteCharge, debit: montant },
        { accountCode: compteCaisse(expense.currency), credit: montant },
      ],
    });
  }

  async postPurchase(purchase: { id: string; amount: unknown; onCredit: boolean }, shopId: string) {
    await this.seed.ensureShopChartOfAccounts(shopId);
    const montant = Number(purchase.amount);
    // Purchase.amount ne porte pas de devise à ce jour (voir
    // docs/ARCHITECTURE_FINANCE.md §8bis.3) — hypothèse USD par défaut,
    // cohérente avec le reste du module avant l'ajout de Expense.currency.
    await this.enregistrer({
      scope: FiscalRuleScope.SHOP,
      shopId,
      journalCode: "AC",
      entryDate: new Date(),
      label: `Achat ${purchase.id.slice(0, 8)}`,
      sourceType: JournalEntrySource.PURCHASE,
      sourceId: purchase.id,
      lignes: [
        { accountCode: "601", debit: montant },
        purchase.onCredit ? { accountCode: "401", credit: montant } : { accountCode: compteCaisse("USD"), credit: montant },
      ],
    });
  }

  /**
   * Comptabilisée une seule fois, à la réception confirmée par l'acheteur
   * (RECEIVED_CONFIRMED) ou à la clôture — jamais à la simple création de la
   * commande. Débit 411 (créance envers la plateforme) : rien ne modélise
   * encore le reversement réel des fonds par ELEGANZ à la boutique, donc ce
   * compte ne se solde jamais automatiquement — limite assumée et redite
   * dans l'écran grand livre (voir docs/ARCHITECTURE_FINANCE.md §8bis.3).
   */
  async postShopOrderReceived(shopOrder: { id: string; shopId: string; subtotal: unknown }, currency: string) {
    await this.seed.ensureShopChartOfAccounts(shopOrder.shopId);
    const montant = Number(shopOrder.subtotal);
    await this.enregistrer({
      scope: FiscalRuleScope.SHOP,
      shopId: shopOrder.shopId,
      journalCode: "VE",
      entryDate: new Date(),
      label: `Vente Marketplace ${shopOrder.id.slice(0, 8)}`,
      sourceType: JournalEntrySource.SHOP_ORDER,
      sourceId: shopOrder.id,
      lignes: [
        { accountCode: "411", debit: montant },
        { accountCode: "7012", credit: montant },
      ],
    });
  }

  /** Revenu ELEGANZ reconnu au règlement effectif (status=PAID), jamais à la facturation. */
  async postPlatformInvoicePaid(invoice: { id: string; amount: unknown }, source: "invoice" | "driverInvoice" | "comptableInvoice") {
    await this.seed.ensurePlatformChartOfAccounts();
    const montant = Number(invoice.amount);
    await this.enregistrer({
      scope: FiscalRuleScope.PLATFORM,
      shopId: null,
      journalCode: "TR",
      entryDate: new Date(),
      label: `Encaissement ELEGANZ (${source}) ${invoice.id.slice(0, 8)}`,
      sourceType: JournalEntrySource.INVOICE,
      sourceId: `${source}:${invoice.id}`,
      lignes: [
        { accountCode: compteCaisse("USD"), debit: montant },
        { accountCode: "706", credit: montant },
      ],
    });
  }

  /**
   * Dotation aux amortissements d'un actif pour un mois donné
   * (docs/ARCHITECTURE_FINANCE.md §8quater) — appelé par AssetsService,
   * jamais calculé ici (ce service ne fait que comptabiliser un montant déjà
   * calculé). `sourceId` inclut le mois (AAAA-MM) pour que la contrainte
   * d'unicité sur JournalEntry empêche toute double comptabilisation du
   * même mois pour le même actif.
   */
  async postAssetDepreciation(shopId: string, asset: { id: string; label: string }, periodDate: Date, montant: number) {
    await this.seed.ensureShopChartOfAccounts(shopId);
    const moisCle = periodDate.toISOString().slice(0, 7);
    await this.enregistrer({
      scope: FiscalRuleScope.SHOP,
      shopId,
      journalCode: "OD",
      entryDate: periodDate,
      label: `Dotation amortissement — ${asset.label} (${moisCle})`,
      sourceType: JournalEntrySource.DEPRECIATION,
      sourceId: `asset:${asset.id}:${moisCle}`,
      lignes: [
        { accountCode: "681", debit: montant },
        { accountCode: "2841", credit: montant },
      ],
    });
  }

  /**
   * Réception de stock valorisée (chantier SYSCOHADA, phase 4 — stock &
   * CMV, 14 oct. 2026). Débite 311 (Marchandises) plutôt que 601 (Achats) :
   * contrairement à `postPurchase`, cette écriture constate une entrée en
   * stock valorisée au coût réel, pas une charge d'achat immédiate — la
   * charge (603, variation de stock) n'est constatée qu'à la SORTIE
   * (vente), pas encore câblée à cette phase (voir docs/PLAN_COMMERCIAL.md).
   */
  async postReceptionStock(reception: { id: string; shopId: string; montant: number; onCredit: boolean }) {
    await this.seed.ensureShopChartOfAccounts(reception.shopId);
    await this.enregistrer({
      scope: FiscalRuleScope.SHOP,
      shopId: reception.shopId,
      journalCode: "AC",
      entryDate: new Date(),
      label: `Réception de stock ${reception.id.slice(0, 8)}`,
      sourceType: JournalEntrySource.PURCHASE,
      sourceId: `reception:${reception.id}`,
      lignes: [
        { accountCode: "311", debit: reception.montant },
        reception.onCredit
          ? { accountCode: "401", credit: reception.montant }
          : { accountCode: compteCaisse("USD"), credit: reception.montant },
      ],
    });
  }

  /**
   * Mouvement manuel de trésorerie (dépôt, retrait, virement, frais
   * bancaires...) sur un TresorerieCompte — chantier SYSCOHADA, phase 2
   * (14 oct. 2026). `compteAccountCode` est le sous-compte dédié déjà créé
   * par TresorerieComptesService (ex. "521-01"), jamais un compte générique
   * partagé entre plusieurs comptes réels. `sourceId` est fourni par
   * l'appelant (id du Rapprochement ou uuid généré) pour que la contrainte
   * d'unicité protège contre un double envoi du même formulaire.
   */
  async postMouvementTresorerie(params: {
    scope: FiscalRuleScope;
    shopId: string | null;
    compteAccountCode: string;
    contrepartieAccountCode: string;
    montant: number;
    sens: "ENTREE" | "SORTIE";
    label: string;
    date: Date;
    sourceId: string;
  }) {
    if (params.scope === FiscalRuleScope.SHOP && params.shopId) {
      await this.seed.ensureShopChartOfAccounts(params.shopId);
    } else {
      await this.seed.ensurePlatformChartOfAccounts();
    }
    const ligneCompte =
      params.sens === "ENTREE"
        ? { accountCode: params.compteAccountCode, debit: params.montant }
        : { accountCode: params.compteAccountCode, credit: params.montant };
    const ligneContrepartie =
      params.sens === "ENTREE"
        ? { accountCode: params.contrepartieAccountCode, credit: params.montant }
        : { accountCode: params.contrepartieAccountCode, debit: params.montant };

    await this.enregistrer({
      scope: params.scope,
      shopId: params.shopId,
      journalCode: "TR",
      entryDate: params.date,
      label: params.label,
      sourceType: JournalEntrySource.TRESORERIE_MOUVEMENT,
      sourceId: params.sourceId,
      lignes: [ligneCompte, ligneContrepartie],
    });
  }

  private async enregistrer(params: {
    scope: FiscalRuleScope;
    shopId: string | null;
    journalCode: string;
    entryDate: Date;
    label: string;
    sourceType: JournalEntrySource;
    sourceId: string;
    lignes: LigneBrouillon[];
  }) {
    const totalDebit = params.lignes.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCredit = params.lignes.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      // Ne doit jamais arriver si les méthodes ci-dessus sont correctes —
      // préféré à un silence qui laisserait une écriture déséquilibrée.
      throw new InternalServerErrorException(
        `Écriture déséquilibrée refusée (débit ${totalDebit} ≠ crédit ${totalCredit}) pour ${params.sourceType} ${params.sourceId}.`,
      );
    }

    // Verrouillage de période (docs/ARCHITECTURE_FINANCE.md §8quinquies) —
    // toute écriture dont la date tombe dans un mois clôturé est refusée,
    // qu'elle vienne d'une vente du jour ou d'une dotation d'amortissement
    // rétroactive.
    const debutMoisEntree = new Date(Date.UTC(params.entryDate.getUTCFullYear(), params.entryDate.getUTCMonth(), 1));
    const cloture = await this.prisma.accountingClosure.findFirst({
      where: { scope: params.scope, shopId: params.shopId, periodDate: debutMoisEntree },
      select: { id: true },
    });
    if (cloture) {
      throw new ConflictException(
        `La période ${debutMoisEntree.toISOString().slice(0, 7)} est clôturée : aucune nouvelle écriture n'est acceptée pour ce mois.`,
      );
    }

    const journalId = await this.seed.journalId(params.scope, params.shopId, params.journalCode);
    const accountIds = await Promise.all(
      params.lignes.map((l) => this.seed.accountId(params.scope, params.shopId, l.accountCode)),
    );

    try {
      await this.prisma.journalEntry.create({
        data: {
          scope: params.scope,
          shopId: params.shopId,
          journalId,
          entryDate: params.entryDate,
          label: params.label,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          lines: {
            create: params.lignes.map((l, i) => ({
              accountId: accountIds[i],
              debit: l.debit ?? 0,
              credit: l.credit ?? 0,
              label: l.label,
            })),
          },
        },
      });
    } catch (err: unknown) {
      // Contrainte unique [scope, shopId, sourceType, sourceId] : cette
      // opération a déjà été comptabilisée — ignoré volontairement plutôt
      // que de faire échouer l'opération métier qui a déclenché cet appel.
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
        this.logger.debug(`Écriture déjà comptabilisée pour ${params.sourceType} ${params.sourceId}, ignorée.`);
        return;
      }
      throw err;
    }
  }
}
