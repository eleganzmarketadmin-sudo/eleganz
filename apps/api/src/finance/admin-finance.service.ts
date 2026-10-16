import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingQueryService } from "./accounting-query.service";
import { BusinessPlanService } from "./business-plan.service";
import { FiscalRuleScope } from "@eleganz/database";
import type { DossierCreditBoutiqueBusinessPlan } from "./finance.service";

export interface DossierCreditPlateforme {
  entiteNom: string;
  depuis: string | null;
  identiteFiscale: {
    fiscalLegalName: string | null;
    fiscalIdNumber: string | null;
    fiscalAddress: string | null;
    fiscalRegime: string | null;
  };
  historiqueMensuel: { mois: string; chiffreAffaires: number; charges: number; resultatNet: number }[];
  bilan: { totalActif: number; totalPassif: number; equilibre: boolean };
  revenus: {
    factures: number;
    encaisses: number;
    parSource: { abonnementsBoutique: number; fraisLivreur: number; abonnementsComptable: number };
  };
  businessPlan: DossierCreditBoutiqueBusinessPlan;
  genereLe: string;
  codeVerification: string;
}

/**
 * FINANCE & COMPTABILITÉ — ELEGANZ elle-même (prompt §13). Sépare strictement
 * (A) la valeur totale des transactions des vendeurs, de (B) ce qui revient
 * réellement à ELEGANZ — jamais l'un présenté comme l'autre (exemple des
 * 100 $ / 10 $ de commission du prompt, §13.3). Voir
 * docs/ARCHITECTURE_FINANCE.md §5.
 */
@Injectable()
export class AdminFinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingQuery: AccountingQueryService,
    private readonly businessPlan: BusinessPlanService,
  ) {}

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

  /**
   * Dossier de crédit d'ELEGANZ elle-même (demande du 16 oct. 2026, point 2)
   * — équivalent, côté plateforme, du dossier crédit boutique
   * (FinanceService.dossierCredit) : mêmes écritures comptables réelles
   * (scope PLATFORM, shopId=null, déjà câblées), mais des revenus propres à
   * ELEGANZ (abonnements boutique, frais livreur, abonnements Secourable —
   * jamais le volume des transactions vendeurs, voir `dashboard` ci-dessus)
   * plutôt que des dettes/créances qui n'ont pas de sens à ce niveau.
   * Jamais persisté, toujours recalculé depuis les écritures réelles.
   */
  async dossierCredit(nombreMois = 6): Promise<DossierCreditPlateforme> {
    const toDate = new Date();
    const fromDate = new Date(toDate);
    fromDate.setMonth(fromDate.getMonth() - Math.min(Math.max(nombreMois, 1), 24));

    const [settings, historiqueMensuel, bilan, revenusPeriode, planAffaires] = await Promise.all([
      this.prisma.platformSettings.findUnique({ where: { id: "platform" } }),
      this.accountingQuery.evolutionMensuelle(FiscalRuleScope.PLATFORM, null, Math.min(Math.max(nombreMois, 1), 24)),
      this.accountingQuery.bilan(FiscalRuleScope.PLATFORM, null, toDate),
      this.dashboard(fromDate, toDate),
      this.businessPlan.obtenir(FiscalRuleScope.PLATFORM, null),
    ]);

    const genereLe = new Date().toISOString();
    const codeVerification = createHash("sha256")
      .update(["PLATFORM", genereLe, JSON.stringify(historiqueMensuel), bilan.totalActif, bilan.totalPassif].join("|"))
      .digest("hex")
      .slice(0, 12)
      .toUpperCase();

    return {
      entiteNom: "ELEGANZ",
      depuis: settings?.platformFoundedAt ? settings.platformFoundedAt.toISOString() : null,
      identiteFiscale: {
        fiscalLegalName: settings?.platformFiscalLegalName ?? null,
        fiscalIdNumber: settings?.platformFiscalIdNumber ?? null,
        fiscalAddress: settings?.platformFiscalAddress ?? null,
        fiscalRegime: settings?.platformFiscalRegime ?? null,
      },
      historiqueMensuel,
      bilan: { totalActif: bilan.totalActif, totalPassif: bilan.totalPassif, equilibre: bilan.equilibre },
      revenus: {
        factures: revenusPeriode.revenusElegans.factures,
        encaisses: revenusPeriode.revenusElegans.encaisses,
        parSource: {
          abonnementsBoutique: revenusPeriode.parSource.abonnementsBoutique.encaisse,
          fraisLivreur: revenusPeriode.parSource.fraisLivreur.encaisse,
          abonnementsComptable: revenusPeriode.parSource.abonnementsComptable.encaisse,
        },
      },
      businessPlan: {
        resumeExecutif: planAffaires.resumeExecutif,
        descriptionActivite: planAffaires.descriptionActivite,
        marcheEtClientele: planAffaires.marcheEtClientele,
        strategieCroissance: planAffaires.strategieCroissance,
        utilisationFonds: planAffaires.utilisationFonds,
        risquesMitigation: planAffaires.risquesMitigation,
        scenarios: planAffaires.scenarios,
      },
      genereLe,
      codeVerification,
    };
  }
}
