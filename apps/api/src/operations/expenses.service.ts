import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/expense.dto";

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  create(shopId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: { shopId, category: dto.category, amount: dto.amount, note: dto.note },
    });
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
