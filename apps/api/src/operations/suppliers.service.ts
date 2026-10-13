import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSupplierDto, RecordPurchaseDto } from "./dto/supplier.dto";
import { AccountingService } from "../finance/accounting.service";

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  create(shopId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: { shopId, name: dto.name, phone: dto.phone } });
  }

  list(shopId: string) {
    return this.prisma.supplier.findMany({ where: { shopId }, include: { purchases: true } });
  }

  async recordPurchase(supplierId: string, dto: RecordPurchaseDto) {
    const purchase = await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          supplierId,
          amount: dto.amount,
          // Conservé sur l'achat lui-même depuis le 13 oct. 2026 (moteur
          // comptable) — voir docs/ARCHITECTURE_FINANCE.md §8bis.4.
          onCredit: !!dto.onCredit,
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
        },
      });

      if (dto.onCredit) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { balanceOwed: { increment: dto.amount } },
        });
      }

      return purchase;
    });

    const supplier = await this.prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    await this.accounting.postPurchase(purchase, supplier.shopId).catch((err) => {
      this.logger.error(`Comptabilisation de l'achat ${purchase.id} échouée`, err);
    });

    return purchase;
  }

  async settleDebt(supplierId: string, amount: number) {
    return this.prisma.supplier.update({
      where: { id: supplierId },
      data: { balanceOwed: { decrement: amount } },
    });
  }
}
