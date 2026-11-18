import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ShopStatus } from "@eleganz/database";
import { repartirFacturation } from "../billing/revenue-breakdown.util";

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
    const maintenant = new Date();
    const [
      shopsByStatus,
      totalShops,
      totalVendors,
      totalProducts,
      productsOutOfStock,
      ordersByStatus,
      grossOrderValue,
      openDisputes,
      invoiceLines,
      driverInvoiceLines,
      comptableInvoiceLines,
      posSalesTotal,
      institutionsCommissionTotal,
      institutionsRisqueTotal,
      institutionsRisqueParClassification,
      institutionsRisqueParInstitution,
      institutionsNoms,
    ] = await Promise.all([
      this.prisma.shop.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.shop.count(),
      this.prisma.user.count({ where: { role: "SHOP_OWNER" } }),
      this.prisma.product.count(),
      this.prisma.variant.count({ where: { stockQty: 0 } }),
      this.prisma.shopOrder.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.order.aggregate({ _sum: { totalAmount: true } }),
      this.prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      // Lignes complètes plutôt que des agrégats (16 nov. 2026, refonte du
      // Centre de pilotage) : nécessaire pour répartir facture/encaissé/en
      // attente/en retard par ligne via repartirFacturation (comparaison
      // dueAt vs maintenant, impossible à faire dans un aggregate() Prisma
      // sans une requête par tranche). Volumétrie encore modeste à ce stade
      // de la plateforme — même compromis que EcheancierService/AdminFinanceService.
      this.prisma.invoice.findMany({ select: { amount: true, status: true, dueAt: true, kind: true } }),
      this.prisma.driverInvoice.findMany({ select: { amount: true, status: true, dueAt: true } }),
      this.prisma.comptableInvoice.findMany({ select: { amount: true, status: true, dueAt: true } }),
      this.prisma.posSale.aggregate({ where: { status: { not: "CANCELLED" } }, _sum: { totalAmount: true } }),
      // Commission ELEGANZ sur prêts décaissés via le portail institutions —
      // reconnue au décaissement (jamais un cycle attente/retard, voir
      // Loan.institutionCommissionAmount dans le schéma) : tous les prêts
      // avec institutionId comptent, quel que soit leur statut de
      // remboursement actuel.
      this.prisma.loan.aggregate({
        where: { institutionId: { not: null } },
        _sum: { institutionCommissionAmount: true },
      }),
      // Vue consolidée du risque à l'échelle ELEGANZ (18 nov. 2026, chantier
      // "gestion de risque autonome" Phase 2, volet retenu par le
      // propriétaire après abandon des limites d'exposition) — purement
      // informatif : solde restant dû + provision requise, agrégés sur tous
      // les prêts décaissés via une institution partenaire. ELEGANZ ne
      // bloque et ne limite rien ici ; chaque institution reste seule
      // maîtresse de sa propre politique de risque, cette vue l'aide
      // seulement à situer son exposition réelle sur la plateforme.
      this.prisma.loan.aggregate({
        where: { institutionId: { not: null } },
        _sum: { soldeRestant: true, provisionRequise: true },
      }),
      this.prisma.loan.groupBy({
        by: ["classificationRisque"],
        where: { institutionId: { not: null } },
        _count: { _all: true },
        _sum: { soldeRestant: true },
      }),
      this.prisma.loan.groupBy({
        by: ["institutionId", "classificationRisque"],
        where: { institutionId: { not: null } },
        _count: { _all: true },
        _sum: { soldeRestant: true, provisionRequise: true },
      }),
      this.prisma.institution.findMany({ select: { id: true, name: true } }),
    ]);

    // Revenu ELEGANZ par nature (frais d'ouverture, abonnements, crédits
    // IA, ...) et total en attente — dérivés en JS des lignes déjà
    // chargées ci-dessus plutôt que par deux requêtes groupBy/aggregate
    // séparées comme avant le 16 nov. 2026 : mêmes chiffres, une requête de
    // moins.
    const platformRevenueByKind: Record<string, number> = {};
    let pendingInvoicesAmount = 0;
    for (const ligne of invoiceLines) {
      const montant = Number(ligne.amount);
      if (ligne.status === "PAID") {
        platformRevenueByKind[ligne.kind] = (platformRevenueByKind[ligne.kind] ?? 0) + montant;
      } else if (ligne.status === "PENDING") {
        pendingInvoicesAmount += montant;
      }
    }

    // Répartition par module (16 nov. 2026, refonte du Centre de pilotage,
    // plan §4) — un module = une carte côté frontend, chacune avec le même
    // triptyque revenu/en attente/en retard quand il a un sens pour ce
    // module. "gestion" regroupe tout Invoice hors commission marketplace
    // (frais d'ouverture, abonnements, crédits IA, ...) ; "marketplace" isole
    // la commission ELEGANZ Market (kind: "commission") de ces abonnements,
    // qui est un revenu de nature différente. "caisse" (POS) et
    // "institutions" (commission sur prêts) n'ont pas de cycle de
    // facturation attente/retard — enAttente/enRetard valent `null` pour
    // que le frontend n'affiche pas ces deux colonnes pour ces deux cartes.
    const facturesGestion = invoiceLines.filter((l) => l.kind !== "commission");
    const facturesCommissionMarketplace = invoiceLines.filter((l) => l.kind === "commission");
    const totalVentesCaisse = Number(posSalesTotal._sum.totalAmount ?? 0);
    const totalCommissionInstitutions = Number(institutionsCommissionTotal._sum.institutionCommissionAmount ?? 0);

    const modules = [
      {
        cle: "gestion" as const,
        typeRevenu: "abonnement" as const,
        ...repartirFacturation(facturesGestion, maintenant),
      },
      {
        cle: "marketplace" as const,
        typeRevenu: "commission" as const,
        ...repartirFacturation(facturesCommissionMarketplace, maintenant),
      },
      {
        cle: "livreur" as const,
        typeRevenu: "abonnement" as const,
        ...repartirFacturation(driverInvoiceLines, maintenant),
      },
      {
        cle: "secourable" as const,
        typeRevenu: "abonnement" as const,
        ...repartirFacturation(comptableInvoiceLines, maintenant),
      },
      {
        // Valeur des ventes Caisse — PAS un revenu ELEGANZ (comme
        // grossOrderValue ci-dessous), seulement la valeur transactionnelle
        // des vendeurs sur ce module.
        cle: "caisse" as const,
        typeRevenu: "valeur_vendeur" as const,
        facture: totalVentesCaisse,
        encaisse: totalVentesCaisse,
        enAttente: null,
        enRetard: null,
      },
      {
        cle: "institutions" as const,
        typeRevenu: "commission" as const,
        facture: totalCommissionInstitutions,
        encaisse: totalCommissionInstitutions,
        enAttente: null,
        enRetard: null,
      },
    ];

    // Ventilation globale par classification de risque (SAIN/SOUS_SURVEILLANCE/
    // DOUTEUX/COMPROMIS) — initialisée à zéro pour que les 4 classifications
    // apparaissent toujours, même sans aucun prêt dans cette classification.
    const ventilationRisqueGlobale: Record<string, { nombre: number; soldeRestant: number }> = {
      SAIN: { nombre: 0, soldeRestant: 0 },
      SOUS_SURVEILLANCE: { nombre: 0, soldeRestant: 0 },
      DOUTEUX: { nombre: 0, soldeRestant: 0 },
      COMPROMIS: { nombre: 0, soldeRestant: 0 },
    };
    for (const ligne of institutionsRisqueParClassification) {
      ventilationRisqueGlobale[ligne.classificationRisque] = {
        nombre: ligne._count._all,
        soldeRestant: Number(ligne._sum.soldeRestant ?? 0),
      };
    }

    // Détail par institution — même ventilation, par institution plutôt que
    // globale, pour repérer une concentration de risque chez un partenaire
    // précis sans jamais agir dessus depuis ELEGANZ.
    const nomsInstitutions = new Map(institutionsNoms.map((i) => [i.id, i.name]));
    const parInstitutionMap = new Map<
      string,
      {
        institutionId: string;
        nom: string;
        soldeRestant: number;
        provisionRequise: number;
        ventilationRisque: Record<string, number>;
      }
    >();
    for (const ligne of institutionsRisqueParInstitution) {
      if (!ligne.institutionId) continue;
      if (!parInstitutionMap.has(ligne.institutionId)) {
        parInstitutionMap.set(ligne.institutionId, {
          institutionId: ligne.institutionId,
          nom: nomsInstitutions.get(ligne.institutionId) ?? ligne.institutionId,
          soldeRestant: 0,
          provisionRequise: 0,
          ventilationRisque: { SAIN: 0, SOUS_SURVEILLANCE: 0, DOUTEUX: 0, COMPROMIS: 0 },
        });
      }
      const entree = parInstitutionMap.get(ligne.institutionId)!;
      entree.soldeRestant += Number(ligne._sum.soldeRestant ?? 0);
      entree.provisionRequise += Number(ligne._sum.provisionRequise ?? 0);
      entree.ventilationRisque[ligne.classificationRisque] = ligne._count._all;
    }

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
        platformRevenueByKind,
        pendingInvoicesAmount,
        // Détail par module (16 nov. 2026) — voir commentaire ci-dessus.
        modules,
      },
      operations: {
        openDisputes,
      },
      // Vue consolidée du risque institutions (18 nov. 2026) — voir
      // commentaire sur la requête ci-dessus. Purement informatif.
      institutionsRisque: {
        soldeRestantTotal: Number(institutionsRisqueTotal._sum.soldeRestant ?? 0),
        provisionRequiseTotal: Number(institutionsRisqueTotal._sum.provisionRequise ?? 0),
        ventilationRisque: ventilationRisqueGlobale,
        parInstitution: Array.from(parInstitutionMap.values()).sort(
          (a, b) => b.soldeRestant - a.soldeRestant,
        ),
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
