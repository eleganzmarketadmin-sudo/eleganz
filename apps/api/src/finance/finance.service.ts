import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateFiscalIdentityDto } from "./dto/update-fiscal-identity.dto";

/**
 * Tableau de bord financier boutique (prompt du 13 oct. 2026, §7) —
 * agrège des opérations réelles déjà enregistrées ailleurs (voir
 * docs/ARCHITECTURE_FINANCE.md §4). Chaque chiffre reste une estimation
 * explicitement étiquetée comme telle : ce n'est ni un bilan ni un résultat
 * certifié, juste une lecture consolidée de ce qui existe déjà.
 */
@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  fiscalIdentity(shopId: string) {
    return this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      select: {
        fiscalLegalName: true,
        fiscalLegalForm: true,
        fiscalIdNumber: true,
        fiscalAddress: true,
        fiscalJurisdiction: true,
        fiscalRegime: true,
        fiscalExercice: true,
        fiscalVatRegistered: true,
      },
    });
  }

  updateFiscalIdentity(shopId: string, dto: UpdateFiscalIdentityDto) {
    return this.prisma.shop.update({ where: { id: shopId }, data: dto });
  }

  async dashboardForShop(shopId: string, from: Date, to: Date) {
    const [posSales, shopOrders, expenses, purchases, supplier, customers] = await Promise.all([
      this.prisma.posSale.findMany({
        where: { shopId, createdAt: { gte: from, lt: to }, status: { not: "CANCELLED" } },
        include: { lines: { include: { variant: true } }, payments: true },
      }),
      this.prisma.shopOrder.findMany({
        where: { shopId, createdAt: { gte: from, lt: to } },
        select: { subtotal: true, commissionAmount: true },
      }),
      this.prisma.expense.groupBy({
        by: ["currency"],
        where: { shopId, createdAt: { gte: from, lt: to } },
        _sum: { amount: true },
      }),
      this.prisma.purchase.findMany({
        where: { supplier: { shopId }, createdAt: { gte: from, lt: to } },
        select: { amount: true },
      }),
      this.prisma.supplier.aggregate({ where: { shopId }, _sum: { balanceOwed: true } }),
      this.prisma.shopCustomer.aggregate({ where: { shopId }, _sum: { creditBalance: true } }),
    ]);

    const caBoutique = posSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const caMarketplace = shopOrders.reduce((sum, o) => sum + Number(o.subtotal), 0);
    const encaissementsConfirmes = posSales.reduce(
      (sum, s) => sum + s.payments.filter((p) => p.confirmed).reduce((a, p) => a + Number(p.amount), 0),
      0,
    );

    let margeConnuePourTout = true;
    let margeBrute = 0;
    for (const sale of posSales) {
      for (const line of sale.lines) {
        const cout = line.variant?.costPrice;
        if (cout == null) {
          margeConnuePourTout = false;
          continue;
        }
        margeBrute += (Number(line.unitPrice) - Number(cout)) * line.quantity;
      }
    }

    const achats = purchases.reduce((sum, p) => sum + Number(p.amount), 0);
    const chargesParDevise = Object.fromEntries(
      expenses.map((e) => [e.currency, Number(e._sum.amount ?? 0)]),
    );
    const totalCharges = expenses.reduce((sum, e) => sum + Number(e._sum.amount ?? 0), 0);

    const commissionMarketplace = shopOrders.reduce((sum, o) => sum + Number(o.commissionAmount), 0);

    const chiffreAffaires = caBoutique + caMarketplace;
    const resultatEstime = chiffreAffaires - achats - totalCharges;

    return {
      periode: { from: from.toISOString(), to: to.toISOString() },
      chiffreAffaires: { total: chiffreAffaires, boutique: caBoutique, marketplace: caMarketplace },
      encaissementsConfirmes,
      achats,
      charges: { total: totalCharges, parDevise: chargesParDevise },
      margeBrute: margeConnuePourTout ? margeBrute : null,
      margeFiable: margeConnuePourTout,
      resultatEstime,
      dettesFournisseurs: Number(supplier._sum.balanceOwed ?? 0),
      creancesClients: Number(customers._sum.creditBalance ?? 0),
      // Commission marketplace : ShopOrder.commissionAmount n'est actuellement
      // jamais calculé par l'API (voir docs/ARCHITECTURE_FINANCE.md §2) — ce
      // champ reflète donc la réalité (toujours 0) plutôt qu'une estimation
      // inventée, avec le statut explicite ci-dessous.
      commissionMarketplace,
      statut: {
        resultat: "estimation — non certifié, non audité",
        commission: "non implémentée côté marketplace à ce jour",
        dettesFournisseurs:
          "solde cumulé, sans historique détaillé des mouvements à cette phase",
      },
    };
  }
}
