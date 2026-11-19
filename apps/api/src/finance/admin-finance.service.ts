import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingQueryService } from "./accounting-query.service";
import { BusinessPlanService } from "./business-plan.service";
import { FiscalRuleScope } from "@eleganz/database";
import type { DossierCreditBoutiqueBusinessPlan } from "./finance.service";
import { repartirFacturation } from "../billing/revenue-breakdown.util";
import { construireClasseurExcel } from "../common/xlsx.util";

export interface DossierCreditPlateforme {
  entiteNom: string;
  depuis: string | null;
  identiteFiscale: {
    fiscalLegalName: string | null;
    fiscalIdNumber: string | null;
    fiscalRccm: string | null;
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

    // repartir() vivait ici en fonction locale avant le 16 nov. 2026 — voir
    // désormais apps/api/src/billing/revenue-breakdown.util.ts
    // (repartirFacturation), extrait en utilitaire partagé avec le Centre
    // de pilotage (AdminCockpitService.executiveDashboard) et étendu avec
    // enAttente/enRetard. Le résultat reste rétro-compatible : facture et
    // encaisse gardent exactement le même sens qu'avant pour les lecteurs
    // existants (apps/web/app/admin/finance/page.tsx).
    const abonnementsBoutique = repartirFacturation(invoices, to);
    const fraisLivreur = repartirFacturation(driverInvoices, to);
    const abonnementsComptable = repartirFacturation(comptableInvoices, to);

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
        statut:
          "calculée par commande (OrdersService, taux par bouquet/plateforme, avec exonération configurable depuis le Centre de pilotage) — reste à 0 tant qu'aucun taux n'est fixé ou que la boutique est encore exonérée",
      },
      statut:
        "estimation à partir des opérations enregistrées — non certifié, ne remplace pas une comptabilité réglementaire",
    };
  }

  /**
   * Rapport détaillé "Ventes Caisse" (19 nov. 2026, demande du propriétaire :
   * "rendre ces champs également de bouton ... ça nous amène ou ouvre le
   * rapport détaillé") — liste, pour la période demandée, les ventes Caisse
   * (POS) qui alimentent la carte "Ventes Caisse" du Centre de pilotage
   * (AdminCockpitService.executiveDashboard). Même filtre que cette carte
   * (`status !== "CANCELLED"`) pour que le total affiché ici corresponde
   * exactement à celui du tableau de bord sur la même période. Valeur des
   * ventes des boutiques, jamais un revenu ELEGANZ (voir `dashboard`
   * ci-dessus) — affiché ici pour la même raison que sur le tableau de bord :
   * donner de la visibilité sur l'activité, pas prétendre que c'est un
   * encaissement ELEGANZ.
   */
  async listerVentesCaisse(from: Date, to: Date) {
    const ventes = await this.prisma.posSale.findMany({
      where: { createdAt: { gte: from, lt: to }, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      include: { shop: { select: { name: true } } },
    });
    const total = ventes.reduce((s, v) => s + Number(v.totalAmount), 0);
    return {
      periode: { from: from.toISOString(), to: to.toISOString() },
      total,
      lignes: ventes.map((v) => ({
        id: v.id,
        boutique: v.shop.name,
        montant: Number(v.totalAmount),
        devise: v.currency,
        statut: v.status,
        date: v.createdAt.toISOString(),
      })),
    };
  }

  async exporterVentesCaisse(from: Date, to: Date): Promise<Buffer> {
    const { lignes } = await this.listerVentesCaisse(from, to);
    return construireClasseurExcel(
      "Ventes Caisse",
      ["Boutique", "Montant", "Devise", "Statut", "Date"],
      lignes.map((l) => [
        l.boutique,
        l.montant,
        l.devise,
        l.statut,
        new Intl.DateTimeFormat("fr-FR").format(new Date(l.date)),
      ]),
    );
  }

  /**
   * Rapport détaillé "Commission Institutions" (19 nov. 2026, même demande
   * que ci-dessus) — liste les prêts décaissés via le portail institutions
   * (Loan.institutionId non nul) sur la période, avec la commission ELEGANZ
   * figée au décaissement (Loan.institutionCommissionAmount — jamais un
   * cycle attente/retard, voir le commentaire sur ce champ dans
   * schema.prisma). Même filtre et même date de référence
   * (Loan.dateObtention) que la carte "Commission Institutions" du Centre de
   * pilotage, pour que le total corresponde.
   */
  async listerCommissionInstitutions(from: Date, to: Date) {
    const prets = await this.prisma.loan.findMany({
      where: { institutionId: { not: null }, dateObtention: { gte: from, lt: to } },
      orderBy: { dateObtention: "desc" },
      include: { institution: { select: { name: true } }, shop: { select: { name: true } } },
    });
    const total = prets.reduce((s, p) => s + Number(p.institutionCommissionAmount ?? 0), 0);
    return {
      periode: { from: from.toISOString(), to: to.toISOString() },
      total,
      lignes: prets.map((p) => ({
        id: p.id,
        institution: p.institution?.name ?? "",
        boutique: p.shop?.name ?? "",
        pret: p.label,
        montantPret: Number(p.montant),
        commission: Number(p.institutionCommissionAmount ?? 0),
        devise: p.devise,
        date: p.dateObtention.toISOString(),
      })),
    };
  }

  async exporterCommissionInstitutions(from: Date, to: Date): Promise<Buffer> {
    const { lignes } = await this.listerCommissionInstitutions(from, to);
    return construireClasseurExcel(
      "Commission Institutions",
      ["Institution", "Boutique emprunteuse", "Prêt", "Montant du prêt", "Commission ELEGANZ", "Devise", "Date d'obtention"],
      lignes.map((l) => [
        l.institution,
        l.boutique,
        l.pret,
        l.montantPret,
        l.commission,
        l.devise,
        new Intl.DateTimeFormat("fr-FR").format(new Date(l.date)),
      ]),
    );
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
        fiscalRccm: settings?.platformFiscalRccm ?? null,
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
        canvasSegmentsClientele: planAffaires.canvasSegmentsClientele,
        canvasPropositionValeur: planAffaires.canvasPropositionValeur,
        canvasCanaux: planAffaires.canvasCanaux,
        canvasRelationsClients: planAffaires.canvasRelationsClients,
        canvasSourcesRevenus: planAffaires.canvasSourcesRevenus,
        canvasRessourcesClefs: planAffaires.canvasRessourcesClefs,
        canvasActivitesClefs: planAffaires.canvasActivitesClefs,
        canvasPartenairesClefs: planAffaires.canvasPartenairesClefs,
        canvasStructureCouts: planAffaires.canvasStructureCouts,
        scenarios: planAffaires.scenarios,
      },
      genereLe,
      codeVerification,
    };
  }
}
