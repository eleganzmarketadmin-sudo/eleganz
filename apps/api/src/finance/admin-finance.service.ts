import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * FINANCE & COMPTABILITÉ — ELEGANZ elle-même (prompt §13). Sépare strictement
 * (A) la valeur totale des transactions des vendeurs, de (B) ce qui revient
 * réellement à ELEGANZ — jamais l'un présenté comme l'autre (exemple des
 * 100 $ / 10 $ de commission du prompt, §13.3). Voir
 * docs/ARCHITECTURE_FINANCE.md §5.
 */
@Injectable()
export class AdminFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(from: Date, to: Date) {
    const [posSales, shopOrders, invoices, driverInvoices, comptableInvoices] = await Promise.all([
      this.prisma.posSale.aggregate({
        where: { createdAt: { gte: from, lt: to }, status: { not: "CANCELLED" } },
        _sum: { totalAmount: true },
      }),
      this.prisma.shopOrder.aggregate({
        where: { createdAt: { gte: from, lt: to } },
        _sum: { subtotal: true, commissionAmount: true },
      }),
      this.prisma.invoice.findMany({ where: { createdAt: { gte: from, lt: to } } }),
      this.prisma.driverInvoice.findMany({ where: { createdAt: { gte: from, lt: to } } }),
      this.prisma.comptableInvoice.findMany({ where: { createdAt: { gte: from, lt: to } } }),
    ]);

    function repartir(lignes: { amount: unknown; status: string }[]) {
      const facture = lignes.reduce((s, l) => s + Number(l.amount), 0);
      const encaisse = lignes
        .filter((l) => l.status === "PAID")
        .reduce((s, l) => s + Number(l.amount), 0);
      return { facture, encaisse };
    }

    const abonnementsBoutique = repartir(invoices);
    const fraisLivreur = repartir(driverInvoices);
    const abonnementsComptable = repartir(comptableInvoices);

    // (A) Valeur totale des transactions des vendeurs — jamais un revenu ELEGANZ.
    const valeurTotaleTransactionsVendeurs =
      Number(posSales._sum.totalAmount ?? 0) + Number(shopOrders._sum.subtotal ?? 0);

    // (B) Revenus réellement attribuables à ELEGANZ : uniquement ses propres
    // facturations (abonnements, frais livreur) — jamais le volume vendeur.
    const revenusElegansEncaisses =
      abonnementsBoutique.encaisse + fraisLivreur.encaisse + abonnementsComptable.encaisse;
    const revenusElegansFactures =
      abonnementsBoutique.facture + fraisLivreur.facture + abonnementsComptable.facture;

    return {
      periode: { from: from.toISOString(), to: to.toISOString() },
      valeurTotaleTransactionsVendeurs,
      revenusElegans: { factures: revenusElegansFactures, encaisses: revenusElegansEncaisses },
      parSource: { abonnementsBoutique, fraisLivreur, abonnementsComptable },
      commissionMarketplace: {
        montant: Number(shopOrders._sum.commissionAmount ?? 0),
        statut: "non implémentée — ShopOrder.commissionAmount n'est calculé nulle part dans l'API à ce jour",
      },
      statut:
        "estimation à partir des opérations enregistrées — non certifié, ne remplace pas une comptabilité réglementaire",
    };
  }
}
