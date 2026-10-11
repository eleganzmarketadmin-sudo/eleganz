import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ShopStatus } from "@eleganz/database";

@Injectable()
export class AdminCockpitService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tableau de bord exécutif (prompt §33). Chaque section est calculée à
   * partir de données réelles de la base — aucune statistique fictive.
   * Distingue explicitement la valeur brute des commandes (ce que les
   * acheteurs paient, en grande partie dû aux vendeurs) des revenus
   * effectivement acquis par ELEGANZ (factures payées), conformément à la
   * consigne du prompt §34 : « ne pas présenter les montants dus aux
   * vendeurs comme des bénéfices de la plateforme ».
   */
  async executiveDashboard() {
    const [
      shopsByStatus,
      totalShops,
      totalVendors,
      totalProducts,
      productsOutOfStock,
      ordersByStatus,
      grossOrderValue,
      platformRevenueByKind,
      pendingInvoicesAmount,
      openDisputes,
    ] = await Promise.all([
      this.prisma.shop.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.shop.count(),
      this.prisma.user.count({ where: { role: "SHOP_OWNER" } }),
      this.prisma.product.count(),
      this.prisma.variant.count({ where: { stockQty: 0 } }),
      this.prisma.shopOrder.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.order.aggregate({ _sum: { totalAmount: true } }),
      this.prisma.invoice.groupBy({ by: ["kind"], where: { status: "PAID" }, _sum: { amount: true } }),
      this.prisma.invoice.aggregate({ where: { status: "PENDING" }, _sum: { amount: true } }),
      this.prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    ]);

    return {
      activity: {
        totalShops,
        shopsByStatus: Object.fromEntries(shopsByStatus.map((s) => [s.status, s._count._all])),
        activeShops:
          shopsByStatus.find((s) => s.status === ShopStatus.ACTIVE)?._count._all ?? 0,
        freeShops:
          shopsByStatus.find((s) => s.status === ShopStatus.FREE_PERIOD)?._count._all ?? 0,
        suspendedShops:
          shopsByStatus.find((s) => s.status === ShopStatus.SUSPENDED)?._count._all ?? 0,
        totalVendors,
        totalProducts,
        productsOutOfStock,
        ordersByStatus: Object.fromEntries(ordersByStatus.map((o) => [o.status, o._count._all])),
      },
      revenue: {
        // Valeur brute : ce que les acheteurs ont payé au total. PAS un
        // revenu ELEGANZ — la majeure partie revient aux vendeurs.
        grossOrderValue: Number(grossOrderValue._sum.totalAmount ?? 0),
        // Revenu réellement acquis par la plateforme, par nature (frais
        // d'ouverture, abonnements, crédits IA, ...), calculé uniquement sur
        // les factures effectivement payées.
        platformRevenueByKind: Object.fromEntries(
          platformRevenueByKind.map((r) => [r.kind, Number(r._sum.amount ?? 0)]),
        ),
        pendingInvoicesAmount: Number(pendingInvoicesAmount._sum.amount ?? 0),
      },
      operations: {
        openDisputes,
      },
      // Pas encore de données réelles : les modules IA (recherche visuelle,
      // studio publicitaire) ne sont pas encore implémentés (voir
      // NEXT_ACTIONS.md) — ne jamais remplir ces champs avec des valeurs
      // inventées tant que les tables AiCreditTransaction ne sont pas alimentées.
      aiUsage: {
        note: "Pas encore de données : les services IA ne sont pas encore implémentés.",
      },
    };
  }
}
