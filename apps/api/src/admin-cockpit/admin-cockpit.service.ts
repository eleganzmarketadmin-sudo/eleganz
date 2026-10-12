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

  /**
   * Séries temporelles pour les graphiques du tableau de bord (évolution
   * sur `days` jours, 30 par défaut). Les agrégations sont faites en JS
   * plutôt qu'en SQL brut : le volume de données d'une plateforme qui
   * démarre reste largement sous ce qui justifierait un groupBy par date
   * côté base, et ça évite toute dépendance à la syntaxe SQL du moteur en
   * production. Chaque jour sans activité apparaît avec la valeur 0 — pas
   * de trou dans la série, pour que le graphique reste lisible dès les
   * premières semaines.
   */
  async evolution(days = 30) {
    const aujourdHui = new Date();
    aujourdHui.setHours(23, 59, 59, 999);
    const debut = new Date(aujourdHui);
    debut.setDate(debut.getDate() - (days - 1));
    debut.setHours(0, 0, 0, 0);

    const [shops, products, orders, paidInvoices] = await Promise.all([
      this.prisma.shop.findMany({
        where: { createdAt: { gte: debut } },
        select: { createdAt: true },
      }),
      this.prisma.product.findMany({
        where: { createdAt: { gte: debut } },
        select: { createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: debut } },
        select: { createdAt: true, totalAmount: true },
      }),
      this.prisma.invoice.findMany({
        where: { status: "PAID", paidAt: { gte: debut } },
        select: { paidAt: true, amount: true },
      }),
    ]);

    const cle = (d: Date) => d.toISOString().slice(0, 10);

    const jours: string[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(debut);
      d.setDate(d.getDate() + i);
      jours.push(cle(d));
    }

    const nouvellesBoutiques = Object.fromEntries(jours.map((j) => [j, 0]));
    const nouveauxProduits = Object.fromEntries(jours.map((j) => [j, 0]));
    const commandes = Object.fromEntries(jours.map((j) => [j, 0]));
    const valeurCommandes = Object.fromEntries(jours.map((j) => [j, 0]));
    const revenuPlateforme = Object.fromEntries(jours.map((j) => [j, 0]));

    for (const s of shops) {
      const k = cle(s.createdAt);
      if (k in nouvellesBoutiques) nouvellesBoutiques[k] += 1;
    }
    for (const p of products) {
      const k = cle(p.createdAt);
      if (k in nouveauxProduits) nouveauxProduits[k] += 1;
    }
    for (const o of orders) {
      const k = cle(o.createdAt);
      if (k in commandes) {
        commandes[k] += 1;
        valeurCommandes[k] += Number(o.totalAmount);
      }
    }
    for (const f of paidInvoices) {
      if (!f.paidAt) continue;
      const k = cle(f.paidAt);
      if (k in revenuPlateforme) revenuPlateforme[k] += Number(f.amount);
    }

    return {
      jours,
      nouvellesBoutiques: jours.map((j) => nouvellesBoutiques[j]),
      nouveauxProduits: jours.map((j) => nouveauxProduits[j]),
      commandes: jours.map((j) => commandes[j]),
      valeurCommandes: jours.map((j) => valeurCommandes[j]),
      revenuPlateforme: jours.map((j) => revenuPlateforme[j]),
    };
  }
}
