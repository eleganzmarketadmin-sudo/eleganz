import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/expense.dto";
import { AccountingService } from "../finance/accounting.service";

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  async create(shopId: string, dto: CreateExpenseDto) {
    const expense = await this.prisma.expense.create({
      data: {
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
      this.logger.error(`Comptabilisation de la dépense ${expense.id} échouée`, err);
    });

    return expense;
  }

  list(shopId: string) {
    return this.prisma.expense.findMany({ where: { shopId }, orderBy: { createdAt: "desc" } });
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
}
