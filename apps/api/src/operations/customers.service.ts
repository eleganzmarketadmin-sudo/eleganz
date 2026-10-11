import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerDto } from "./dto/customer.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(shopId: string, dto: CreateCustomerDto) {
    return this.prisma.shopCustomer.create({
      data: { shopId, fullName: dto.fullName, phone: dto.phone },
    });
  }

  list(shopId: string) {
    return this.prisma.shopCustomer.findMany({ where: { shopId }, orderBy: { fullName: "asc" } });
  }

  /**
   * Vente à crédit : augmente la créance du client plutôt que d'être
   * comptée comme un encaissement (complément stratégique §9 — « les
   * créances doivent rester séparées des encaissements effectivement reçus »).
   */
  async recordCreditSale(customerId: string, amount: number) {
    return this.prisma.shopCustomer.update({
      where: { id: customerId },
      data: { creditBalance: { increment: amount } },
    });
  }

  async recordPayment(customerId: string, amount: number) {
    const customer = await this.prisma.shopCustomer.findUniqueOrThrow({ where: { id: customerId } });
    if (amount > Number(customer.creditBalance)) {
      throw new BadRequestException("Le paiement dépasse le solde dû par ce client.");
    }
    return this.prisma.shopCustomer.update({
      where: { id: customerId },
      data: { creditBalance: { decrement: amount } },
    });
  }
}
