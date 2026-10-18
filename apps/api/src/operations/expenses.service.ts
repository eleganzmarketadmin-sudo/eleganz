import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/expense.dto";
import { AccountingService } from "../finance/accounting.service";
import { FiscalRuleScope } from "@eleganz/database";

/**
 * Généralisé au scope PLATFORM le 18 oct. 2026 (audit du 18 oct. 2026,
 * point 7 : "Charges et créances/dettes plateforme") — même pattern que
 * FiscalRulesService/AssetsService : chaque méthode publique
 * "ForShop" (implicite, noms historiques inchangés)/"ForPlatform" filtre
 * systématiquement sur son scope.
 */
@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  // --- Boutique (scope=SHOP) ---------------------------------------------

  async create(shopId: string, dto: CreateExpenseDto) {
    return this.creer(FiscalRuleScope.SHOP, shopId, dto);
  }

  list(shopId: string) {
    return this.lister(FiscalRuleScope.SHOP, shopId);
  }

  // Total des dépenses sur une période — utilisé par le futur tableau de
  // bord consolidé pour ne jamais présenter le CA brut comme un bénéfice
  // (complément stratégique §4 : distinguer CA, marge brute et bénéfice).
  async totalForPeriod(shopId: string, from: Date, to: Date) {
    const result = await this.prisma.expense.aggregate({
      where: { shopId, createdAt: { gte: from, lt: to } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  // --- ELEGANZ elle-même (scope=PLATFORM) --------------------------------

  async createForPlatform(dto: CreateExpenseDto) {
    return this.creer(FiscalRuleScope.PLATFORM, null, dto);
  }

  listForPlatform() {
    return this.lister(FiscalRuleScope.PLATFORM, null);
  }

  // --- Logique partagée ----------------------------------------------------

  private async creer(scope: FiscalRuleScope, shopId: string | null, dto: CreateExpenseDto) {
    const expense = await this.prisma.expense.create({
      data: {
        scope,
        shopId,
        category: dto.category,
        amount: dto.amount,
        currency: dto.currency ?? "USD",
        note: dto.note,
      },
    });

    // Comptabilisation après coup (docs/ARCHITECTURE_FINANCE.md §8bis) — une
    // dépense déjà enregistrée n'est jamais annulée par un échec d'écriture.
    await this.accounting.postExpense(expense).catch((err) => {
      this.logger.error(`ACCOUNTING_POSTING_FAILED comptabilisation de la dépense ${expense.id} échouée`, err);
    });

    return expense;
  }

  private lister(scope: FiscalRuleScope, shopId: string | null) {
    return this.prisma.expense.findMany({ where: { scope, shopId }, orderBy: { createdAt: "desc" } });
  }
}
