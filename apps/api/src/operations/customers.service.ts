import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerDto, RecordCreditPaymentDto } from "./dto/customer.dto";

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

  /**
   * `dto.method`/`dto.paidAt` ajoutés le 14 oct. 2026 (créances & dettes) —
   * enregistre un `ReglementClient` en plus de la décrémentation du solde
   * cumulé, qui reste la seule source de vérité pour le solde affiché.
   */
  async recordPayment(shopId: string, customerId: string, dto: RecordCreditPaymentDto) {
    // 21 oct. 2026 (audit sécurité) : IDOR corrigé — `findUniqueOrThrow`
    // sans filtre `shopId` permettait à un employé de la boutique A
    // d'enregistrer un règlement sur un client d'une AUTRE boutique en
    // devinant son UUID, effaçant frauduleusement une créance due à B.
    const customer = await this.prisma.shopCustomer.findFirstOrThrow({ where: { id: customerId, shopId } });
    if (dto.amount > Number(customer.creditBalance)) {
      throw new BadRequestException("Le paiement dépasse le solde dû par ce client.");
    }
    await this.prisma.reglementClient.create({
      data: {
        customerId,
        amount: dto.amount,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        method: dto.method,
      },
    });
    return this.prisma.shopCustomer.update({
      where: { id: customerId },
      data: { creditBalance: { decrement: dto.amount } },
    });
  }
}
