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
   * Rapport clients (19 nov. 2026, demande : "ajouter un report de
   * shopcustomer... dans la boutique") — contrairement à `list()` ci-dessus
   * (utilisé par Créances & dettes, qui n'a besoin que du solde), cette
   * méthode enrichit chaque fiche avec le total des achats, le nombre de
   * ventes et la date du dernier achat, calculés depuis `PosSale` plutôt que
   * stockés sur `ShopCustomer` (pas de duplication de données qui pourrait
   * se désynchroniser).
   *
   * Groupé par devise en plus du client : une boutique facture en USD et/ou
   * en CDF (`PosSale.currency`), et additionner les deux donnerait un total
   * sans signification. Seules les ventes `COMPLETED` comptent — une vente
   * annulée ou retournée n'est pas un achat réel du client.
   */
  async rapport(shopId: string) {
    const clients = await this.prisma.shopCustomer.findMany({
      where: { shopId },
      orderBy: { fullName: "asc" },
    });
    if (clients.length === 0) return [];

    const agregats = await this.prisma.posSale.groupBy({
      by: ["customerId", "currency"],
      where: { shopId, customerId: { not: null }, status: "COMPLETED" },
      _sum: { totalAmount: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    const parClient = new Map<
      string,
      { nombreVentes: number; dernierAchatAt: Date | null; totalAchats: { currency: string; montant: number }[] }
    >();
    for (const a of agregats) {
      if (!a.customerId) continue;
      const entree = parClient.get(a.customerId) ?? {
        nombreVentes: 0,
        dernierAchatAt: null as Date | null,
        totalAchats: [] as { currency: string; montant: number }[],
      };
      entree.nombreVentes += a._count._all;
      const dernier = a._max.createdAt;
      if (dernier && (!entree.dernierAchatAt || dernier > entree.dernierAchatAt)) {
        entree.dernierAchatAt = dernier;
      }
      entree.totalAchats.push({ currency: a.currency, montant: Number(a._sum.totalAmount ?? 0) });
      parClient.set(a.customerId, entree);
    }

    return clients.map((c) => {
      const agg = parClient.get(c.id);
      return {
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        creditBalance: Number(c.creditBalance),
        nombreVentes: agg?.nombreVentes ?? 0,
        dernierAchatAt: agg?.dernierAchatAt ?? null,
        totalAchats: agg?.totalAchats ?? [],
      };
    });
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
