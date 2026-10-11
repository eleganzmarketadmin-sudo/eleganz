import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSupplierDto, RecordPurchaseDto } from "./dto/supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  create(shopId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: { shopId, name: dto.name, phone: dto.phone } });
  }

  list(shopId: string) {
    return this.prisma.supplier.findMany({ where: { shopId }, include: { purchases: true } });
  }

  async recordPurchase(supplierId: string, dto: RecordPurchaseDto) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          supplierId,
          amount: dto.amount,
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
  }

  async settleDebt(supplierId: string, amount: number) {
    return this.prisma.supplier.update({
      where: { id: supplierId },
      data: { balanceOwed: { decrement: amount } },
    });
  }
}
